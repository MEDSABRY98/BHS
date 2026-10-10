'use server';

// Financial Model data — runs on the server only (session + permission checked).
// Reads are complete (no 1000-row cap); writes need the "Data Entry" permission.

import { getSessionUser, isAdminUser, UnauthorizedError } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface FinancialAccount {
  ID: string;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  ACCOUNT_TYPE: string;
  ACCOUNT_CATEGORY: string;
  IS_ACTIVE: boolean;
  ORDER_INDEX?: number;
  STATEMENT_TYPE?: string;
  CF_DIRECTION?: 'IN' | 'OUT';
  COST_BEHAVIOR?: 'VARIABLE' | 'FIXED';
}

export interface FinancialEntry {
  ID: string;
  ACCOUNT_ID: string;
  PERIOD_MONTH: number;
  PERIOD_YEAR: number;
  ACTUAL_AMOUNT: number;
  FORECAST_AMOUNT: number;
  NOTES: string;
  STATEMENT_TYPE?: string;
}

const SYSTEM_ID = 'financial-model';
const db = () => getSupabaseAdmin();

async function requireFinancialAccess(write = false) {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (isAdminUser(user)) return user;
  let perms: any = {};
  try {
    perms = JSON.parse(String(user.role || '').trim() || '{}') || {};
  } catch {
    return user; // unparsable role -> full access (same as the UI)
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(SYSTEM_ID)) {
    throw new UnauthorizedError("You don't have access to the Financial Model.");
  }
  const tabs = perms[SYSTEM_ID];
  if (write && Array.isArray(tabs) && !tabs.includes('data_entry') && !tabs.includes('cf_data_entry')) {
    throw new UnauthorizedError("You don't have permission to change Financial Model data.");
  }
  return user;
}

/** Reads every matching row, 1000 at a time, with a fixed order. */
async function fetchAllRows<T>(build: () => any, orderBy: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build().order(orderBy, { ascending: true }).range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

function normalizeAccountTypes(data: FinancialAccount[]) {
  data.forEach((a) => {
    const type = a.ACCOUNT_TYPE?.toUpperCase().trim() || '';
    if (type === 'DIRECT EXPENSES' || type === 'DIRECT EXPENSE') a.ACCOUNT_TYPE = 'DIRECT_EXPENSE';
    else if (type === 'INDIRECT EXPENSES' || type === 'INDIRECT EXPENSE' || type === 'EXPENSE') a.ACCOUNT_TYPE = 'INDIRECT_EXPENSE';
    else if (type === 'FINANCE COST' || type === 'FINANCE COSTS') a.ACCOUNT_TYPE = 'FINANCE_COST';
    else if (type === 'REVENUES' || type === 'REVENUE') a.ACCOUNT_TYPE = 'REVENUE';
    else if (type === 'TAX' || type === 'TAXES') a.ACCOUNT_TYPE = 'TAXES';
    else if (type === 'COGS' || type === 'COST OF GOODS SOLD') a.ACCOUNT_TYPE = 'COGS';
  });
  return data;
}

export async function fetchAccounts(statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialAccount[]> {
  await requireFinancialAccess();
  try {
    const data = await fetchAllRows<FinancialAccount>(
      () => db().from('web_FIN_ACCOUNTS').select('*').eq('STATEMENT_TYPE', statementType),
      'ACCOUNT_CODE',
    );
    return normalizeAccountTypes(data);
  } catch (error) {
    console.error('Error fetching financial accounts:', error);
    throw error;
  }
}

export async function fetchEntriesByMonthYear(month: number, year: number, statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialEntry[]> {
  await requireFinancialAccess();
  try {
    return await fetchAllRows<FinancialEntry>(
      () =>
        db()
          .from('web_FIN_ENTRIES')
          .select('*')
          .eq('PERIOD_MONTH', month)
          .eq('PERIOD_YEAR', year)
          .eq('STATEMENT_TYPE', statementType),
      'ID',
    );
  } catch (error) {
    console.error('Error fetching financial entries:', error);
    throw error;
  }
}

export async function fetchEntriesByYear(year: number, statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialEntry[]> {
  await requireFinancialAccess();
  try {
    return await fetchAllRows<FinancialEntry>(
      () => db().from('web_FIN_ENTRIES').select('*').eq('PERIOD_YEAR', year).eq('STATEMENT_TYPE', statementType),
      'ID',
    );
  } catch (error) {
    console.error('Error fetching financial entries by year:', error);
    throw error;
  }
}

export async function fetchEntriesByYears(years: number[], statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialEntry[]> {
  await requireFinancialAccess();
  if (!years || years.length === 0) return [];
  try {
    return await fetchAllRows<FinancialEntry>(
      () => db().from('web_FIN_ENTRIES').select('*').in('PERIOD_YEAR', years).eq('STATEMENT_TYPE', statementType),
      'ID',
    );
  } catch (error) {
    console.error('Error fetching financial entries by years:', error);
    throw error;
  }
}

export async function createAccount(account: Omit<FinancialAccount, 'ID'>) {
  await requireFinancialAccess(true);
  const { data, error } = await db().from('web_FIN_ACCOUNTS').insert([account]).select().single();
  if (error) {
    console.error('Error creating account:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateAccount(id: string, updates: Partial<Omit<FinancialAccount, 'ID'>>) {
  await requireFinancialAccess(true);
  const { data, error } = await db().from('web_FIN_ACCOUNTS').update(updates).eq('ID', id).select().single();
  if (error) {
    console.error('Error updating account:', error);
    throw new Error(error.message);
  }
  return data;
}

export async function updateAccountOrder(updates: { id: string; order: number }[]) {
  await requireFinancialAccess(true);
  const results = await Promise.all(
    (updates || []).map((u) => db().from('web_FIN_ACCOUNTS').update({ ORDER_INDEX: u.order }).eq('ID', u.id)),
  );
  const errors = results.filter((r) => r.error).map((r) => r.error);
  if (errors.length > 0) {
    console.error('Errors updating order:', errors);
    throw new Error(errors[0]?.message || 'Failed to update some account orders');
  }
  return true;
}

export async function saveFinancialEntries(entries: Partial<FinancialEntry>[]) {
  await requireFinancialAccess(true);
  if (!entries || entries.length === 0) return [];
  // upsert on the unique constraint (ACCOUNT_ID, PERIOD_MONTH, PERIOD_YEAR), 500 rows at a time
  const saved: any[] = [];
  for (let i = 0; i < entries.length; i += 500) {
    const { data, error } = await db()
      .from('web_FIN_ENTRIES')
      .upsert(entries.slice(i, i + 500), { onConflict: 'ACCOUNT_ID,PERIOD_MONTH,PERIOD_YEAR' })
      .select();
    if (error) {
      console.error('Error saving financial entries:', error);
      throw new Error(error.message);
    }
    saved.push(...(data || []));
  }
  return saved;
}

/** Deletes an account together with its monthly entries. */
export async function deleteAccount(id: string) {
  await requireFinancialAccess(true);
  const { error: entriesError } = await db().from('web_FIN_ENTRIES').delete().eq('ACCOUNT_ID', id);
  if (entriesError) {
    console.error('Error deleting account entries:', entriesError);
    throw new Error(entriesError.message);
  }
  const { error } = await db().from('web_FIN_ACCOUNTS').delete().eq('ID', id);
  if (error) {
    console.error('Error deleting account:', error);
    throw new Error(error.message);
  }
}
