// ════════════════════════════════════════════════════════════════
//  Debit data scope per user (server only).
//  • Admin / FULL_DATA_ACCESS users see everything.
//  • Everyone else sees only their share of each main customer's ledger:
//    1. Sales invoices: the invoice number is looked up in the Sales DB →
//       its sub customer → that customer's SALES_REP / MERCHANDISER.
//    2. Payments / credits matched to invoices (MATCHING): follow those invoices.
//    3. Everything else on the main customer (entries with no sales invoice,
//       unmatched payments, the unapplied part of a payment):
//       - only rep / merchandiser of the main customer → all of it
//       - shared main customer → split equally between its reps
//         (or merchandisers): 2 reps = 50/50, 3 reps = a third each…
//  Invoice numbers are compared up to the first space
//  (e.g. "INV/2026/10205 20" → "INV/2026/10205").
// ════════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isAdminUser, type SessionUserRecord } from '@/lib/session';
import { hasSalesDataAccess } from '@/lib/supabase';
import { getSalesDataServer } from '@/app/Sales/Cache/SalesCache';
import type { InvoiceRow } from '@/types';

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
const round2 = (n: number) => Math.round(n * 100) / 100;
/** Invoice number up to the first space, e.g. "INV/2026/10205 20" → "INV/2026/10205". */
const invoiceKey = (v: unknown) => norm(v).split(/\s+/)[0] || '';

export function hasFullDebitAccess(user: SessionUserRecord): boolean {
  return (
    isAdminUser(user) ||
    hasSalesDataAccess({ name: user.name, userAdmin: user.userAdmin, salesDataAccess: user.salesDataAccess })
  );
}

type Customer = { main: string; rep: string; merch: string };
type MainGroup = { reps: Set<string>; merchs: Set<string> };

export type DebitScope = {
  /** Fraction (0..1) of a ledger row that belongs to the user, before payment matching. */
  ownShare: (row: InvoiceRow) => number;
};

/** Name → user ID, so a rep stored by name and by ID counts as one person. */
async function loadUserIds(): Promise<Map<string, string>> {
  const { data, error } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME');
  if (error) throw error;
  const map = new Map<string, string>();
  for (const u of (data || []) as any[]) {
    const id = norm(u.ID);
    if (!id) continue;
    map.set(id, id);
    const name = norm(u.NAME);
    if (name) map.set(name, id);
  }
  return map;
}

