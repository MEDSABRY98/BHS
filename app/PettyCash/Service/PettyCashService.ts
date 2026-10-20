'use server';

// Petty Cash (عهد الموظفين)
// Tables: web_PETTY_CASH (header) + web_PETTY_CASH_LINES (rows) — RLS on, no public access.
// Saved through the DB function web_save_petty_cash: rows are added to the employee's OPEN petty cash
// (opened automatically). The employee edits / removes his rows while it is OPEN, then submits it for
// settlement (SUBMITTED → locked for him). The admin settles it (SETTLED) and can edit / delete anything.
// Each employee sees only his own petty cash; the admin sees all.
// EMPLOYEE_NAME = the employee the petty cash is for (any name; the admin can type / pick it, an employee
// always records for himself). CREATED_BY = who recorded it and owns it. One OPEN per (creator, employee name).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import {
  MAX_LINES,
  MAX_OPEN_LINES,
  compareLines,
  PETTY_CASH_SYSTEM_ID,
  round2,
  uaeToday,
  type PettyCash,
  type PettyCashInput,
  type PettyCashLine,
  type PettyCashLineInput,
  type PettyCashPermissions,
  type PettyCashStatus,
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
  if (isAdminUser(user, PETTY_CASH_SYSTEM_ID)) return { tabs: [...ALL_TABS, 'analysis'], viewAll: true }; // Analysis (upload an Excel): admin only

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
function normalize(row: any, admin: boolean, userId: string): PettyCash {
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
    EMPLOYEE_NAME: String(row.EMPLOYEE_NAME || row.CREATED_BY || ''),
    LINES_COUNT: Number(row.LINES_COUNT) || lines.length,
    TOTAL_AMOUNT: Number(row.TOTAL_AMOUNT) || 0,
    TAX_AMOUNT_TOTAL: Number(row.TAX_AMOUNT_TOTAL) || 0,
    STATUS: (['OPEN', 'SUBMITTED', 'SETTLED'].includes(row.STATUS) ? row.STATUS : 'SUBMITTED') as PettyCashStatus,
    MINE: String(row.CREATED_BY_ID) === String(userId),
    LINES: lines,
  };
}

