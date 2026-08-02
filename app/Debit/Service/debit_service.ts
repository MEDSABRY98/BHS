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

const PR_HEADER_TABLE = 'debit_PAYMENT_RECONCILIATION';
const PR_LINES_TABLE = 'debit_PAYMENT_RECONCILIATION_LINES';

export interface PaymentReconciliationSaveLine {
  customerId: string;
  invoiceNumber: string;
  openAmount: number;
  appliedAmount: number;
  remainingAmount: number;
}

export interface PaymentReconciliationSaveHeader {
  paymentDate: string | null;
  paymentAmount: number;
  paymentReference: string | null;
  customersId: string[];
  remainderNote: string | null;
}

export interface PaymentReconciliationSessionSummary {
  sessionId: string;
  savedAt: string;
  paymentDate: string | null;
  paymentAmount: number;
  paymentReference: string | null;
  totalApplied: number;
  paymentRemainder: number;
  lineCount: number;
  customerCount: number;
}

export interface PaymentReconciliationLoadedLine {
  lineNo: number;
  customerId: string;
  invoiceNumber: string;
  openAmount: number;
  appliedAmount: number;
  remainingAmount: number;
}

function parseNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseCustomersId(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

async function bulkInsertChunks(
  table: string,
  rows: Record<string, unknown>[],
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await bhs_supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

export async function generateNextPaymentReconciliationId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  const { data, error } = await bhs_supabase
    .from(PR_HEADER_TABLE)
    .select('SESSION_ID')
    .like('SESSION_ID', `${prefix}%`)
    .order('SESSION_ID', { ascending: false })
    .limit(1);

  if (error) throw error;

  let nextNum = 1;
  const latest = data?.[0]?.SESSION_ID;
  if (latest) {
    const parts = String(latest).split('-');
    const num = parseInt(parts[2] || '', 10);
    if (Number.isFinite(num)) nextNum = num + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export async function savePaymentReconciliationSession(input: {
  sessionId?: string;
  header: PaymentReconciliationSaveHeader;
  lines: PaymentReconciliationSaveLine[];
}) {
  try {
    const lines = input.lines.filter(
      (line) =>
        line.customerId.trim() &&
        line.invoiceNumber.trim() &&
        line.appliedAmount > 0.009,
    );

    if (lines.length === 0) {
      return { success: false as const, error: 'No invoice lines with applied amount to save' };
    }

    if (input.header.paymentAmount <= 0.009) {
      return { success: false as const, error: 'Payment amount must be greater than zero' };
    }

    const existingId = input.sessionId?.trim() || '';
    const isUpdate = Boolean(existingId);
    const sessionId = isUpdate ? existingId : await generateNextPaymentReconciliationId();
    const savedAt = new Date().toISOString();
    const paymentDate = input.header.paymentDate?.trim() || null;
    const customersId = [...new Set(input.header.customersId.map((id) => id.trim()).filter(Boolean))];

    const headerRow = {
      SESSION_ID: sessionId,
      PAYMENT_DATE: paymentDate,
      PAYMENT_AMOUNT: input.header.paymentAmount,
      PAYMENT_REFERENCE: input.header.paymentReference?.trim() || null,
      CUSTOMERS_ID: customersId,
      REMAINDER_NOTE: input.header.remainderNote?.trim() || null,
      SAVED_AT: savedAt,
    };

    if (isUpdate) {
      const { error: deleteLinesError } = await bhs_supabase
        .from(PR_LINES_TABLE)
        .delete()
        .eq('SESSION_ID', sessionId);

      if (deleteLinesError) throw deleteLinesError;

      const { error: updateError } = await bhs_supabase
        .from(PR_HEADER_TABLE)
        .update(headerRow)
        .eq('SESSION_ID', sessionId);

      if (updateError) throw updateError;
    } else {
      const { error: insertHeaderError } = await bhs_supabase.from(PR_HEADER_TABLE).insert(headerRow);
      if (insertHeaderError) throw insertHeaderError;
    }

    const dbLines = lines.map((line, index) => ({
      SESSION_ID: sessionId,
      LINE_NO: index + 1,
      CUSTOMER_ID: line.customerId.trim(),
      INVOICE_NUMBER: line.invoiceNumber.trim(),
      OPEN_AMOUNT: line.openAmount,
      APPLIED_AMOUNT: line.appliedAmount,
      REMAINING_AMOUNT: line.remainingAmount,
    }));

    await bulkInsertChunks(PR_LINES_TABLE, dbLines);

    return {
      success: true as const,
      sessionId,
      rowCount: dbLines.length,
      savedAt,
      updated: isUpdate,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save payment reconciliation session';
    console.error('Error in savePaymentReconciliationSession:', error);
    return { success: false as const, error: message };
  }
}

export async function fetchPaymentReconciliationSessions() {
  try {
    const { data: headers, error: headerError } = await bhs_supabase
      .from(PR_HEADER_TABLE)
      .select('SESSION_ID, PAYMENT_DATE, PAYMENT_AMOUNT, PAYMENT_REFERENCE, CUSTOMERS_ID, SAVED_AT')
      .order('SAVED_AT', { ascending: false });

    if (headerError) throw headerError;

    const { data: lineRows, error: lineError } = await bhs_supabase
      .from(PR_LINES_TABLE)
      .select('SESSION_ID, APPLIED_AMOUNT');

    if (lineError) throw lineError;

    const lineStats = new Map<string, { lineCount: number; totalApplied: number }>();
    for (const row of lineRows || []) {
      const id = String(row.SESSION_ID || '').trim();
      if (!id) continue;
      const existing = lineStats.get(id) || { lineCount: 0, totalApplied: 0 };
      existing.lineCount += 1;
      existing.totalApplied += parseNum(row.APPLIED_AMOUNT);
      lineStats.set(id, existing);
    }

    const data: PaymentReconciliationSessionSummary[] = (headers || []).map((row) => {
      const sessionId = String(row.SESSION_ID || '').trim();
      const stats = lineStats.get(sessionId) || { lineCount: 0, totalApplied: 0 };
      const paymentAmount = parseNum(row.PAYMENT_AMOUNT);
      const customersId = parseCustomersId(row.CUSTOMERS_ID);
      const paymentDateRaw = row.PAYMENT_DATE;

      return {
        sessionId,
        savedAt: String(row.SAVED_AT || ''),
        paymentDate: paymentDateRaw ? String(paymentDateRaw).split('T')[0] : null,
        paymentAmount,
        paymentReference: row.PAYMENT_REFERENCE ? String(row.PAYMENT_REFERENCE) : null,
        totalApplied: stats.totalApplied,
        paymentRemainder: paymentAmount - stats.totalApplied,
        lineCount: stats.lineCount,
        customerCount: customersId.length,
      };
    });

    return { success: true as const, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch payment reconciliation sessions';
    console.error('Error in fetchPaymentReconciliationSessions:', error);
    return { success: false as const, error: message, data: [] as PaymentReconciliationSessionSummary[] };
  }
}

export async function fetchPaymentReconciliationSession(sessionId: string) {
  try {
    const id = sessionId.trim();
    if (!id) {
      return { success: false as const, error: 'Session ID is required' };
    }

    const { data: headerRows, error: headerError } = await bhs_supabase
      .from(PR_HEADER_TABLE)
      .select('SESSION_ID, PAYMENT_DATE, PAYMENT_AMOUNT, PAYMENT_REFERENCE, CUSTOMERS_ID, REMAINDER_NOTE, SAVED_AT')
      .eq('SESSION_ID', id)
      .limit(1);

    if (headerError) throw headerError;

    const header = headerRows?.[0];
    if (!header) {
      return { success: false as const, error: 'Payment reconciliation session not found' };
    }

    const { data: lineRows, error: lineError } = await bhs_supabase
      .from(PR_LINES_TABLE)
      .select('LINE_NO, CUSTOMER_ID, INVOICE_NUMBER, OPEN_AMOUNT, APPLIED_AMOUNT, REMAINING_AMOUNT')
      .eq('SESSION_ID', id)
      .order('LINE_NO', { ascending: true });

    if (lineError) throw lineError;

    const paymentDateRaw = header.PAYMENT_DATE;
    const lines: PaymentReconciliationLoadedLine[] = (lineRows || []).map((row) => ({
      lineNo: parseNum(row.LINE_NO),
      customerId: String(row.CUSTOMER_ID || '').trim(),
      invoiceNumber: String(row.INVOICE_NUMBER || '').trim(),
      openAmount: parseNum(row.OPEN_AMOUNT),
      appliedAmount: parseNum(row.APPLIED_AMOUNT),
      remainingAmount: parseNum(row.REMAINING_AMOUNT),
    }));

    return {
      success: true as const,
      sessionId: id,
      savedAt: String(header.SAVED_AT || ''),
      paymentDate: paymentDateRaw ? String(paymentDateRaw).split('T')[0] : null,
      paymentAmount: parseNum(header.PAYMENT_AMOUNT),
      paymentReference: header.PAYMENT_REFERENCE ? String(header.PAYMENT_REFERENCE) : null,
      customersId: parseCustomersId(header.CUSTOMERS_ID),
      remainderNote: header.REMAINDER_NOTE ? String(header.REMAINDER_NOTE) : null,
      lines,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load payment reconciliation session';
    console.error('Error in fetchPaymentReconciliationSession:', error);
    return { success: false as const, error: message };
  }
}

export async function deletePaymentReconciliationSession(sessionId: string) {
  try {
    const id = sessionId.trim();
    if (!id) {
      return { success: false as const, error: 'Session ID is required' };
    }

    const { error } = await bhs_supabase.from(PR_HEADER_TABLE).delete().eq('SESSION_ID', id);
    if (error) throw error;

    return { success: true as const };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete payment reconciliation session';
    console.error('Error in deletePaymentReconciliationSession:', error);
    return { success: false as const, error: message };
  }
}
