import type { InvoiceRow } from '@/types';
import { parseDate } from '@/app/DebitInsights/Utils/DateUtils';

function startOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseBoundary(dateStr: string, end: boolean): Date | null {
  if (!dateStr) return null;
  const parsed = parseDate(dateStr) || new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;
  return end ? endOfDay(parsed) : startOfDay(parsed);
}

/**
 * Net sales from Debit ledger rows: SAL / RSAL only, debit − credit,
 * filtered by invoice date within [dateFrom, dateTo] (inclusive).
 */
export function buildNetSalesByCustomerId(
  debitRows: InvoiceRow[],
  dateFrom: string,
  dateTo: string,
): Map<string, number> {
  const from = parseBoundary(dateFrom, false);
  const to = parseBoundary(dateTo, true);
  const map = new Map<string, number>();

  for (const row of debitRows || []) {
    const num = String(row.number || '')
      .toUpperCase()
      .trim();
    if (!num.startsWith('SAL') && !num.startsWith('RSAL')) continue;

    const customerId = String(row.customerId || '').trim();
    if (!customerId) continue;

    const d = parseDate(row.date);
    if (!d) continue;
    if (from && d < from) continue;
    if (to && d > to) continue;

    const net = (Number(row.debit) || 0) - (Number(row.credit) || 0);
    map.set(customerId, (map.get(customerId) || 0) + net);
  }

  return map;
}
