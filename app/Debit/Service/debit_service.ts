'use server';

import { bhs_supabase, getSheetData } from '@/lib/supabase';
import { InvoiceRow } from '@/types';

export interface DebitMetadata {
  success: boolean;
  rowCount: number;
  customerCount: number;
  lastUpdated: string | null;
}

export interface DebitTransactionsResult {
  success: boolean;
  total: number;
  data: InvoiceRow[];
  error?: string;
}

export interface DebitCustomersSummaryRow {
  customerId: string;
  customerName: string;
  city: string;
  creditLimit: number;
  totalDebit: number;
  totalCredit: number;
  netDebt: number;
  transactionCount: number;
  lastTransactionDate: string | null;
}

function mapDebitRpcRow(row: Record<string, unknown>): InvoiceRow {
  return {
    id: row.id as string | number,
    date: (row.date as string) || '',
    dueDate: (row.dueDate as string) || '',
    number: (row.number as string) || '',
    customerId: (row.customerId as string) || '',
    customerName: (row.customerName as string) || '',
    city: (row.city as string) || '',
    salesRep: (row.salesRep as string) || (row.city as string) || '',
    debit: Number(row.debit) || 0,
    credit: Number(row.credit) || 0,
    residualAmount: Number(row.residualAmount) || 0,
    matching: (row.matching as string) || '',
    creditLimit: Number(row.creditLimit) || 0,
  };
}

export async function getDebitData() {
  try {
    const data = await getSheetData();
    return { data };
  } catch (error) {
    console.error('Service Error getDebitData:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch debit data');
  }
}

export async function getDebitMetadata(): Promise<DebitMetadata> {
  try {
    const { data, error } = await bhs_supabase.rpc('get_debit_metadata');
    if (!error && data?.success) {
      return {
        success: true,
        rowCount: Number(data.rowCount) || 0,
        customerCount: Number(data.customerCount) || 0,
        lastUpdated: data.lastUpdated ? String(data.lastUpdated) : null,
      };
    }
    console.warn('RPC get_debit_metadata failed, falling back:', error?.message);
  } catch (err) {
    console.warn('RPC get_debit_metadata error:', err);
  }

  const { data: rows, error: fetchError } = await bhs_supabase
    .from('mix_DEBIT')
    .select('DATE, "CUSTOMER ID"')
    .order('DATE', { ascending: false })
    .limit(1);

  if (fetchError) throw fetchError;

  const { count } = await bhs_supabase
    .from('mix_DEBIT')
    .select('*', { count: 'exact', head: true });

  return {
    success: true,
    rowCount: count || 0,
    customerCount: 0,
    lastUpdated: rows?.[0]?.DATE ? String(rows[0].DATE) : null,
  };
}

export async function getDebitTransactionsPaginated(options?: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const { data, error } = await bhs_supabase.rpc('get_debit_transactions', {
      p_search: options?.search?.trim() || null,
      p_date_from: options?.dateFrom || null,
      p_date_to: options?.dateTo || null,
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0,
    });

    if (!error && data?.success) {
      const rows = Array.isArray(data.data) ? data.data.map(mapDebitRpcRow) : [];
      return {
        success: true,
        total: Number(data.total) || 0,
        data: rows,
      } satisfies DebitTransactionsResult;
    }

    console.warn('RPC get_debit_transactions failed, falling back to full fetch:', error?.message);
  } catch (err) {
    console.warn('RPC get_debit_transactions error:', err);
  }

  const { data: allData } = await getDebitData();
  let rows = allData || [];

  if (options?.dateFrom) {
    const from = new Date(`${options.dateFrom}T00:00:00`);
    rows = rows.filter((r) => {
      const d = r.date ? new Date(r.date) : null;
      return d && !Number.isNaN(d.getTime()) && d >= from;
    });
  }
  if (options?.dateTo) {
    const to = new Date(`${options.dateTo}T23:59:59`);
    rows = rows.filter((r) => {
      const d = r.date ? new Date(r.date) : null;
      return d && !Number.isNaN(d.getTime()) && d <= to;
    });
  }
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.customerName?.toLowerCase().includes(q) ||
        r.number?.toLowerCase().includes(q) ||
        r.matching?.toLowerCase().includes(q),
    );
  }

  const total = rows.length;
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 50;
  return {
    success: true,
    total,
    data: rows.slice(offset, offset + limit),
  };
}

export async function getDebitCustomersSummary(): Promise<{
  success: boolean;
  data: DebitCustomersSummaryRow[];
}> {
  try {
    const { data, error } = await bhs_supabase.rpc('get_debit_customers_aggregated');
    if (!error && Array.isArray(data)) {
      return {
        success: true,
        data: data.map((row: Record<string, unknown>) => ({
          customerId: String(row.customerId || ''),
          customerName: String(row.customerName || ''),
          city: String(row.city || ''),
          creditLimit: Number(row.creditLimit) || 0,
          totalDebit: Number(row.totalDebit) || 0,
          totalCredit: Number(row.totalCredit) || 0,
          netDebt: Number(row.netDebt) || 0,
          transactionCount: Number(row.transactionCount) || 0,
          lastTransactionDate: row.lastTransactionDate ? String(row.lastTransactionDate) : null,
        })),
      };
    }
    console.warn('RPC get_debit_customers_aggregated failed:', error?.message);
  } catch (err) {
    console.warn('RPC get_debit_customers_aggregated error:', err);
  }
  return { success: false, data: [] };
}

export async function getDebitPaymentsSummary(options?: { dateFrom?: string; dateTo?: string }) {
  try {
    const { data, error } = await bhs_supabase.rpc('get_debit_payments_summary', {
      p_date_from: options?.dateFrom || null,
      p_date_to: options?.dateTo || null,
    });
    if (!error && data?.success) {
      return data;
    }
    console.warn('RPC get_debit_payments_summary failed:', error?.message);
  } catch (err) {
    console.warn('RPC get_debit_payments_summary error:', err);
  }
  return { success: false, totalPayments: 0, totalAmount: 0, data: [] };
}
