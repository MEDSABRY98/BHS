import { bhs_supabas } from '@/lib/secureDb';

export interface SupplierRecord {
  ID: string;
  'SUPPLIER ID': string;
  'SUPPLIER NAME': string;
  'PAYMENT TERM'?: number;
}

export interface SupplierTransaction {
  ID: string;
  DATE: string;
  NUMBER: string;
  REFERENCE?: string;
  'SUPPLIER ID': string;
  DEBIT: number;
  CREDIT: number;
  'RESIDUAL AMOUNT': number;
  MATCHING: string;
}

const PAGE_SIZE = 1000;

/**
 * Supabase/PostgREST caps each request at 1000 rows by default.
 * Fetch page by page so no rows are silently dropped.
 */
async function fetchAllRows<T>(table: string, orderColumn: string, ascending: boolean, tieBreaker: string): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await bhs_supabas
      .from(table)
      .select('*')
      .order(orderColumn, { ascending })
      .order(tieBreaker, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

const normalizeId = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

export async function fetchSuppliersList(): Promise<SupplierRecord[]> {
  try {
    const rows = await fetchAllRows<SupplierRecord>('bhs_SUPPLIERS', 'SUPPLIER NAME', true, 'SUPPLIER ID');
    return rows.map(r => ({ ...r, 'SUPPLIER ID': normalizeId(r['SUPPLIER ID']) }));
  } catch (error) {
    console.error('Error fetching suppliers list:', error);
    throw error;
  }
}

export async function fetchSupplierTransactions(): Promise<SupplierTransaction[]> {
  try {
    const rows = await fetchAllRows<SupplierTransaction>('web_SUPPLIERS_ANALYSIS', 'DATE', false, 'ID');
    return rows.map(r => ({
      ...r,
      'SUPPLIER ID': normalizeId(r['SUPPLIER ID']),
      'RESIDUAL AMOUNT': Number(String(r['RESIDUAL AMOUNT'] ?? 0).replace(/,/g, '')) || 0,
    }));
  } catch (error: any) {
    if (error?.code === '42P01') return []; // table doesn't exist yet
    console.error('Error fetching supplier transactions:', error);
    throw error;
  }
}
