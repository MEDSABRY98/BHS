'use server';

// Petty Cash (عهد الموظفين)
// Tables: web_PETTY_CASH (header) + web_PETTY_CASH_LINES (rows) — RLS on, no public access.
// Saved through the DB function web_save_petty_cash (number + header + all rows in one transaction).
// Each employee sees only his own petty cash; the admin sees all. No edit / delete for employees.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import {
  MAX_LINES,
  compareLines,
  PETTY_CASH_SYSTEM_ID,
  round2,
  uaeToday,
  type PettyCash,
  type PettyCashInput,
  type PettyCashLine,
  type PettyCashLineInput,
  type PettyCashPermissions,
  type PettyCashTabId,
} from '../Utils/PettyCashTypes';

const HEADERS = 'web_PETTY_CASH';
const ALL_TABS: PettyCashTabId[] = ['new', 'records'];
const SELECT = '*, LINES:web_PETTY_CASH_LINES(*)';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─────────────────────────────────────────────────────────────
//  Permissions (Admin Control → 'petty-cash', tabs: new / records)
// ─────────────────────────────────────────────────────────────
function permissionsOf(user: SessionUserRecord): PettyCashPermissions {
  if (isAdminUser(user)) return { tabs: [...ALL_TABS], viewAll: true };

  const raw = String(user.role || '').trim();
  if (!raw) return { tabs: [...ALL_TABS], viewAll: false };

  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return { tabs: [...ALL_TABS], viewAll: false };
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(PETTY_CASH_SYSTEM_ID)) return { tabs: [], viewAll: false };
  const list = perms[PETTY_CASH_SYSTEM_ID];
  const tabs = Array.isArray(list) ? ALL_TABS.filter((t) => list.includes(t)) : [...ALL_TABS];
  return { tabs, viewAll: false };
}

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

async function requireTab(tab: PettyCashTabId): Promise<{ user: SessionUserRecord; perms: PettyCashPermissions }> {
  const user = await requireUser();
  const perms = permissionsOf(user);
  if (!perms.tabs.includes(tab)) throw new UnauthorizedError("You don't have permission for this action.");
  return { user, perms };
}

/** admin = false → the ACCOUNT (and who edited) never leaves the server. */
function normalize(row: any, admin: boolean): PettyCash {
  const lines: PettyCashLine[] = (Array.isArray(row.LINES) ? row.LINES : [])
    .map((l: any) => {
      const line: any = {
        ...l,
        AMOUNT: Number(l.AMOUNT) || 0,
        IS_TAX_INVOICE: !!l.IS_TAX_INVOICE,
        HAS_INVOICE: !!l.HAS_INVOICE,
      };
      if (!admin) {
        delete line.ACCOUNT;
        delete line.UPDATED_BY;
        delete line.UPDATED_AT;
      }
      return line as PettyCashLine;
    })
    .sort(compareLines); // beneficiary, then invoice date (oldest first)
  return {
    ...row,
    LINES_COUNT: Number(row.LINES_COUNT) || lines.length,
    TOTAL_AMOUNT: Number(row.TOTAL_AMOUNT) || 0,
    TAX_AMOUNT_TOTAL: Number(row.TAX_AMOUNT_TOTAL) || 0,
    LINES: lines,
  };
}

function cleanLines(input: unknown, opts: { allowFuture?: boolean; withAccount?: boolean } = {}): PettyCashLineInput[] {
  if (!Array.isArray(input) || input.length === 0) throw new Error('Add at least one row');
  if (input.length > MAX_LINES) throw new Error(`Maximum ${MAX_LINES} rows per save`);
  const today = uaeToday();

  return input.map((l: any, i: number) => {
    const row = i + 1;
    const date = String(l?.INVOICE_DATE || '').trim();
    const description = String(l?.DESCRIPTION || '').trim();
    const beneficiary = String(l?.BENEFICIARY || '').trim();
    const amount = round2(Number(String(l?.AMOUNT ?? '').replace(/,/g, '')));

    if (!DATE_RE.test(date)) throw new Error(`Row ${row}: invoice date is required`);
    if (!opts.allowFuture && date > today) throw new Error(`Row ${row}: invoice date can't be in the future`);
    if (!description) throw new Error(`Row ${row}: description is required`);
    if (!beneficiary) throw new Error(`Row ${row}: beneficiary is required`);
    if (!(amount > 0)) throw new Error(`Row ${row}: amount must be greater than zero`);

    return {
      INVOICE_DATE: date,
      DESCRIPTION: description.slice(0, 500),
      BENEFICIARY: beneficiary.slice(0, 200),
      AMOUNT: amount,
      IS_TAX_INVOICE: !!l?.IS_TAX_INVOICE,
      HAS_INVOICE: !!l?.HAS_INVOICE,
      ...(opts.withAccount ? { ACCOUNT: String(l?.ACCOUNT || '').trim().slice(0, 200) } : {}),
    };
  });
}

