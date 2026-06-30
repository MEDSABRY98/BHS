import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const bhs_supabas = createClient(supabaseUrl, supabaseAnonKey);
export const bhs_supabase = bhs_supabas;

export async function fetchAllData(queryFactory: () => any) {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
}

/** Parse DB flags stored as boolean, text ("true"/"TRUE"/"t"), or null. */
export function parseBoolFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === 't' || normalized === 'yes' || normalized === '1';
}

/** Serialize a flag for bhs_USERS.IS_SALESMANAGER (text column). */
export function toTextBoolFlag(value: unknown): 'true' | 'false' {
  return parseBoolFlag(value) ? 'true' : 'false';
}

/** Users assigned on LPO invoices (any USER_TYPE), resolved from app_lpos_DRIVERS. */
export async function fetchAssignedDrivers() {
  const assignments = await fetchAllData(() =>
    bhs_supabas.from('app_lpos_DRIVERS').select('DRIVERS_NAME')
  );

  const driverIds = [...new Set(
    assignments.map((a) => a.DRIVERS_NAME).filter(Boolean)
  )] as string[];

  if (driverIds.length === 0) return [];

  const { data: users, error } = await bhs_supabas
    .from('bhs_USERS')
    .select('*')
    .in('ID', driverIds)
    .order('NAME');

  if (error) throw error;

  const knownIds = new Set((users || []).map((u) => u.ID));
  const extras = driverIds
    .filter((id) => !knownIds.has(id))
    .map((id) => ({ ID: id, NAME: id }));

  return [...(users || []), ...extras].sort((a, b) =>
    String(a.NAME || '').localeCompare(String(b.NAME || ''))
  );
}


console.log('Supabase initialized with URL:', supabaseUrl?.substring(0, 20) + '...');
console.log('Supabase initialized with URL:', supabaseUrl?.substring(0, 20) + '...');
console.log('Supabase Key exists:', !!supabaseAnonKey);

export interface SalesInvoice {
  invoiceDate: string;
  invoiceNumber: string;
  customerId: string;
  customerMainName: string;
  customerName: string;
  area: string;
  market: string;
  merchandiser: string;
  salesRep: string;
  productId: string;
  barcode: string;
  product: string;
  productTag: string;
  productCost: number;
  productPrice: number;
  amount: number;
  qty: number;
}



export async function getSupplierData(): Promise<any[]> {
  return [];
}

export async function getSuppliersMatchingData(): Promise<any[]> {
  return [];
}

