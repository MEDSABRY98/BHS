'use server';
import { requireSession, getSessionUser, isAdminUser, UnauthorizedError } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

import { bhs_supabase, getSheetData } from '@/lib/supabase';
import { InvoiceRow } from '@/types';
import { applyDebitScope, buildDebitScope, hasFullDebitAccess, type DebitScope } from './debit_scope';

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

// ─────────────────────────────────────────────────────────────
//  Tab permissions (same rules as the sidebar: role JSON -> debit / debit_tabs)
// ─────────────────────────────────────────────────────────────
async function requireDebitTab(...tabIds: string[]) {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (isAdminUser(user)) return user;
  try {
    const perms = JSON.parse(String(user.role || '').trim() || '{}');
    const allowed = perms?.debit || perms?.debit_tabs;
    if (Array.isArray(allowed) && !tabIds.some((id) => allowed.includes(id))) {
      throw new UnauthorizedError("You don't have permission for this action.");
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    // unparsable role -> full access (same as the UI)
  }
  return user;
}

const db = () => getSupabaseAdmin();

/** null = full access; otherwise the rules that give the user's share of the ledger. */
async function getDebitScope(): Promise<DebitScope | null> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (hasFullDebitAccess(user)) return null;
  return buildDebitScope(user);
}

/** Customer Terms: save payment term / credit limit / status (+ same payment term for the customer's main name and tag). */
export async function updateCustomerTerms(input: {
  customerId: string;
  paymentTerm: number;
  creditLimit: number;
  accountStatus: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireDebitTab('credit-limit');
    const customerId = String(input.customerId || '').trim();
    if (!customerId) return { success: false, error: 'Customer ID is missing' };

    const paymentTerm = Number(input.paymentTerm);
    const creditLimit = Number(input.creditLimit);
    if (!Number.isFinite(paymentTerm) || paymentTerm < 0) return { success: false, error: 'Invalid payment term' };
    if (!Number.isFinite(creditLimit) || creditLimit < 0) return { success: false, error: 'Invalid credit limit' };
    const accountStatus = input.accountStatus === 'ON_HOLD' ? 'ON_HOLD' : 'ACTIVE';

    const { data: cust, error: fetchErr } = await db()
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER MAIN NAME", "CUSTOMER TAG"')
      .eq('CUSTOMER ID', customerId)
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!cust) return { success: false, error: 'Customer not found' };

    const { data: updated, error: updErr } = await db()
      .from('bhs_CUSTOMERS')
      .update({ 'PAYMENT TERM': paymentTerm, 'CREDIT LIMIT': creditLimit, 'ACCOUNT STATUS': accountStatus })
      .eq('CUSTOMER ID', customerId)
      .select('"CUSTOMER ID"');
    if (updErr) throw updErr;
    if (!updated || updated.length === 0) return { success: false, error: 'Nothing was saved (no permission on the customers table?)' };

    const mainName = String(cust['CUSTOMER MAIN NAME'] || '').trim();
    if (mainName) {
      const { error } = await db().from('bhs_CUSTOMERS').update({ 'PAYMENT TERM': paymentTerm }).eq('CUSTOMER MAIN NAME', mainName);
      if (error) throw error;
    }
    const tag = String(cust['CUSTOMER TAG'] || '').trim();
    if (tag) {
      const { error } = await db().from('bhs_CUSTOMERS').update({ 'PAYMENT TERM': paymentTerm }).eq('CUSTOMER TAG', tag);
      if (error) throw error;
    }
    return { success: true };
  } catch (error: unknown) {
    console.error('Error in updateCustomerTerms:', error);
    return { success: false, error: error instanceof Error ? error.message : (error as any)?.message || 'Failed to update customer terms' };
  }
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
    customerTag: String(row.customerTag || '').trim(),
    customerClass: String(row.customerClass || '').trim(),
  };
}

export async function getDebitData() {
  const scope = await getDebitScope();
  try {
    const all = await getSheetData();
    const data = scope ? applyDebitScope(all as InvoiceRow[], scope) : all;
    return { data };
  } catch (error) {
    console.error('Service Error getDebitData:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch debit data');
  }
}

