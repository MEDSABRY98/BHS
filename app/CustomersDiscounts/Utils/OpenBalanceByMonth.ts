import { parseInvoiceDate } from '@/app/Debit/CustomerDetailsTab/Utils';

export type OpenBalanceInvoice = {
  date?: string | null;
  debit?: number | null;
  credit?: number | null;
  matching?: string | null;
  residualAmount?: number | null;
};

export function monthKey(year: number, month: number): string {
  return `${year}-${month}`;
}

/** Whether a calendar month is fully past (current month excluded). */
export function isPastMonth(year: number, month: number, now = new Date()): boolean {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;
  return false;
}

/**
 * Returns month keys (`YYYY-M`) that still have open balance,
 * matching Customer Details OverdueTab logic:
 * - unmatched: |debit - credit| > 0.01
 * - matched: |residualAmount| > 0.01 (residual holder rows)
 * Buckets by invoice date month/year.
 */
export function buildOpenBalanceMonthKeys(
  invoices: OpenBalanceInvoice[],
): Set<string> {
  const openMonths = new Set<string>();

  for (const invoice of invoices) {
    const debit = Number(invoice.debit) || 0;
    const credit = Number(invoice.credit) || 0;
    const netDebt = debit - credit;
    const matching = String(invoice.matching || '').trim();
    const residualRaw = invoice.residualAmount;
    const residual =
      residualRaw !== undefined && residualRaw !== null && Math.abs(Number(residualRaw)) > 0.01
        ? Number(residualRaw)
        : undefined;

    const isOpen = matching
      ? residual !== undefined && Math.abs(residual) > 0.01
      : Math.abs(netDebt) > 0.01;

    if (!isOpen) continue;

    const parsed = parseInvoiceDate(invoice.date);
    if (!parsed || Number.isNaN(parsed.getTime())) continue;

    openMonths.add(monthKey(parsed.getFullYear(), parsed.getMonth() + 1));
  }

  return openMonths;
}

/** Group debit invoices by customer ID, then build open-month sets. */
export function buildOpenBalanceMonthsByCustomer(
  invoices: Array<OpenBalanceInvoice & { customerId?: string | null }>,
): Map<string, Set<string>> {
  const byCustomer = new Map<string, OpenBalanceInvoice[]>();

  for (const invoice of invoices) {
    const customerId = String(invoice.customerId || '').trim();
    if (!customerId) continue;
    const list = byCustomer.get(customerId) || [];
    list.push(invoice);
    byCustomer.set(customerId, list);
  }

  const result = new Map<string, Set<string>>();
  for (const [customerId, rows] of byCustomer) {
    result.set(customerId, buildOpenBalanceMonthKeys(rows));
  }
  return result;
}