// --- DEBIT_NOTES ---
export async function getNotes(customerId?: string) {
  let data: any[] = [];
  let error: any = null;
  try {
    data = await fetchAllData(() => {
      let q = bhs_supabase.from('debit_NOTES').select('*').order('CREATED_AT', { ascending: false });
      if (customerId) {
        q = q.eq('CUSTOMER ID', customerId);
      }
      return q;
    });
  } catch (err) {
    error = err;
  }
  if (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
  return data.map(row => ({
    id: row.ID,
    customerId: row['CUSTOMER ID'],
    content: row.NOTES,
    isSolved: row['SOLVED?'],
    timestamp: row.CREATED_AT
  }));
}

export async function addNote(customerId: string, content: string, isSolved: boolean = false) {
  const { error } = await bhs_supabase.from('debit_NOTES').insert({
    'CUSTOMER ID': customerId,
    'NOTES': content,
    'SOLVED?': isSolved
  });
  if (error) {
    console.error('Error adding note:', error);
    throw error;
  }
  return { success: true };
}

export async function updateNote(id: string, content: string, isSolved?: boolean) {
  const updateData: any = { 'NOTES': content };
  if (isSolved !== undefined) updateData['SOLVED?'] = isSolved;
  
  const { error } = await bhs_supabase.from('debit_NOTES').update(updateData).eq('ID', id);
  if (error) {
    console.error('Error updating note:', error);
    throw error;
  }
  return { success: true };
}

export async function deleteNoteRow(id: string) {
  const { error } = await bhs_supabase.from('debit_NOTES').delete().eq('ID', id);
  if (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
  return { success: true };
}

// --- DEBIT_EMAILS ---
export async function resolveCustomerEmailTargets(customerId: string) {
  try {
    const { data: emailsData, error: emailsError } = await bhs_supabase
      .from('debit_EMILS')
      .select('EMAIL_NAME')
      .eq('CUSTOMER ID', customerId);
      
    if (emailsError) throw emailsError;

    const emails = emailsData ? emailsData.map((e: any) => e['EMAIL_NAME']).filter(Boolean) : [];
    
    return { customers: [customerId], emails };
  } catch (error) {
    console.error('Error resolving customer email targets:', error);
    return { customers: [], emails: [] };
  }
}

export async function getAllCustomerEmails() {
  let data: any[] = [];
  let error: any = null;
  try {
    data = await fetchAllData(() => bhs_supabase.from('debit_EMILS').select('*'));
  } catch (err) {
    error = err;
  }
  if (error) {
    console.error('Error fetching all customer emails:', error);
    return [];
  }
  return data.map(row => ({
    customerId: row['CUSTOMER ID'],
    email: row['EMAIL_NAME']
  }));
}

// --- DEBIT_EMAILS_LULU ---
export async function getLuluEmails() {
  let data: any[] = [];
  let error: any = null;
  try {
    data = await fetchAllData(() => bhs_supabase.from('debit_EMILS_LULU').select('*'));
  } catch (err) {
    error = err;
  }
  if (error) {
    console.error('Error fetching Lulu emails:', error);
    return [];
  }
  return data.map(row => ({
    customerId: row['CUSTOMER ID'],
    customerCode: row['CUSTOMER CODE'],
    to: row['TO:'],
    cc: row['CC:']
  }));
}

// --- MIX_DEBIT ---
export async function getMixDebit() {
  // Fetch Mix Debit data
  let debitData: any[] = [];
  let debitError = null;
  try {
    debitData = await fetchAllData(() => bhs_supabase.from('mix_DEBIT').select('*'));
  } catch (err) {
    debitError = err;
  }
  if (debitError) {
    console.error('Error fetching mix_DEBIT:', debitError);
    return [];
  }

  let customersData: any[] = [];
  let customersError = null;
  try {
    customersData = await fetchAllData(() => bhs_supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER CITY"'));
  } catch (err) {
    customersError = err;
  }

  const customerNameMap = new Map<string, string>();
  const customerCityMap = new Map<string, string>();
  if (!customersError && customersData) {
    customersData.forEach((row: any) => {
      const id = row['CUSTOMER ID']?.toString().trim();
      const name = row['CUSTOMER MAIN NAME']?.toString().trim();
      const city = row['CUSTOMER CITY']?.toString().trim();
      if (id) {
        if (name) customerNameMap.set(id, name);
        if (city) customerCityMap.set(id, city);
      }
    });
  } else if (customersError) {
    console.error('Error fetching bhs_CUSTOMERS:', customersError);
  }

  return debitData.map((row) => {
    const custId = row['CUSTOMER ID']?.toString().trim() || '';
    const mappedName = customerNameMap.get(custId) || custId || '';
    const mappedCity = customerCityMap.get(custId) || row.CITY || '';

    return {
      id: row.ID,
      date: row.DATE,
      dueDate: row['DUE DATE'],
      number: row.NUMBER || '',
      customerId: custId,
      customerName: mappedName, // Mapped from bhs_CUSTOMERS
      city: mappedCity,
      salesRep: mappedCity, // Map CITY to salesRep for frontend compatibility
      debit: Number(row.DEBIT) || 0,
      credit: Number(row.CREDIT) || 0,
      residualAmount: Number(row['RESIDUAL AMOUNT']) || 0,
      matching: row.MATCHING || ''
    };
  });
}

export async function getSheetData() {
  return getMixDebit();
}