export async function getDebitMetadata(): Promise<DebitMetadata> {
  await requireSession();
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
  const scope = await getDebitScope();
  try {
    if (scope) throw new Error('scoped user: use filtered data');
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
  const scope = await getDebitScope();
  try {
    const { data, error } = await bhs_supabase.rpc('get_debit_customers_aggregated');
    if (!error && Array.isArray(data)) {
      const visible = scope
        ? data.filter((row: Record<string, unknown>) => scope.ownShare({ customerId: String(row.customerId || ''), date: '', number: '', debit: 0 } as InvoiceRow) > 0)
        : data;
      return {
        success: true,
        data: visible.map((row: Record<string, unknown>) => ({
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
  const scope = await getDebitScope();
  if (scope) return { success: false, totalPayments: 0, totalAmount: 0, data: [] };
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
  discountAmount: number;
  returnAmount: number;
  paymentReference: string | null;
  customersId: string[];
  remainderNote: string | null;
}

export interface PaymentReconciliationSessionSummary {
  sessionId: string;
  savedAt: string;
  paymentDate: string | null;
  paymentAmount: number;
  discountAmount: number;
  returnAmount: number;
  paymentReference: string | null;
  totalApplied: number;
  paymentRemainder: number;
  lineCount: number;
  customerCount: number;
  customersId: string[];
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
    const { error } = await db().from(table).insert(chunk);
    if (error) throw error;
  }
}

export async function generateNextPaymentReconciliationId(): Promise<string> {
  await requireDebitTab('payment-reconciliation');
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  const { data, error } = await db()
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
    await requireDebitTab('payment-reconciliation');
    const lines = input.lines.filter(
      (line) => line.customerId.trim() && line.invoiceNumber.trim() && Number.isFinite(line.appliedAmount),
    );

    if (lines.length === 0) {
      return { success: false as const, error: 'No checked invoice lines to save' };
    }

    if (input.header.paymentAmount <= 0.009) {
      return { success: false as const, error: 'Payment amount must be greater than zero' };
    }

    const existingId = input.sessionId?.trim() || '';
    const isUpdate = Boolean(existingId);
    const savedAt = new Date().toISOString();
    const paymentDate = input.header.paymentDate?.trim() || null;
    const customersId = [...new Set(input.header.customersId.map((id) => id.trim()).filter(Boolean))];

    const buildHeader = (sessionId: string) => ({
      SESSION_ID: sessionId,
      PAYMENT_DATE: paymentDate,
      PAYMENT_AMOUNT: input.header.paymentAmount,
      DISCOUNT_AMOUNT: input.header.discountAmount,
      RETURN_AMOUNT: input.header.returnAmount,
      PAYMENT_REFERENCE: input.header.paymentReference?.trim() || null,
      CUSTOMERS_ID: customersId,
      REMAINDER_NOTE: input.header.remainderNote?.trim() || null,
      SAVED_AT: savedAt,
    });

    const buildLines = (sessionId: string) =>
      lines.map((line, index) => ({
        SESSION_ID: sessionId,
        LINE_NO: index + 1,
        CUSTOMER_ID: line.customerId.trim(),
        INVOICE_NUMBER: line.invoiceNumber.trim(),
        OPEN_AMOUNT: line.openAmount,
        APPLIED_AMOUNT: line.appliedAmount,
        REMAINING_AMOUNT: line.remainingAmount,
      }));

    let sessionId = existingId;

    if (isUpdate) {
      // Keep a copy of the old lines so they can be put back if saving the new ones fails
      const { data: oldLines, error: oldErr } = await db().from(PR_LINES_TABLE).select('*').eq('SESSION_ID', sessionId);
      if (oldErr) throw oldErr;
      const { data: oldHeader, error: oldHeaderErr } = await db().from(PR_HEADER_TABLE).select('*').eq('SESSION_ID', sessionId).maybeSingle();
      if (oldHeaderErr) throw oldHeaderErr;
      if (!oldHeader) return { success: false as const, error: 'This reconciliation no longer exists' };

      const { error: deleteLinesError } = await db().from(PR_LINES_TABLE).delete().eq('SESSION_ID', sessionId);
      if (deleteLinesError) throw deleteLinesError;

      try {
        await bulkInsertChunks(PR_LINES_TABLE, buildLines(sessionId));
        const { error: updateError } = await db().from(PR_HEADER_TABLE).update(buildHeader(sessionId)).eq('SESSION_ID', sessionId);
        if (updateError) throw updateError;
      } catch (err) {
        // Roll back: restore the previous lines and header
        await db().from(PR_LINES_TABLE).delete().eq('SESSION_ID', sessionId);
        if (oldLines?.length) await bulkInsertChunks(PR_LINES_TABLE, oldLines as Record<string, unknown>[]).catch(() => undefined);
        await db().from(PR_HEADER_TABLE).update(oldHeader).eq('SESSION_ID', sessionId);
        throw err;
      }
    } else {
      // New: reserve the next number (retry if someone else took it at the same moment)
      let inserted = false;
      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        sessionId = await generateNextPaymentReconciliationId();
        const { error } = await db().from(PR_HEADER_TABLE).insert(buildHeader(sessionId));
        if (!error) inserted = true;
        else if (error.code !== '23505') throw error;
      }
      if (!inserted) throw new Error('Could not reserve a reconciliation number, please try again');

      try {
        // Clear any leftover lines with this number (from an old deleted session)
        const { error: clearErr } = await db().from(PR_LINES_TABLE).delete().eq('SESSION_ID', sessionId);
        if (clearErr) throw clearErr;
        await bulkInsertChunks(PR_LINES_TABLE, buildLines(sessionId));
      } catch (err) {
        // Don't leave an empty header behind
        await db().from(PR_LINES_TABLE).delete().eq('SESSION_ID', sessionId);
        await db().from(PR_HEADER_TABLE).delete().eq('SESSION_ID', sessionId);
        throw err;
      }
    }

    return {
      success: true as const,
      sessionId,
      rowCount: lines.length,
      savedAt,
      updated: isUpdate,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : (error as any)?.message || 'Failed to save payment reconciliation session';
    console.error('Error in savePaymentReconciliationSession:', error);
    return { success: false as const, error: message };
  }
}

export async function fetchPaymentReconciliationSessions() {
  await requireDebitTab('payment-reconciliation', 'payment-reconciliation-saved');
  try {
    const { data: headers, error: headerError } = await db()
      .from(PR_HEADER_TABLE)
      .select('SESSION_ID, PAYMENT_DATE, PAYMENT_AMOUNT, DISCOUNT_AMOUNT, RETURN_AMOUNT, PAYMENT_REFERENCE, CUSTOMERS_ID, SAVED_AT')
      .order('SAVED_AT', { ascending: false });

    if (headerError) throw headerError;

    const data: PaymentReconciliationSessionSummary[] = (headers || []).map((row) => {
      const sessionId = String(row.SESSION_ID || '').trim();
      const paymentAmount = parseNum(row.PAYMENT_AMOUNT);
      const discountAmount = parseNum(row.DISCOUNT_AMOUNT);
      const returnAmount = parseNum(row.RETURN_AMOUNT);
      const customersId = parseCustomersId(row.CUSTOMERS_ID);
      const paymentDateRaw = row.PAYMENT_DATE;

      return {
        sessionId,
        savedAt: String(row.SAVED_AT || ''),
        paymentDate: paymentDateRaw ? String(paymentDateRaw).split('T')[0] : null,
        paymentAmount,
        discountAmount,
        returnAmount,
        paymentReference: row.PAYMENT_REFERENCE ? String(row.PAYMENT_REFERENCE) : null,
        totalApplied: 0,
        paymentRemainder: paymentAmount + discountAmount + returnAmount,
        lineCount: 0,
        customerCount: customersId.length,
        customersId,
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
  await requireDebitTab('payment-reconciliation', 'payment-reconciliation-saved');
  try {
    const id = sessionId.trim();
    if (!id) {
      return { success: false as const, error: 'Session ID is required' };
    }

    const { data: headerRows, error: headerError } = await db()
      .from(PR_HEADER_TABLE)
      .select('SESSION_ID, PAYMENT_DATE, PAYMENT_AMOUNT, DISCOUNT_AMOUNT, RETURN_AMOUNT, PAYMENT_REFERENCE, CUSTOMERS_ID, REMAINDER_NOTE, SAVED_AT')
      .eq('SESSION_ID', id)
      .limit(1);

    if (headerError) throw headerError;

    const header = headerRows?.[0];
    if (!header) {
      return { success: false as const, error: 'Payment reconciliation session not found' };
    }

    const { data: lineRows, error: lineError } = await db()
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
      discountAmount: parseNum(header.DISCOUNT_AMOUNT),
      returnAmount: parseNum(header.RETURN_AMOUNT),
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
    await requireDebitTab('payment-reconciliation-saved', 'payment-reconciliation');
    const id = String(sessionId || '').trim();
    if (!id) {
      return { success: false as const, error: 'Session ID is required' };
    }

    // Lines first, then the header — nothing is left behind
    const { error: linesError } = await db().from(PR_LINES_TABLE).delete().eq('SESSION_ID', id);
    if (linesError) throw linesError;
    const { error } = await db().from(PR_HEADER_TABLE).delete().eq('SESSION_ID', id);
    if (error) throw error;

    return { success: true as const };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete payment reconciliation session';
    console.error('Error in deletePaymentReconciliationSession:', error);
    return { success: false as const, error: message };
  }
}
