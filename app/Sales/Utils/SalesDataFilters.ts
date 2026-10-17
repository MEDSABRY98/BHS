// Common Sales filters, applied in ONE pass over the rows.
// The same invoice date appears on thousands of rows, so each distinct date string is
// parsed once and reused (same results as `new Date(item.invoiceDate)` on every row).

import { inSel } from '@/app/Sales/Utils/MultiSelect';
type ParsedDate = { t: number; y: number; m: number } | null;

const DATE_CACHE_MAX = 20_000;
const dateCache = new Map<string, ParsedDate>();

function parseInvoiceDate(value: unknown): ParsedDate {
  if (!value) return null;
  const key = String(value);
  const hit = dateCache.get(key);
  if (hit !== undefined) return hit;
  const d = new Date(value as any);
  const parsed: ParsedDate = isNaN(d.getTime()) ? null : { t: d.getTime(), y: d.getFullYear(), m: d.getMonth() + 1 };
  if (dateCache.size >= DATE_CACHE_MAX) dateCache.clear();
  dateCache.set(key, parsed);
  return parsed;
}

export function applySalesCommonFilters(data: any[], filters: any): any[] {
  if (!filters) return data;

  const {
    invoiceType,
    year,
    month,
    dateFrom,
    dateTo,
    area,
    market,
    merchandiser,
    salesRep,
    productTag,
    product,
    customerMainName,
    customerSubName,
    customerTag,
    customerClass,
  } = filters;

  const byType = !!invoiceType && invoiceType !== 'all' && (invoiceType === 'sales' || invoiceType === 'returns');
  const yearNum = year ? parseInt(year, 10) : null;
  const monthNum = month ? parseInt(month, 10) : null;
  const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
  let toTime: number | null = null;
  if (dateTo) {
    const toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
    toTime = toDate.getTime();
  }
  const needsDate = yearNum !== null || monthNum !== null || fromTime !== null || toTime !== null;

  const anyFilter =
    byType || needsDate || !!(productTag || product || customerMainName || customerSubName || customerTag || customerClass || area || market || merchandiser || salesRep);
  if (!anyFilter) return data;

  const out: any[] = [];
  for (const item of data) {
    if (byType) {
      const num = item.invoiceNumber?.trim().toUpperCase() || '';
      if (invoiceType === 'sales' ? !num.startsWith('SAL') : !num.startsWith('RSAL')) continue;
    }
    if (productTag && !inSel(item.productTag, productTag)) continue;
    if (product && !inSel(item.product, product)) continue;
    if (customerMainName && item.customerMainName !== customerMainName) continue;
    if (customerSubName && item.customerName !== customerSubName) continue;
    if (customerTag && item.customerTag !== customerTag) continue;
    if (customerClass && item.customerClass !== customerClass) continue;
    if (area && item.area !== area) continue;
    if (market && item.market !== market) continue;
    if (merchandiser && item.merchandiser !== merchandiser) continue;
    if (salesRep && item.salesRep !== salesRep) continue;

    if (needsDate) {
      const d = parseInvoiceDate(item.invoiceDate);
      if (!d) continue;
      if (yearNum !== null && d.y !== yearNum) continue;
      if (monthNum !== null && d.m !== monthNum) continue;
      if (fromTime !== null && d.t < fromTime) continue;
      if (toTime !== null && d.t > toTime) continue;
    }
    out.push(item);
  }
  return out;
}
