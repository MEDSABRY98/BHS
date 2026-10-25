'use server';

// Analytic Allocation
// Tables (RLS on, no public access — only reachable through these actions):
//   web_ANALYTIC_ACCOUNTS     analytic accounts
//   web_ANALYTIC_PEOPLE       people + their default split (ACCOUNTS jsonb)
//   web_ANALYTIC_ALLOCATIONS  saved allocations (archive) with PEOPLE + LINES jsonb snapshots
// Accounts and people are shared by everyone with the tab. Archive: each user sees his own, the admin sees all;
// only the admin edits / deletes a saved allocation.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import {
  ANALYTIC_SYSTEM_ID,
  byName,
  cleanSplit,
  computeAllocation,
  round2,
  type AnalyticAccount,
  type AnalyticPermissions,
  type AnalyticPerson,
  type AnalyticTabId,
  type Allocation,
  type AllocationInput,
  type AllocationPerson,
} from '../Utils/AnalyticTypes';

const ACCOUNTS = 'web_ANALYTIC_ACCOUNTS';
const PEOPLE = 'web_ANALYTIC_PEOPLE';
const ALLOCATIONS = 'web_ANALYTIC_ALLOCATIONS';
const ALL_TABS: AnalyticTabId[] = ['accounts', 'people', 'allocate', 'archive'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─────────────────────────────────────────────────────────────
//  Permissions (Admin Control → 'analytic-allocation', tabs: accounts / people / allocate / archive)
// ─────────────────────────────────────────────────────────────
function permissionsOf(user: SessionUserRecord): AnalyticPermissions {
  if (isAdminUser(user, ANALYTIC_SYSTEM_ID)) return { tabs: [...ALL_TABS], admin: true };
  const raw = String(user.role || '').trim();
  if (!raw) return { tabs: [...ALL_TABS], admin: false };
  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return { tabs: [...ALL_TABS], admin: false };
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(ANALYTIC_SYSTEM_ID)) return { tabs: [], admin: false };
  const list = perms[ANALYTIC_SYSTEM_ID];
  return { tabs: Array.isArray(list) ? ALL_TABS.filter((t) => list.includes(t)) : [...ALL_TABS], admin: false };
}

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

async function requireTab(...tabs: AnalyticTabId[]) {
  const user = await requireUser();
  const perms = permissionsOf(user);
  if (!tabs.some((t) => perms.tabs.includes(t))) throw new UnauthorizedError("You don't have permission for this action.");
  return { user, perms };
}

const cleanName = (s: unknown, max = 120) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const dupError = (error: any, what: string) => (error?.code === '23505' ? new Error(`${what} already exists`) : new Error(error?.message || 'Database error'));

export async function getAnalyticPermissions(): Promise<AnalyticPermissions> {
  return permissionsOf(await requireUser());
}

// ─────────────────────────────────────────────────────────────
//  Accounts
// ─────────────────────────────────────────────────────────────
export async function listAnalyticAccounts(): Promise<AnalyticAccount[]> {
  await requireTab(...ALL_TABS);
  const { data, error } = await getSupabaseAdmin().from(ACCOUNTS).select('ID, NAME, IS_ACTIVE');
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({ ID: Number(r.ID), NAME: String(r.NAME), IS_ACTIVE: r.IS_ACTIVE !== false })).sort((a, b) => byName(a.NAME, b.NAME));
}

export async function saveAnalyticAccount(input: { ID?: number; NAME: string; IS_ACTIVE?: boolean }): Promise<AnalyticAccount> {
  await requireTab('accounts');
  const db = getSupabaseAdmin();
  const NAME = cleanName(input?.NAME, 80);
  if (!NAME) throw new Error('Account name is required');
  const IS_ACTIVE = input?.IS_ACTIVE !== false;

  if (!input?.ID) {
    const { data, error } = await db.from(ACCOUNTS).insert({ NAME, IS_ACTIVE }).select('ID, NAME, IS_ACTIVE').single();
    if (error) throw dupError(error, `Account "${NAME}"`);
    return { ID: Number(data.ID), NAME: data.NAME, IS_ACTIVE: data.IS_ACTIVE !== false };
  }

  const { data: old, error: oldErr } = await db.from(ACCOUNTS).select('NAME').eq('ID', input.ID).single();
  if (oldErr) throw new Error(oldErr.message);
  const { data, error } = await db.from(ACCOUNTS).update({ NAME, IS_ACTIVE }).eq('ID', input.ID).select('ID, NAME, IS_ACTIVE').single();
  if (error) throw dupError(error, `Account "${NAME}"`);

  // Renamed: carry the new name into the people's default splits (saved allocations keep their snapshot)
  if (old.NAME !== NAME) {
    const { data: people } = await db.from(PEOPLE).select('ID, ACCOUNTS');
    for (const p of people || []) {
      const split = cleanSplit(p.ACCOUNTS);
      if (!split.some((s) => s.ACCOUNT === old.NAME)) continue;
      await db.from(PEOPLE).update({ ACCOUNTS: cleanSplit(split.map((s) => (s.ACCOUNT === old.NAME ? { ...s, ACCOUNT: NAME } : s))) }).eq('ID', p.ID);
    }
  }
  return { ID: Number(data.ID), NAME: data.NAME, IS_ACTIVE: data.IS_ACTIVE !== false };
}