// ─────────────────────────────────────────────────────────────
//  Actions
// ─────────────────────────────────────────────────────────────
export async function getPettyCashPermissions(): Promise<PettyCashPermissions> {
  const user = await requireUser();
  return permissionsOf(user);
}

/** Employee: his own petty cash. Admin: everyone's. Newest first. */
export async function listPettyCash(): Promise<PettyCash[]> {
  const { user, perms } = await requireTab('records');
  const db = getSupabaseAdmin();
  const pageSize = 500;
  const out: PettyCash[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = db.from(HEADERS).select(SELECT);
    if (!perms.viewAll) query = query.eq('CREATED_BY_ID', String(user.id));
    const { data, error } = await query.order('CREATED_AT', { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []).map((r: any) => normalize(r, perms.viewAll)));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

/** Saves all rows at once (all or nothing) and returns the new petty cash with its number. */
export async function savePettyCash(input: PettyCashInput): Promise<PettyCash> {
  const { user, perms } = await requireTab('new');
  const lines = cleanLines(input?.LINES);
  const notes = String(input?.NOTES || '').trim().slice(0, 1000);
  const db = getSupabaseAdmin();

  const { data: id, error } = await db.rpc('web_save_petty_cash', {
    p_user_name: String(user.name || '').trim() || 'Unknown',
    p_user_id: String(user.id),
    p_notes: notes || null,
    p_lines: lines,
  });
  if (error) throw new Error(error.message);

  const { data, error: readErr } = await db.from(HEADERS).select(SELECT).eq('ID', String(id)).single();
  if (readErr) throw new Error(readErr.message);
  return normalize(data, perms.viewAll);
}

/** Beneficiary / description suggestions from the user's previous rows. */
export async function getPettyCashSuggestions(): Promise<{ beneficiaries: string[]; descriptions: string[] }> {
  const { user, perms } = await requireTab('new');
  const db = getSupabaseAdmin();
  let query = db.from(HEADERS).select('LINES:web_PETTY_CASH_LINES(BENEFICIARY, DESCRIPTION)');
  if (!perms.viewAll) query = query.eq('CREATED_BY_ID', String(user.id));
  const { data, error } = await query.order('CREATED_AT', { ascending: false }).limit(300);
  if (error) return { beneficiaries: [], descriptions: [] };

  const rows = (data || []).flatMap((h: any) => (Array.isArray(h.LINES) ? h.LINES : []));
  const uniq = (arr: string[]) =>
    Array.from(new Set(arr.map((s) => String(s || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)).slice(0, 300);
  return {
    beneficiaries: uniq(rows.map((r: any) => r.BENEFICIARY)),
    descriptions: uniq(rows.map((r: any) => r.DESCRIPTION)),
  };
}

/** Admin only: deletes a petty cash and all its rows. */
export async function deletePettyCash(id: string): Promise<{ success: true }> {
  const user = await requireUser();
  if (!isAdminUser(user)) throw new UnauthorizedError('Only the admin can delete a petty cash.');
  const pcId = String(id || '').trim();
  if (!/^PC-\d{4,}$/.test(pcId)) throw new Error('Invalid petty cash number');

  const { error } = await getSupabaseAdmin().from(HEADERS).delete().eq('ID', pcId); // rows go with it (on delete cascade)
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Admin only: replace the rows of a petty cash (edit anything, set accounts, add / remove rows). */
export async function updatePettyCash(id: string, input: PettyCashInput): Promise<PettyCash> {
  const user = await requireUser();
  if (!isAdminUser(user)) throw new UnauthorizedError('Only the admin can edit a petty cash.');
  const pcId = String(id || '').trim();
  if (!/^PC-\d{4,}$/.test(pcId)) throw new Error('Invalid petty cash number');

  const lines = cleanLines(input?.LINES, { allowFuture: true, withAccount: true });
  const notes = String(input?.NOTES || '').trim().slice(0, 1000);
  const db = getSupabaseAdmin();

  const { error } = await db.rpc('web_update_petty_cash', {
    p_id: pcId,
    p_user_name: String(user.name || '').trim() || 'Admin',
    p_notes: notes || null,
    p_lines: lines,
  });
  if (error) throw new Error(error.message);

  const { data, error: readErr } = await db.from(HEADERS).select(SELECT).eq('ID', pcId).single();
  if (readErr) throw new Error(readErr.message);
  return normalize(data, true);
}

/** Admin only: accounts used before (for the Account column suggestions). */
export async function getAccountSuggestions(): Promise<string[]> {
  const user = await requireUser();
  if (!isAdminUser(user)) return [];
  const { data, error } = await getSupabaseAdmin().from('web_PETTY_CASH_LINES').select('ACCOUNT').not('ACCOUNT', 'is', null).limit(5000);
  if (error) return [];
  return Array.from(new Set((data || []).map((r: any) => String(r.ACCOUNT || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
