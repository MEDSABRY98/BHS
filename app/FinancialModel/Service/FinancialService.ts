import { bhs_supabas } from '@/lib/supabase';

export interface FinancialAccount {
  ID: string;
  ACCOUNT_CODE: string;
  ACCOUNT_NAME: string;
  ACCOUNT_TYPE: string;
  ACCOUNT_CATEGORY: string;
  IS_ACTIVE: boolean;
}

export interface FinancialEntry {
  ID: string;
  ACCOUNT_ID: string;
  PERIOD_MONTH: number;
  PERIOD_YEAR: number;
  ACTUAL_AMOUNT: number;
  FORECAST_AMOUNT: number;
  NOTES: string;
}

export async function fetchAccounts(): Promise<FinancialAccount[]> {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ACCOUNTS')
    .select('*')
    .order('ACCOUNT_CODE', { ascending: true });

  if (error) {
    console.error('Error fetching financial accounts:', error);
    throw error;
  }
  
  return (data || []).map((acc: any) => ({
    ...acc,
    ACCOUNT_TYPE: (acc.ACCOUNT_TYPE === 'DIRECT_EXPENSE' || acc.ACCOUNT_TYPE === 'INDIRECT_EXPENSE') 
      ? 'EXPENSE' 
      : acc.ACCOUNT_TYPE
  }));
}

export async function fetchEntriesByMonthYear(month: number, year: number): Promise<FinancialEntry[]> {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ENTRIES')
    .select('*')
    .eq('PERIOD_MONTH', month)
    .eq('PERIOD_YEAR', year);

  if (error) {
    console.error('Error fetching financial entries:', error);
    throw error;
  }
  return data || [];
}

export async function fetchEntriesByYear(year: number): Promise<FinancialEntry[]> {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ENTRIES')
    .select('*')
    .eq('PERIOD_YEAR', year);

  if (error) {
    console.error('Error fetching financial entries by year:', error);
    throw error;
  }
  return data || [];
}

export async function fetchEntriesByYears(years: number[]): Promise<FinancialEntry[]> {
  if (!years || years.length === 0) return [];
  const { data, error } = await bhs_supabas
    .from('web_FIN_ENTRIES')
    .select('*')
    .in('PERIOD_YEAR', years);

  if (error) {
    console.error('Error fetching financial entries by years:', error);
    throw error;
  }
  return data || [];
}

export async function createAccount(account: Omit<FinancialAccount, 'ID'>) {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ACCOUNTS')
    .insert([account])
    .select()
    .single();

  if (error) {
    console.error('Error creating account:', error);
    throw error;
  }
  return data;
}

export async function updateAccount(id: string, updates: Partial<Omit<FinancialAccount, 'ID'>>) {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ACCOUNTS')
    .update(updates)
    .eq('ID', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating account:', error);
    throw error;
  }
  return data;
}

export async function saveFinancialEntries(entries: Partial<FinancialEntry>[]) {
  // We use upsert on the unique constraint (ACCOUNT_ID, PERIOD_MONTH, PERIOD_YEAR)
  const { data, error } = await bhs_supabas
    .from('web_FIN_ENTRIES')
    .upsert(entries, { onConflict: 'ACCOUNT_ID,PERIOD_MONTH,PERIOD_YEAR' })
    .select();

  if (error) {
    console.error('Error saving financial entries:', error);
    throw error;
  }
  return data;
}