async function loadCustomers(): Promise<Map<string, Customer>> {
  const map = new Map<string, Customer>();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await getSupabaseAdmin()
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "SALES_REP", "MERCHANDISER"')
      .order('CUSTOMER ID', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    for (const r of rows as any[]) {
      const id = norm(r['CUSTOMER ID']);
      if (!id) continue;
      map.set(id, {
        main: norm(r['CUSTOMER MAIN NAME']) || `#${id}`,
        rep: norm(r['SALES_REP']),
        merch: norm(r['MERCHANDISER']),
      });
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return map;
}

export async function buildDebitScope(user: SessionUserRecord): Promise<DebitScope> {
  const [userIds, customers, sales] = await Promise.all([loadUserIds(), loadCustomers(), getSalesDataServer()]);
  const person = (v: string) => (v ? userIds.get(v) || v : '');
  const meId = person(norm(user.id)) || person(norm(user.name));
  const isMe = (p: string) => !!p && person(p) === meId;

  // People per main customer (deduplicated by user)
  const groups = new Map<string, MainGroup>();
  customers.forEach((c) => {
    const g = groups.get(c.main) || { reps: new Set<string>(), merchs: new Set<string>() };
    if (c.rep) g.reps.add(person(c.rep));
    if (c.merch) g.merchs.add(person(c.merch));
    groups.set(c.main, g);
  });

  // Sales invoices → is it the user's (its sub customer's rep / merchandiser)?
  const invoiceMine = new Map<string, boolean>();
  for (const s of sales as any[]) {
    const inv = invoiceKey(s.invoiceNumber);
    if (!inv) continue;
    const cust = customers.get(norm(s.customerId));
    const mine = !!cust && (isMe(cust.rep) || isMe(cust.merch));
    invoiceMine.set(inv, (invoiceMine.get(inv) || false) || mine);
  }

  // Equal split between the main customer's reps (or merchandisers)
  const mainShare = (row: InvoiceRow): number => {
    const cust = customers.get(norm(row.customerId));
    const g = cust ? groups.get(cust.main) : undefined;
    if (!g) return 0;
    const asRep = g.reps.has(meId) ? 1 / g.reps.size : 0;
    const asMerch = g.merchs.has(meId) ? 1 / g.merchs.size : 0;
    return Math.max(asRep, asMerch);
  };

  return {
    ownShare: (row) => {
      const inv = invoiceKey(row.number);
      if ((Number(row.debit) || 0) > 0 && inv && invoiceMine.has(inv)) return invoiceMine.get(inv) ? 1 : 0;
      return mainShare(row);
    },
  };
}

function scaled(row: InvoiceRow, factor: number, field: 'debit' | 'credit'): InvoiceRow | null {
  if (factor >= 0.9999) return row;
  const amount = round2((Number(row[field]) || 0) * factor);
  if (amount < 0.01) return null;
  return {
    ...row,
    id: `${row.id}-part`,
    [field]: amount,
    residualAmount: round2((Number(row.residualAmount) || 0) * factor),
  } as InvoiceRow;
}

/** Keeps only the user's share of the ledger (see header). */
export function applyDebitScope(rows: InvoiceRow[], scope: DebitScope): InvoiceRow[] {
  // Per matching group: total invoice debit and the user's part of it
  type Group = { debit: number; mineDebit: number; credit: number };
  const groups = new Map<string, Group>();
  const debitShare = new Map<InvoiceRow, number>();
  for (const r of rows) {
    const debit = Number(r.debit) || 0;
    if (debit > 0) debitShare.set(r, scope.ownShare(r));
    const key = String(r.matching || '').trim();
    if (!key) continue;
    const g = groups.get(key) || { debit: 0, mineDebit: 0, credit: 0 };
    if (debit > 0) {
      g.debit += debit;
      g.mineDebit += debit * (debitShare.get(r) || 0);
    }
    const credit = Number(r.credit) || 0;
    if (credit > 0) g.credit += credit;
    groups.set(key, g);
  }

  const out: InvoiceRow[] = [];
  for (const r of rows) {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;

    if (debit > 0) {
      const part = scaled(r, debitShare.get(r) || 0, 'debit');
      if (part) out.push(part);
      continue;
    }
    if (credit <= 0) {
      if (scope.ownShare(r) > 0) out.push(r);
      continue;
    }

    const key = String(r.matching || '').trim();
    const g = key ? groups.get(key) : undefined;
    let factor: number;
    if (!g || g.debit <= 0) {
      factor = scope.ownShare(r);
    } else {
      // applied part follows the matched invoices, the rest follows the main customer rule
      const appliedRatio = Math.min(1, g.debit / g.credit);
      factor = appliedRatio * (g.mineDebit / g.debit) + (1 - appliedRatio) * scope.ownShare(r);
    }
    const part = scaled(r, factor, 'credit');
    if (part) out.push(part);
  }
  return out;
}

// ════════════════════════════════════════════════════════════════
//  Payments per sales rep (all reps) — same rules as the rep scope:
//   • sales invoice → rep of its sub customer (Sales DB → bhs_CUSTOMERS)
//   • other entries → split equally between the main customer's reps
//   • payments matched to invoices follow those invoices;
//     the unapplied part follows the main customer rule
//  Returns, for each payment / refund row id, the reps and their share (0..1).
// ════════════════════════════════════════════════════════════════
export const UNASSIGNED_REP = 'Unassigned';

export async function buildRepAllocation(
  rows: InvoiceRow[],
): Promise<Record<string, { rep: string; share: number }[]>> {
  const [userIds, customers, sales, usersRes] = await Promise.all([
    loadUserIds(),
    loadCustomers(),
    getSalesDataServer(),
    getSupabaseAdmin().from('bhs_USERS').select('ID, NAME'),
  ]);
  const displayName = new Map<string, string>();
  for (const u of (usersRes.data || []) as any[]) {
    const id = norm(u.ID);
    if (id) displayName.set(id, String(u.NAME || '').trim() || id);
  }
  /** rep value (ID or name) → shown name */
  const repName = (raw: string) => {
    if (!raw) return '';
    const id = userIds.get(raw) || raw;
    return displayName.get(id) || raw;
  };

  // reps per main customer
  const mainReps = new Map<string, Set<string>>();
  customers.forEach((c) => {
    const set = mainReps.get(c.main) || new Set<string>();
    const name = repName(c.rep);
    if (name) set.add(name);
    mainReps.set(c.main, set);
  });

  // sales invoice → rep
  const invoiceRep = new Map<string, string>();
  for (const s of sales as any[]) {
    const inv = invoiceKey(s.invoiceNumber);
    if (!inv || invoiceRep.has(inv)) continue;
    const cust = customers.get(norm(s.customerId));
    invoiceRep.set(inv, (cust && repName(cust.rep)) || UNASSIGNED_REP);
  }

  type Dist = Map<string, number>;
  const mainDist = (row: InvoiceRow): Dist => {
    const cust = customers.get(norm(row.customerId));
    const reps = cust ? mainReps.get(cust.main) : undefined;
    if (!reps || reps.size === 0) return new Map([[UNASSIGNED_REP, 1]]);
    const share = 1 / reps.size;
    return new Map(Array.from(reps).map((r) => [r, share]));
  };
  const debitDist = (row: InvoiceRow): Dist => {
    const rep = invoiceRep.get(invoiceKey(row.number));
    return rep ? new Map([[rep, 1]]) : mainDist(row);
  };
  const addInto = (target: Dist, src: Dist, factor: number) => {
    src.forEach((v, k) => target.set(k, (target.get(k) || 0) + v * factor));
  };

  // matching groups: invoice debit per rep
  type Group = { debit: number; credit: number; byRep: Dist };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    const key = String(r.matching || '').trim();
    if (!key) continue;
    const g = groups.get(key) || { debit: 0, credit: 0, byRep: new Map() };
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;
    if (debit > 0) {
      g.debit += debit;
      addInto(g.byRep, debitDist(r), debit);
    }
    if (credit > 0) g.credit += credit;
    groups.set(key, g);
  }

  const out: Record<string, { rep: string; share: number }[]> = {};
  for (const r of rows) {
    const credit = Number(r.credit) || 0;
    const isBank = norm(r.number).startsWith('BNK');
    if (credit <= 0 && !isBank) continue; // only payments / refunds are needed
    let dist: Dist;
    if (credit > 0) {
      const g = groups.get(String(r.matching || '').trim());
      if (g && g.debit > 0) {
        const applied = Math.min(1, g.debit / g.credit);
        dist = new Map();
        addInto(dist, g.byRep, applied / g.debit);
        addInto(dist, mainDist(r), 1 - applied);
      } else {
        dist = mainDist(r);
      }
    } else {
      dist = mainDist(r); // refund / bounced payment
    }
    out[String(r.id)] = Array.from(dist.entries())
      .filter(([, v]) => v > 0.0001)
      .map(([rep, share]) => ({ rep, share }));
  }
  return out;
}
