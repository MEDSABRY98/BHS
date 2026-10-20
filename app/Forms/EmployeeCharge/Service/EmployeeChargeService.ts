'use server';

// Employee Charge form (Forms module)
// Table: form_EMPLOYEE_CHARGES (RLS on, no public access) — only reachable through these actions.
// Each user sees only his own forms; the admin sees all, and only the admin edits / deletes.
// Numbering is shared by all users: EC-<year>-001, 002 … (restarts every year).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { formsOf } from '../../Shared/FormsPermissions';
import {
  EMPLOYEE_CHARGE_FORM_ID,
  amountToWords,
  formatChargeNumber,
  parseChargeNumber,
  round2,
  type EmployeeCharge,
  type EmployeeChargeInput,
  type EmployeeChargePermissions,
  type EmployeeChargeTabId,
} from '../Utils/EmployeeChargeTypes';

const TABLE = 'form_EMPLOYEE_CHARGES';
const ALL_TABS: EmployeeChargeTabId[] = ['new', 'records'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

async function permissionsOf(user: SessionUserRecord): Promise<EmployeeChargePermissions> {
  const allowed = formsOf(user).includes(EMPLOYEE_CHARGE_FORM_ID);
  return { tabs: allowed ? [...ALL_TABS] : [], admin: isAdminUser(user, 'forms') };
}

async function requireForm() {
  const user = await requireUser();
  const perms = await permissionsOf(user);
  if (!perms.tabs.length) throw new UnauthorizedError("You don't have permission for this form.");
  return { user, perms };
}

function normalize(row: any, names: Map<string, string>): EmployeeCharge {
  return {
    ...row,
    AMOUNT: Number(row.AMOUNT) || 0,
    EMPLOYEE_NO: row.EMPLOYEE_NO || null,
    CREATED_BY_NAME: names.get(String(row.CREATED_BY)) || '',
  };
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Map();
  const { data } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME').in('ID', uniq);
  return new Map((data || []).map((u: any) => [String(u.ID), String(u.NAME || '')]));
}

function cleanInput(input: EmployeeChargeInput) {
  const date = String(input?.CHARGE_DATE || '').trim();
  if (!DATE_RE.test(date)) throw new Error('Date is required');
  const name = String(input?.EMPLOYEE_NAME || '').trim().slice(0, 200);
  if (!name) throw new Error('Employee name is required');
  const amount = round2(Number(String(input?.AMOUNT ?? '').replace(/,/g, '')));
  if (!(amount > 0)) throw new Error('Amount must be greater than zero');
  const description = String(input?.DESCRIPTION || '').trim().slice(0, 4000);
  if (!description) throw new Error('Description is required');
  return {
    CHARGE_DATE: date,
    EMPLOYEE_NAME: name,
    EMPLOYEE_NO: String(input?.EMPLOYEE_NO || '').trim().slice(0, 50) || null,
    AMOUNT: amount,
    AMOUNT_IN_WORDS: amountToWords(amount),
    DESCRIPTION: description,
  };
}

async function maxNumber(year: number): Promise<number> {
  const { data, error } = await getSupabaseAdmin().from(TABLE).select('ID').like('ID', `EC-${year}-%`);
  if (error) throw new Error(error.message);
  return (data || []).reduce((max: number, r: any) => Math.max(max, parseChargeNumber(r.ID)?.num || 0), 0);
}

// ─────────────────────────────────────────────────────────────
//  Actions
// ─────────────────────────────────────────────────────────────
export async function getEmployeeChargePermissions(): Promise<EmployeeChargePermissions> {
  return permissionsOf(await requireUser());
}

/** Next number for the year of the given date (shown on the form before saving). */
export async function getNextEmployeeChargeNumber(date: string): Promise<string> {
  await requireForm();
  const year = Number(String(date || '').slice(0, 4)) || new Date().getFullYear();
  return formatChargeNumber(year, (await maxNumber(year)) + 1);
}

/** User: his own forms. Admin: all. Newest first. */
export async function listEmployeeCharges(): Promise<EmployeeCharge[]> {
  const { user, perms } = await requireForm();
  const db = getSupabaseAdmin();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(TABLE).select('*');
    if (!perms.admin) q = q.eq('CREATED_BY', String(user.id));
    const { data, error } = await q.order('CHARGE_DATE', { ascending: false }).order('ID', { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const names = await userNames(rows.map((r) => String(r.CREATED_BY)));
  return rows.map((r) => normalize(r, names));
}

export async function saveEmployeeCharge(input: EmployeeChargeInput): Promise<EmployeeCharge> {
  const db = getSupabaseAdmin();
  const record = cleanInput(input);

  // Edit (admin only). The number stays the same.
  if (input?.ID) {
    const user = await requireUser();
    if (!isAdminUser(user, 'forms', 'edit')) throw new UnauthorizedError('Only the admin can edit a saved form.');
    const { data, error } = await db
      .from(TABLE)
      .update({ ...record, UPDATED_BY: String(user.id), UPDATED_AT: new Date().toISOString() })
      .eq('ID', String(input.ID))
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return normalize(data, await userNames([String(data.CREATED_BY)]));
  }

  // New: shared numbering per year; retry if someone saved the same number meanwhile
  const { user } = await requireForm();
  const year = Number(record.CHARGE_DATE.slice(0, 4));
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = formatChargeNumber(year, (await maxNumber(year)) + 1);
    const { data, error } = await db
      .from(TABLE)
      .insert({ ID: id, ...record, CREATED_BY: String(user.id) })
      .select('*')
      .single();
    if (!error) return normalize(data, new Map([[String(user.id), String(user.name || '')]]));
    if (error.code !== '23505') throw new Error(error.message);
  }
  throw new Error('Could not reserve a form number, please try again');
}

export async function deleteEmployeeCharge(id: string): Promise<{ success: true }> {
  const user = await requireUser();
  if (!isAdminUser(user, 'forms', 'delete')) throw new UnauthorizedError('Only the admin can delete a form.');
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq('ID', String(id || ''));
  if (error) throw new Error(error.message);
  return { success: true };
}