export async function deleteAnalyticAccount(id: number): Promise<{ success: true }> {
  await requireTab('accounts');
  const db = getSupabaseAdmin();
  const { data: acc } = await db.from(ACCOUNTS).select('NAME').eq('ID', id).single();
  if (acc) {
    const { data: people } = await db.from(PEOPLE).select('NAME, ACCOUNTS');
    const users = (people || []).filter((p: any) => cleanSplit(p.ACCOUNTS).some((s) => s.ACCOUNT === acc.NAME)).map((p: any) => p.NAME);
    if (users.length) throw new Error(`"${acc.NAME}" is used by ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` +${users.length - 3}` : ''}. Remove it from them or make it inactive.`);
  }
  const { error } = await db.from(ACCOUNTS).delete().eq('ID', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
//  People
// ─────────────────────────────────────────────────────────────
const toPerson = (r: any): AnalyticPerson => ({
  ID: Number(r.ID),
  NAME: String(r.NAME),
  NOTES: String(r.NOTES || ''),
  ACCOUNTS: cleanSplit(r.ACCOUNTS),
  IS_ACTIVE: r.IS_ACTIVE !== false,
});

export async function listAnalyticPeople(): Promise<AnalyticPerson[]> {
  await requireTab(...ALL_TABS);
  const { data, error } = await getSupabaseAdmin().from(PEOPLE).select('ID, NAME, NOTES, ACCOUNTS, IS_ACTIVE');
  if (error) throw new Error(error.message);
  return (data || []).map(toPerson).sort((a, b) => byName(a.NAME, b.NAME));
}

export async function saveAnalyticPerson(input: { ID?: number; NAME: string; NOTES?: string; ACCOUNTS: unknown; IS_ACTIVE?: boolean }): Promise<AnalyticPerson> {
  await requireTab('people');
  const NAME = cleanName(input?.NAME);
  if (!NAME) throw new Error('Name is required');
  const record = {
    NAME,
    NOTES: String(input?.NOTES || '').trim().slice(0, 300),
    ACCOUNTS: cleanSplit(input?.ACCOUNTS),
    IS_ACTIVE: input?.IS_ACTIVE !== false,
    UPDATED_AT: new Date().toISOString(),
  };
  const fixed = record.ACCOUNTS.reduce((s, a) => s + (a.PCT ?? 0), 0);
  if (fixed > 100.001) throw new Error('The fixed percentages are more than 100%');
  if (record.ACCOUNTS.length && record.ACCOUNTS.every((a) => a.PCT !== null) && Math.abs(fixed - 100) > 0.001)
    throw new Error(`The percentages add up to ${round2(fixed)}%, not 100%`);

  const db = getSupabaseAdmin();
  const q = input?.ID ? db.from(PEOPLE).update(record).eq('ID', input.ID) : db.from(PEOPLE).insert(record);
  const { data, error } = await q.select('ID, NAME, NOTES, ACCOUNTS, IS_ACTIVE').single();
  if (error) throw dupError(error, `"${NAME}"`);
  return toPerson(data);
}

export async function deleteAnalyticPerson(id: number): Promise<{ success: true }> {
  await requireTab('people');
  const { error } = await getSupabaseAdmin().from(PEOPLE).delete().eq('ID', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
//  Allocations (archive)
// ─────────────────────────────────────────────────────────────
async function userNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Map();
  const { data } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME').in('ID', uniq);
  return new Map((data || []).map((u: any) => [String(u.ID), String(u.NAME || '')]));
}

const toAllocation = (r: any, names: Map<string, string>): Allocation => ({
  ID: Number(r.ID),
  TITLE: String(r.TITLE || ''),
  ALLOC_DATE: String(r.ALLOC_DATE || '').slice(0, 10),
  AMOUNT: Number(r.AMOUNT) || 0,
  NOTES: String(r.NOTES || ''),
  PEOPLE: (Array.isArray(r.PEOPLE) ? r.PEOPLE : []).map((p: any) => ({
    NAME: String(p.NAME),
    PCT: p.PCT === null || p.PCT === undefined ? null : Number(p.PCT),
    ...(p.AMOUNT !== undefined && p.AMOUNT !== null ? { AMOUNT: Number(p.AMOUNT) || 0 } : {}), // per-person amount (new style)
    SPLIT: cleanSplit(p.SPLIT),
  })),
  LINES: (Array.isArray(r.LINES) ? r.LINES : []).map((l: any) => ({ PERSON: String(l.PERSON), ACCOUNT: String(l.ACCOUNT), PCT: Number(l.PCT) || 0, AMOUNT: Number(l.AMOUNT) || 0 })),
  CREATED_BY: String(r.CREATED_BY || ''),
  CREATED_BY_NAME: names.get(String(r.CREATED_BY)) || '',
  CREATED_AT: String(r.CREATED_AT || ''),
  UPDATED_AT: r.UPDATED_AT || null,
});

export async function listAllocations(): Promise<Allocation[]> {
  const { user, perms } = await requireTab('archive');
  const db = getSupabaseAdmin();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(ALLOCATIONS).select('*');
    if (!perms.admin) q = q.eq('CREATED_BY', String(user.id));
    const { data, error } = await q.order('ALLOC_DATE', { ascending: false }).order('ID', { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const names = await userNames(rows.map((r) => String(r.CREATED_BY)));
  return rows.map((r) => toAllocation(r, names));
}

export async function saveAllocation(input: AllocationInput): Promise<Allocation> {
  const TITLE = cleanName(input?.TITLE, 150);
  if (!TITLE) throw new Error('Title is required');
  const ALLOC_DATE = String(input?.ALLOC_DATE || '').trim();
  if (!DATE_RE.test(ALLOC_DATE)) throw new Error('Date is required');
  const seen = new Set<string>();
  const perPerson = Array.isArray(input?.PEOPLE) && input.PEOPLE.some((p: any) => p?.AMOUNT !== undefined);
  const PEOPLE: AllocationPerson[] = (Array.isArray(input?.PEOPLE) ? input.PEOPLE : [])
    .map((p: any) => ({
      NAME: cleanName(p?.NAME),
      PCT: perPerson ? null : p?.PCT === null || p?.PCT === undefined ? null : Math.min(100, Math.max(0, round2(Number(p.PCT)))),
      ...(perPerson ? { AMOUNT: Math.max(0, round2(Number(p?.AMOUNT) || 0)) } : {}),
      SPLIT: cleanSplit(p?.SPLIT),
    }))
    .filter((p) => p.NAME && !seen.has(p.NAME.toLowerCase()) && seen.add(p.NAME.toLowerCase()));
  if (!PEOPLE.length) throw new Error('Choose at least one person');

  // the total is the sum of the people's amounts (old style: the typed total)
  const AMOUNT = perPerson ? round2(PEOPLE.reduce((s, p) => s + (p.AMOUNT || 0), 0)) : round2(Number(input?.AMOUNT));
  if (!(AMOUNT > 0)) throw new Error('Amount must be greater than zero');

  // Recalculated here so the archive always matches the rules
  const calc = computeAllocation(AMOUNT, PEOPLE);
  if (calc.problems.length) throw new Error(calc.problems[0]);

  const record = { TITLE, ALLOC_DATE, AMOUNT, NOTES: String(input?.NOTES || '').trim().slice(0, 1000), PEOPLE, LINES: calc.lines };
  const db = getSupabaseAdmin();

  if (input?.ID) {
    const user = await requireUser();
    if (!isAdminUser(user, ANALYTIC_SYSTEM_ID, 'edit')) throw new UnauthorizedError('Only the admin can edit a saved allocation.');
    const { data, error } = await db
      .from(ALLOCATIONS)
      .update({ ...record, UPDATED_BY: String(user.id), UPDATED_AT: new Date().toISOString() })
      .eq('ID', input.ID)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return toAllocation(data, await userNames([String(data.CREATED_BY)]));
  }

  const { user } = await requireTab('allocate');
  const { data, error } = await db.from(ALLOCATIONS).insert({ ...record, CREATED_BY: String(user.id) }).select('*').single();
  if (error) throw new Error(error.message);
  return toAllocation(data, new Map([[String(user.id), String(user.name || '')]]));
}

export async function deleteAllocation(id: number): Promise<{ success: true }> {
  const user = await requireUser();
  if (!isAdminUser(user, ANALYTIC_SYSTEM_ID, 'delete')) throw new UnauthorizedError('Only the admin can delete a saved allocation.');
  const { error } = await getSupabaseAdmin().from(ALLOCATIONS).delete().eq('ID', id);
  if (error) throw new Error(error.message);
  return { success: true };
}
