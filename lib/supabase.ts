import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// On the server (server actions / services) use the server-only key, so server code keeps
// working after the public anon key is locked. In the browser this key is never available
// (it is not NEXT_PUBLIC_), so browser code falls back to the anon key.
const serverKey = typeof window === 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined;

export const bhs_supabas = serverKey
  ? createClient(supabaseUrl, serverKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : createClient(supabaseUrl, supabaseAnonKey);
export const bhs_supabase = bhs_supabas;

/**
 * Reads a whole table page by page (1000 rows each).
 * Pass `orderBy` (a unique column) so pages don't overlap or skip rows —
 * without a fixed order Postgres may return rows in a different order per page.
 */
export async function fetchAllData(queryFactory: () => any, orderBy?: string) {
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = queryFactory();
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const { data, error } = await query.range(from, from + pageSize - 1);
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

/** Serialize a flag for bhs_USERS.SALES_DATA_ACCESS (text column). */
export function toTextBoolFlag(value: unknown): 'true' | 'false' {
  return parseBoolFlag(value) ? 'true' : 'false';
}

export type SessionUserLike = {
  name?: string;
  userAdmin?: string;
  salesDataAccess?: unknown;
  /** @deprecated legacy localStorage key */
  isSalesManager?: unknown;
};

/** Full sales data visibility (admin, MED Sabry, or SALES_DATA_ACCESS flag). */
export function hasSalesDataAccess(user: SessionUserLike | null | undefined): boolean {
  if (!user) return false;
  if (String(user.name || '').trim().toLowerCase() === 'med sabry') return true;
  if (String(user.userAdmin || '').trim().toLowerCase() === 'admin') return true;
  return parseBoolFlag(user.salesDataAccess ?? user.isSalesManager);
}

export type BhsUserAccessRow = {
  NAME?: string | null;
  ROLE?: string | null;
  SALES_DATA_ACCESS?: unknown;
};

/** Server-side check against a bhs_USERS row. */
export function hasSalesDataAccessFromDb(user: BhsUserAccessRow | null | undefined): boolean {
  if (!user) return false;
  if (String(user.NAME || '').trim().toLowerCase() === 'med sabry') return true;
  if (String(user.ROLE || '').trim().toLowerCase() === 'admin') return true;
  return parseBoolFlag(user.SALES_DATA_ACCESS);
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
  customerTag: string;
  customerClass: string;
  productCost: number;
  productPrice: number;
  amount: number;
  qty: number;
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

    const emails = Array.from(new Set((emailsData || []).flatMap((e: any) => splitEmails(e['EMAIL_NAME']))));
    
    return { customers: [customerId], emails };
  } catch (error) {
    console.error('Error resolving customer email targets:', error);
    return { customers: [], emails: [] };
  }
}

/** Split "a@x.com, b@y.com; c@z.com" into clean unique addresses. */
export function splitEmails(value: unknown): string[] {
  return Array.from(
    new Set(
      String(value ?? '')
        .split(/[,;\n]+/)
        .map((e) => e.trim())
        .filter(Boolean),
    ),
  );
}

/**
 * All customer emails, one entry per customer.
 * A customer has one row with comma-separated emails; if older data has more
 * than one row for the same customer, their emails are combined.
 * Throws on database errors (use getAllCustomerEmails for the old "empty on error" behaviour).
 */
export async function getAllCustomerEmailsStrict() {
  const data = await fetchAllData(() => bhs_supabase.from('debit_EMILS').select('*'), 'CUSTOMER ID');
  const byCustomer = new Map<string, { customerId: string; emails: string[] }>();
  data.forEach((row: any) => {
    const customerId = String(row['CUSTOMER ID'] ?? '').trim();
    if (!customerId) return;
    const key = normalizeCustomerKey(customerId);
    const entry = byCustomer.get(key) || { customerId, emails: [] };
    splitEmails(row['EMAIL_NAME']).forEach((e) => {
      if (!entry.emails.includes(e)) entry.emails.push(e);
    });
    byCustomer.set(key, entry);
  });
  return Array.from(byCustomer.values())
    .filter((e) => e.emails.length > 0)
    .map((e) => ({ customerId: e.customerId, email: e.emails.join(', ') }));
}

export async function getAllCustomerEmails() {
  try {
    return await getAllCustomerEmailsStrict();
  } catch (error) {
    console.error('Error fetching all customer emails:', error);
    return [];
  }
}

// --- DEBIT_EMAILS_LULU ---
export async function getLuluEmailsStrict() {
  const data = await fetchAllData(() => bhs_supabase.from('debit_EMILS_LULU').select('*'), 'CUSTOMER ID');
  return data.map((row: any) => ({
    customerId: row['CUSTOMER ID'],
    customerCode: row['CUSTOMER CODE'],
    to: row['TO:'],
    cc: row['CC:']
  }));
}

export async function getLuluEmails() {
  try {
    return await getLuluEmailsStrict();
  } catch (error) {
    console.error('Error fetching Lulu emails:', error);
    return [];
  }
}

// --- MIX_DEBIT ---
const MIX_DEBIT_COLUMNS =
  'ID, DATE, "DUE DATE", NUMBER, "CUSTOMER ID", DEBIT, CREDIT, "RESIDUAL AMOUNT", MATCHING';

export async function getMixDebit() {
  // Fetch Mix Debit data
  let debitData: any[] = [];
  let debitError = null;
  try {
    debitData = await fetchAllData(() => bhs_supabase.from('mix_DEBIT').select(MIX_DEBIT_COLUMNS), 'ID');
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
    customersData = await fetchAllData(() => bhs_supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER CITY", "CREDIT LIMIT", "PAYMENT TERM", "CUSTOMER TAG", "CUSTOMER CLASS", "ACCOUNT STATUS", "IS CUSTOMER VENDOR"'), 'CUSTOMER ID');
  } catch (err) {
    customersError = err;
  }

  const customerNameMap = new Map<string, string>();
  const customerCityMap = new Map<string, string>();
  const customerCreditLimitMap = new Map<string, number>();
  const customerPaymentTermMap = new Map<string, number>();
  const customerTagMap = new Map<string, string>();
  const customerClassMap = new Map<string, string>();
  const customerStatusMap = new Map<string, 'ACTIVE' | 'ON_HOLD'>();
  const customerVendorMap = new Map<string, boolean>();
  if (!customersError && customersData) {
    customersData.forEach((row: any) => {
      const id = row['CUSTOMER ID']?.toString().trim();
      const name = row['CUSTOMER MAIN NAME']?.toString().trim();
      const city = row['CUSTOMER CITY']?.toString().trim();
      const limit = Number(row['CREDIT LIMIT']) || 0;
      const paymentTerm = row['PAYMENT TERM'] != null ? Number(row['PAYMENT TERM']) : 90;
      const tag = row['CUSTOMER TAG']?.toString().trim();
      const custClass = row['CUSTOMER CLASS']?.toString().trim();
      const status = row['ACCOUNT STATUS'] === 'ON_HOLD' ? 'ON_HOLD' : 'ACTIVE';
      if (id) {
        if (name) customerNameMap.set(id, name);
        if (city) customerCityMap.set(id, city);
        customerCreditLimitMap.set(id, limit);
        customerPaymentTermMap.set(id, paymentTerm);
        if (tag) customerTagMap.set(id, tag);
        if (custClass) customerClassMap.set(id, custClass);
        customerStatusMap.set(id, status);
        customerVendorMap.set(id, Boolean(row['IS CUSTOMER VENDOR']));
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
      matching: row.MATCHING || '',
      creditLimit: customerCreditLimitMap.get(custId) || 0,
      paymentTerm: customerPaymentTermMap.get(custId) ?? 90,
      customerTag: customerTagMap.get(custId) || '',
      customerClass: customerClassMap.get(custId) || '',
      accountStatus: customerStatusMap.get(custId) || 'ACTIVE',
      isCustomerVendor: customerVendorMap.get(custId) || false
    };
  });
}

export async function getSheetData() {
  return getMixDebit();
}

// --- CUSTOMER EMAIL LOOKUP ---

export function normalizeCustomerKey(value: unknown): string {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

export type CustomerIdNameRow = {
  id: string;
  name: string;
};

export function buildCustomerEmailMap(
  emails: { customerId?: string; email?: string }[],
  customers: CustomerIdNameRow[] = []
): Map<string, string> {
  const emailMap = new Map<string, string>();
  const idByName = new Map<string, string>();
  const nameById = new Map<string, string>();

  for (const customer of customers) {
    const id = normalizeCustomerKey(customer.id);
    const name = normalizeCustomerKey(customer.name);
    if (id && name) {
      idByName.set(name, id);
      nameById.set(id, name);
    }
  }

  for (const item of emails) {
    if (!item?.customerId || !item.email) continue;

    const key = normalizeCustomerKey(item.customerId);
    emailMap.set(key, item.email);

    const resolvedId = idByName.get(key);
    if (resolvedId) emailMap.set(resolvedId, item.email);

    const resolvedName = nameById.get(key);
    if (resolvedName) emailMap.set(resolvedName, item.email);
  }

  return emailMap;
}

export function getCustomerEmail(
  emailMap: Map<string, string>,
  customerId: string,
  customerName?: string
): string {
  return (
    emailMap.get(normalizeCustomerKey(customerId)) ||
    (customerName ? emailMap.get(normalizeCustomerKey(customerName)) : '') ||
    ''
  );
}

export function hasCustomerEmail(
  emailMap: Map<string, string>,
  customerId: string,
  customerName?: string
): boolean {
  return !!getCustomerEmail(emailMap, customerId, customerName);
}

