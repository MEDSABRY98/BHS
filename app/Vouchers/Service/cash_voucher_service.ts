'use server';

// Unified cash vouchers (Cash In = Receipt Voucher RV-xxxx, Cash Out = Payment Voucher PV-xxxx).
// Table: web_CASH_VOUCHERS (RLS on, no public access) — only reachable through these actions.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import {
  amountToWords,
  formatVoucherNumber,
  linesTotal,
  parseVoucherNumber,
  round2,
  type CashVoucher,
  type VoucherInput,
  type VoucherLine,
  type VoucherType,
} from '../Utils/voucherTypes';

const TABLE = 'web_CASH_VOUCHERS';
type Action = 'new' | 'saved';

// ─────────────────────────────────────────────────────────────
//  Permissions — same keys as before:
//  Cash In  -> 'cash-receipt'  ('new' to create/edit/delete, 'saved' to view)
//  Cash Out -> 'cash-handover' ('new' to create/edit/delete, 'saved' to view)
// ─────────────────────────────────────────────────────────────
function permsOf(user: SessionUserRecord): Record<string, unknown> | null {
  const raw = String(user.role || '').trim();
  if (!raw || raw === 'Admin') return null; // unrestricted (same default as the old UI)
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function can(user: SessionUserRecord, type: VoucherType, action: Action): boolean {
  if (isAdminUser(user)) return true;
  const perms = permsOf(user);
  if (!perms) return true;
  const key = type === 'IN' ? 'cash-receipt' : 'cash-handover';
  const list = perms[key];
  return Array.isArray(list) && list.includes(action);
}

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

async function requirePermission(type: VoucherType, action: Action): Promise<SessionUserRecord> {
  const user = await requireUser();
  if (!can(user, type, action)) {
    throw new UnauthorizedError(`You don't have permission for ${type === 'IN' ? 'Cash In' : 'Cash Out'} vouchers.`);
  }
  return user;
}

export async function getVoucherPermissions() {
  const user = await requireUser();
  return {
    in: { create: can(user, 'IN', 'new'), view: can(user, 'IN', 'saved') },
    out: { create: can(user, 'OUT', 'new'), view: can(user, 'OUT', 'saved') },
    stats: isAdminUser(user) || !permsOf(user) || (Array.isArray(permsOf(user)?.['cash-receipt']) && (permsOf(user)!['cash-receipt'] as string[]).includes('stats')),
  };
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
function cleanLines(lines: unknown): VoucherLine[] {
  if (!Array.isArray(lines)) return [];
  const out: VoucherLine[] = [];
  const seen = new Set<string>();
  for (const l of lines as any[]) {
    const ref = String(l?.ref || '').trim();
    if (!ref) continue;
    const key = ref.toUpperCase();
    if (seen.has(key)) throw new Error(`Invoice ${ref} is listed more than once`);
    seen.add(key);
    const amount = l?.amount === '' || l?.amount === null || l?.amount === undefined ? null : round2(Number(l.amount));
    out.push({ ref, party: String(l?.party || '').trim() || undefined, amount: Number.isFinite(amount as number) ? amount : null });
  }
  return out;
}

function normalizeRow(row: any): CashVoucher {
  return {
    ...row,
    AMOUNT: Number(row.AMOUNT) || 0,
    LINES: Array.isArray(row.LINES) ? row.LINES : [],
  };
}

async function maxNumber(type: VoucherType): Promise<number> {
  const prefix = type === 'IN' ? 'RV-' : 'PV-';
  const { data, error } = await getSupabaseAdmin().from(TABLE).select('ID').ilike('ID', `${prefix}%`);
  if (error) throw new Error(error.message);
  return (data || []).reduce((max: number, r: any) => Math.max(max, parseVoucherNumber(type, r.ID) || 0), 0);
}

// ─────────────────────────────────────────────────────────────
//  Actions
// ─────────────────────────────────────────────────────────────
export async function getNextVoucherNumber(type: VoucherType): Promise<string> {
  await requirePermission(type, 'new');
  return formatVoucherNumber(type, (await maxNumber(type)) + 1);
}

export async function listVouchers(filters: { type?: VoucherType | 'ALL'; from?: string; to?: string } = {}): Promise<CashVoucher[]> {
  const user = await requireUser();
  const allowed: VoucherType[] = (['IN', 'OUT'] as VoucherType[]).filter((t) => can(user, t, 'saved'));
  const types = filters.type && filters.type !== 'ALL' ? allowed.filter((t) => t === filters.type) : allowed;
  if (types.length === 0) return [];

  let query = getSupabaseAdmin().from(TABLE).select('*').in('TYPE', types);
  if (filters.from) query = query.gte('DATE', filters.from);
  if (filters.to) query = query.lte('DATE', filters.to);
  const { data, error } = await query.order('DATE', { ascending: false }).order('CREATED_AT', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(normalizeRow);
}

export async function saveVoucher(input: VoucherInput): Promise<CashVoucher> {
  const type: VoucherType = input.TYPE === 'OUT' ? 'OUT' : 'IN';
  const user = await requirePermission(type, 'new');
  const db = getSupabaseAdmin();

  const lines = cleanLines(input.LINES);
  const amount = round2(Number(input.AMOUNT));
  if (!input.DATE) throw new Error('Date is required');
  if (!String(input.PARTY || '').trim()) throw new Error(type === 'IN' ? 'Received From is required' : 'Paid To is required');
  if (!(amount > 0)) throw new Error('Amount must be greater than zero');
  const linesSum = linesTotal(lines);
  if (linesSum > 0 && Math.abs(linesSum - amount) > 0.009) {
    throw new Error(`Invoice amounts (${linesSum.toFixed(2)}) don't match the voucher amount (${amount.toFixed(2)})`);
  }

  const record = {
    TYPE: type,
    DATE: input.DATE,
    PARTY: String(input.PARTY).trim(),
    VIA: String(input.VIA || '').trim() || null,
    AMOUNT: amount,
    AMOUNT_IN_WORDS: amountToWords(amount),
    PAYMENT_METHOD: String(input.PAYMENT_METHOD || 'Cash'),
    REFERENCE: String(input.REFERENCE || '').trim() || null,
    DESCRIPTION: String(input.DESCRIPTION || '').trim() || null,
    LINES: lines,
  };

  // Update an existing voucher (type can't change: it would change the number series)
  if (input.ID) {
    const { data: existing, error: findErr } = await db.from(TABLE).select('ID, TYPE').eq('ID', input.ID).maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (existing) {
      if (existing.TYPE !== type) throw new Error('A voucher type cannot be changed after saving');
      const { data, error } = await db
        .from(TABLE)
        .update({ ...record, UPDATED_AT: new Date().toISOString(), UPDATED_BY: user.name })
        .eq('ID', input.ID)
        .select('*')
        .single();
      if (error) throw new Error(error.message);
      return normalizeRow(data);
    }
  }

  // New voucher: take the next number; retry if someone else saved the same number meanwhile
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = formatVoucherNumber(type, (await maxNumber(type)) + 1);
    const { data, error } = await db
      .from(TABLE)
      .insert({ ID: id, ...record, CREATED_BY: user.name, CREATED_BY_ID: user.id })
      .select('*')
      .single();
    if (!error) return normalizeRow(data);
    if (error.code !== '23505') throw new Error(error.message); // not a duplicate key
  }
  throw new Error('Could not reserve a voucher number, please try again');
}

export async function deleteVoucher(id: string) {
  const db = getSupabaseAdmin();
  const { data: existing, error } = await db.from(TABLE).select('ID, TYPE').eq('ID', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!existing) return { success: true };
  await requirePermission(existing.TYPE as VoucherType, 'new');
  const { error: delErr } = await db.from(TABLE).delete().eq('ID', id);
  if (delErr) throw new Error(delErr.message);
  return { success: true };
}

/** Signature printed on the voucher: the user who created it (old vouchers: MED Sabry, as before). */
export async function getVoucherSignature(voucherId: string): Promise<string | null> {
  await requireUser();
  const db = getSupabaseAdmin();
  const { data: v } = await db.from(TABLE).select('CREATED_BY_ID').eq('ID', voucherId).maybeSingle();
  const query = v?.CREATED_BY_ID
    ? db.from('bhs_USERS').select('SIGNATURE').eq('ID', v.CREATED_BY_ID)
    : db.from('bhs_USERS').select('SIGNATURE').eq('NAME', 'MED Sabry');
  const { data } = await query.maybeSingle();
  return (data?.SIGNATURE as string) || null;
}

/** Name suggestions for the entry form. */
export async function getVoucherSuggestions() {
  await requireUser();
  const db = getSupabaseAdmin();
  const [vouchers, customers] = await Promise.all([
    db.from(TABLE).select('PARTY, VIA'),
    db.from('bhs_CUSTOMERS').select('"CUSTOMER MAIN NAME"').order('CUSTOMER MAIN NAME'),
  ]);
  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.map((s) => String(s || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  return {
    parties: uniq((vouchers.data || []).map((r: any) => r.PARTY)),
    via: uniq((vouchers.data || []).map((r: any) => r.VIA)),
    customers: uniq((customers.data || []).map((r: any) => r['CUSTOMER MAIN NAME'])),
  };
}