function cleanLines(input: unknown, opts: { allowFuture?: boolean; withAccount?: boolean; max?: number } = {}): PettyCashLineInput[] {
  const max = opts.max ?? MAX_LINES;
  if (!Array.isArray(input) || input.length === 0) throw new Error('Add at least one row');
  if (input.length > max) throw new Error(`Maximum ${max} rows`);
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
      ...(Number.isInteger(Number(l?.LINE_ID)) && Number(l?.LINE_ID) > 0 ? { LINE_ID: Number(l.LINE_ID) } : {}),
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
    out.push(...(data || []).map((r: any) => normalize(r, perms.viewAll, String(user.id))));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

/** Admin only: names for the Employee box - every user + every employee name used before (A-Z). */
export async function listPettyCashEmployees(): Promise<string[]> {
  const user = await requireUser();
  if (!isAdminUser(user, PETTY_CASH_SYSTEM_ID)) return [];
  const db = getSupabaseAdmin();
  const names = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('bhs_USERS').select('NAME').order('ID', { ascending: true }).range(from, from + 999);
    if (error) break;
    (data || []).forEach((u: any) => u.NAME && names.add(String(u.NAME).trim()));
    if (!data || data.length < 1000) break;
  }
  const { data: used } = await db.from(HEADERS).select('EMPLOYEE_NAME').not('EMPLOYEE_NAME', 'is', null).limit(5000);
  (used || []).forEach((r: any) => r.EMPLOYEE_NAME && names.add(String(r.EMPLOYEE_NAME).trim()));
  return Array.from(names).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Adds the rows (all or nothing) to the employee's open petty cash — opens a new one if he has none. */
export async function savePettyCash(input: PettyCashInput): Promise<PettyCash> {
  const { user, perms } = await requireTab('new');
  const lines = cleanLines(input?.LINES);
  const notes = String(input?.NOTES || '').trim().slice(0, 1000);
  const userName = String(user.name || '').trim() || 'Unknown';
  // admin: the typed / picked name (default himself). Everybody else: null = himself, his open petty cash
  const employee = isAdminUser(user, PETTY_CASH_SYSTEM_ID) ? String(input?.EMPLOYEE_NAME || '').trim().slice(0, 200) || userName : null;
  const db = getSupabaseAdmin();

  const { data: id, error } = await db.rpc('web_save_petty_cash_for', {
    p_employee_name: employee,
    p_user_id: String(user.id),
    p_user_name: String(user.name || '').trim() || 'Unknown',
    p_notes: notes || null,
    p_lines: lines,
  });
  if (error) throw new Error(error.message);

  const { data, error: readErr } = await db.from(HEADERS).select(SELECT).eq('ID', String(id)).single();
  if (readErr) throw new Error(readErr.message);
  return normalize(data, perms.viewAll, String(user.id));
}

/** The user's open petty cash (number, rows, total) — shown on the New tab. Admin: the one for this employee name. */
export async function getMyOpenPettyCash(employeeName?: string): Promise<{ ID: string; LINES_COUNT: number; TOTAL_AMOUNT: number } | null> {
  const { user } = await requireTab('new');
  const name = isAdminUser(user, PETTY_CASH_SYSTEM_ID) ? String(employeeName || '').trim() || String(user.name || '').trim() : '';
  const { data: rows, error } = await getSupabaseAdmin()
    .from(HEADERS)
    .select('ID, LINES_COUNT, TOTAL_AMOUNT, EMPLOYEE_NAME, CREATED_BY')
    .eq('CREATED_BY_ID', String(user.id))
    .eq('STATUS', 'OPEN')
    .order('CREATED_AT', { ascending: true });
  if (error || !rows?.length) return null;
  const key = name.toLowerCase();
  const data = name
    ? rows.find((r: any) => String(r.EMPLOYEE_NAME || r.CREATED_BY || '').trim().toLowerCase() === key)
    : rows[0];
  if (!data) return null;
  return { ID: String(data.ID), LINES_COUNT: Number(data.LINES_COUNT) || 0, TOTAL_AMOUNT: Number(data.TOTAL_AMOUNT) || 0 };
}

async function readHeader(id: string): Promise<{ ID: string; CREATED_BY_ID: string; STATUS: string }> {
  const pcId = String(id || '').trim();
  if (!/^PC-\d{4,}$/.test(pcId)) throw new Error('Invalid petty cash number');
  const { data, error } = await getSupabaseAdmin().from(HEADERS).select('ID, CREATED_BY_ID, STATUS').eq('ID', pcId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`${pcId} not found`);
  return data as any;
}

/** Owner only: OPEN → SUBMITTED (locked for him from now on). */
export async function submitPettyCash(id: string): Promise<PettyCash> {
  const user = await requireUser();
  const head = await readHeader(id);
  if (String(head.CREATED_BY_ID) !== String(user.id)) throw new UnauthorizedError('You can only submit your own petty cash.');
  if (head.STATUS !== 'OPEN') throw new Error(`${head.ID} is already submitted`);

  const db = getSupabaseAdmin();
  const { error } = await db
    .from(HEADERS)
    .update({ STATUS: 'SUBMITTED', SUBMITTED_AT: new Date().toISOString() })
    .eq('ID', head.ID)
    .eq('STATUS', 'OPEN');
  if (error) throw new Error(error.message);

  const { data, error: readErr } = await db.from(HEADERS).select(SELECT).eq('ID', head.ID).single();
  if (readErr) throw new Error(readErr.message);
  return normalize(data, isAdminUser(user, PETTY_CASH_SYSTEM_ID), String(user.id));
}

/** Admin only: change the status (Settle, undo settle, reopen). */
export async function setPettyCashStatus(id: string, status: PettyCashStatus): Promise<PettyCash> {
  const user = await requireUser();
  if (!isAdminUser(user, PETTY_CASH_SYSTEM_ID, 'edit')) throw new UnauthorizedError('Only the admin can settle a petty cash.');
  if (!['OPEN', 'SUBMITTED', 'SETTLED'].includes(status)) throw new Error('Invalid status');
  const head = await readHeader(id);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { STATUS: status };
  if (status === 'SETTLED') Object.assign(patch, { SETTLED_BY: String(user.name || '').trim() || 'Admin', SETTLED_AT: now });
  else Object.assign(patch, { SETTLED_BY: null, SETTLED_AT: null });
  if (status === 'OPEN') patch.SUBMITTED_AT = null;
  if (status !== 'OPEN' && head.STATUS === 'OPEN') patch.SUBMITTED_AT = now;

  const db = getSupabaseAdmin();
  const { error } = await db.from(HEADERS).update(patch).eq('ID', head.ID);
  if (error) {
    if ((error as any).code === '23505') throw new Error('This employee already has an open petty cash');
    throw new Error(error.message);
  }
  const { data, error: readErr } = await db.from(HEADERS).select(SELECT).eq('ID', head.ID).single();
  if (readErr) throw new Error(readErr.message);
  return normalize(data, true, String(user.id));
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

/** Admin: any petty cash. Employee: only his own while it is OPEN. Rows go with it. */
export async function deletePettyCash(id: string): Promise<{ success: true }> {
  const user = await requireUser();
  const head = await readHeader(id);
  if (!isAdminUser(user, PETTY_CASH_SYSTEM_ID, 'delete') && !(String(head.CREATED_BY_ID) === String(user.id) && head.STATUS === 'OPEN')) {
    throw new UnauthorizedError('Only the admin can delete a submitted petty cash.');
  }
  const pcId = head.ID;

  const { error } = await getSupabaseAdmin().from(HEADERS).delete().eq('ID', pcId); // rows go with it (on delete cascade)
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Replace the rows of a petty cash.
 * Admin: anything (accounts too). Employee: only his own OPEN one — the accounts the admin set stay on the same rows.
 */
export async function updatePettyCash(id: string, input: PettyCashInput): Promise<PettyCash> {
  const user = await requireUser();
  const admin = isAdminUser(user, PETTY_CASH_SYSTEM_ID, 'edit');
  const head = await readHeader(id);
  if (!admin && !(String(head.CREATED_BY_ID) === String(user.id) && head.STATUS === 'OPEN')) {
    throw new UnauthorizedError('A submitted petty cash can only be edited by the admin.');
  }
  const pcId = head.ID;
  const db = getSupabaseAdmin();

  let lines = cleanLines(input?.LINES, { allowFuture: admin, withAccount: admin, max: MAX_OPEN_LINES });
  if (!admin) {
    // keep the account of each saved row the employee didn't remove
    const { data: old } = await db.from('web_PETTY_CASH_LINES').select('ID, ACCOUNT').eq('PETTY_CASH_ID', pcId);
    const accounts = new Map((old || []).map((r: any) => [Number(r.ID), String(r.ACCOUNT || '')]));
    lines = lines.map((l) => ({ ...l, ACCOUNT: (l.LINE_ID && accounts.get(l.LINE_ID)) || '' }));
  }
  const notes = String(input?.NOTES || '').trim().slice(0, 1000);

  // admin: the employee name can be changed too (empty = keep it)
  const employee = admin ? String(input?.EMPLOYEE_NAME || '').trim().slice(0, 200) : '';
  if (employee) {
    const { error: nameErr } = await db.from(HEADERS).update({ EMPLOYEE_NAME: employee }).eq('ID', pcId);
    if (nameErr) {
      if ((nameErr as any).code === '23505') throw new Error(`There is already an open petty cash for ${employee} - add the rows there or submit it first`);
      throw new Error(nameErr.message);
    }
  }

  const { error } = await db.rpc('web_update_petty_cash', {
    p_id: pcId,
    p_user_name: String(user.name || '').trim() || 'Unknown',
    p_notes: notes || null,
    p_lines: lines,
  });
  if (error) throw new Error(error.message);

  const { data, error: readErr } = await db.from(HEADERS).select(SELECT).eq('ID', pcId).single();
  if (readErr) throw new Error(readErr.message);
  return normalize(data, admin, String(user.id));
}

/** Admin only: accounts used before (for the Account column suggestions). */
export async function getAccountSuggestions(): Promise<string[]> {
  const user = await requireUser();
  if (!isAdminUser(user, PETTY_CASH_SYSTEM_ID)) return [];
  const { data, error } = await getSupabaseAdmin().from('web_PETTY_CASH_LINES').select('ACCOUNT').not('ACCOUNT', 'is', null).limit(5000);
  if (error) return [];
  return Array.from(new Set((data || []).map((r: any) => String(r.ACCOUNT || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}
