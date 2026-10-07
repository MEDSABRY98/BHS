import { bhs_supabas } from '@/lib/supabase';

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

export async function fetchAccounts(statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialAccount[]> {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ACCOUNTS')
    .select('*')
    .eq('STATEMENT_TYPE', statementType)
    .order('ACCOUNT_CODE', { ascending: true });

  if (error) {
    console.error('Error fetching financial accounts:', error);
    throw error;
  }
  if (data) {
    data.forEach(a => {
      const type = a.ACCOUNT_TYPE?.toUpperCase().trim() || '';
      if (type === 'DIRECT EXPENSES' || type === 'DIRECT EXPENSE') a.ACCOUNT_TYPE = 'DIRECT_EXPENSE';
      else if (type === 'INDIRECT EXPENSES' || type === 'INDIRECT EXPENSE' || type === 'EXPENSE') a.ACCOUNT_TYPE = 'INDIRECT_EXPENSE';
      else if (type === 'FINANCE COST' || type === 'FINANCE COSTS') a.ACCOUNT_TYPE = 'FINANCE_COST';
      else if (type === 'REVENUES' || type === 'REVENUE') a.ACCOUNT_TYPE = 'REVENUE';
      else if (type === 'TAX' || type === 'TAXES') a.ACCOUNT_TYPE = 'TAXES';
      else if (type === 'COGS' || type === 'COST OF GOODS SOLD') a.ACCOUNT_TYPE = 'COGS';
    });
  }
  
  return data || [];
}

export async function fetchEntriesByMonthYear(month: number, year: number, statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialEntry[]> {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ENTRIES')
    .select('*')
    .eq('PERIOD_MONTH', month)
    .eq('PERIOD_YEAR', year)
    .eq('STATEMENT_TYPE', statementType);

  if (error) {
    console.error('Error fetching financial entries:', error);
    throw error;
  }
  return data || [];
}

export async function fetchEntriesByYear(year: number, statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialEntry[]> {
  const { data, error } = await bhs_supabas
    .from('web_FIN_ENTRIES')
    .select('*')
    .eq('PERIOD_YEAR', year)
    .eq('STATEMENT_TYPE', statementType);

  if (error) {
    console.error('Error fetching financial entries by year:', error);
    throw error;
  }
  return data || [];
}

export async function fetchEntriesByYears(years: number[], statementType: 'PL' | 'CF' = 'PL'): Promise<FinancialEntry[]> {
  if (!years || years.length === 0) return [];
  const { data, error } = await bhs_supabas
    .from('web_FIN_ENTRIES')
    .select('*')
    .in('PERIOD_YEAR', years)
    .eq('STATEMENT_TYPE', statementType);

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

export async function updateAccountOrder(updates: { id: string, order: number }[]) {
  // Supabase doesn't have bulk update natively in the JS client without RPC, 
  // so we'll do it sequentially or use Promise.all.
  const promises = updates.map(u => 
    bhs_supabas.from('web_FIN_ACCOUNTS').update({ ORDER_INDEX: u.order }).eq('ID', u.id)
  );
  
  const results = await Promise.all(promises);
  const errors = results.filter(r => r.error).map(r => r.error);
  
  if (errors.length > 0) {
    console.error('Errors updating order:', errors);
    throw new Error(errors[0]?.message || 'Failed to update some account orders');
  }
  return true;
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
export async function deleteAccount(id: string) {
  const { error } = await bhs_supabas
    .from('web_FIN_ACCOUNTS')
    .delete()
    .eq('ID', id);
  if (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
}
