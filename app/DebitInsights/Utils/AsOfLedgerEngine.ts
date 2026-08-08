import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/app/Debit/Utils/InvoiceType';
import {
  DebitInsightsMetrics,
  InsightsFilters,
  InsightsPeriodPreset,
} from './InsightsTypes';
import { computePortfolioAging } from './PortfolioAging';
import {
  endOfDay,
  formatMonthLabel,
  getMonthlyKey,
  parseDate,
  startOfDay,
  toInputDate,
} from './DateUtils';

function matchesCity(row: InvoiceRow, cities: string[]): boolean {
  if (cities.length === 0) return true;
  const city = row.salesRep?.trim();
  return city ? cities.includes(city) : false;
}

function matchesCustomer(row: InvoiceRow, customers: string[]): boolean {
  if (customers.length === 0) return true;
  const name = row.customerName?.trim();
  return name ? customers.includes(name) : false;
}

function matchesCustomerTag(row: InvoiceRow, customerTags: string[]): boolean {
  if (customerTags.length === 0) return true;
  const tag = row.customerTag?.trim();
  return tag ? customerTags.includes(tag) : false;
}

function matchesRowFilters(
  row: InvoiceRow,
  cities: string[],
  customers: string[],
  customerTags: string[] = []
): boolean {
  return (
    matchesCity(row, cities) &&
    matchesCustomer(row, customers) &&
    matchesCustomerTag(row, customerTags)
  );
}

function filterRowsByScope(
  rows: InvoiceRow[],
  cities: string[],
  customers: string[],
  customerTags: string[] = []
): InvoiceRow[] {
  if (cities.length === 0 && customers.length === 0 && customerTags.length === 0) return rows;
  return rows.filter((row) => matchesRowFilters(row, cities, customers, customerTags));
}

function filterRowsAsOf(
  rows: InvoiceRow[],
  asOfDate: string,
  cities: string[],
  customers: string[],
  customerTags: string[] = []
): InvoiceRow[] {
  const cutoff = endOfDay(asOfDate);
  return rows.filter((row) => {
    if (!matchesRowFilters(row, cities, customers, customerTags)) return false;
    const d = parseDate(row.date);
    return d !== null && d <= cutoff;
  });
}

export function resolvePeriodRange(
  asOfDate: string,
  preset: InsightsPeriodPreset,
  periodFrom: string,
  periodTo: string
): { from: Date; to: Date } {
  const to = endOfDay(asOfDate);

  if (preset === 'ytd') {
    const from = new Date(to.getFullYear(), 0, 1);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }

  if (preset === 'custom' && periodFrom && periodTo) {
    const from = startOfDay(periodFrom);
    const customTo = endOfDay(periodTo);
    return { from, to: customTo > to ? to : customTo };
  }

  const monthsBack =
    preset === 'trailing3m' ? 2 : preset === 'trailing6m' ? 5 : 11;

  const from = new Date(to.getFullYear(), to.getMonth() - monthsBack, 1);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function shiftYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function computeYoYChange(current: number, previous: number): number | null {
  if (Math.abs(previous) <= 0.01) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function computeNetSales(rows: InvoiceRow[], from: Date, to: Date): number {
  let netSales = 0;
  rows.forEach((row) => {
    const d = parseDate(row.date);
    if (!d || d < from || d > to) return;
    const num = (row.number || '').toString().toUpperCase().trim();
    // Every SAL / RSAL row: full ledger net (debit − credit), no partial amounts
    if (num.startsWith('SAL') || num.startsWith('RSAL')) {
      netSales += (row.debit || 0) - (row.credit || 0);
    }
  });
  return netSales;
}

function computeCollections(rows: InvoiceRow[], from: Date, to: Date): number {
  let collections = 0;
  rows.forEach((row) => {
    const d = parseDate(row.date);
    if (!d || d < from || d > to) return;
    const type = getInvoiceType(row);
    if (type === 'Payment' || type === 'R-Payment') {
      collections += (row.credit || 0) - (row.debit || 0);
    }
  });
  return collections;
}

function collectSalesReps(rows: InvoiceRow[]): string[] {
  const reps = new Set<string>();
  rows.forEach((row) => {
    if (row.salesRep?.trim()) reps.add(row.salesRep.trim());
  });
  return Array.from(reps).sort();
}

export function collectCustomers(rows: InvoiceRow[], cities: string[]): string[] {
  const names = new Set<string>();
  rows.forEach((row) => {
    if (!matchesCity(row, cities)) return;
    const name = row.customerName?.trim();
    if (name) names.add(name);
  });
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function collectCustomerTags(rows: InvoiceRow[], cities: string[]): string[] {
  const tags = new Set<string>();
  rows.forEach((row) => {
    if (!matchesCity(row, cities)) return;
    const tag = row.customerTag?.trim();
    if (tag) tags.add(tag);
  });
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

/** Customer names in scope for Sales overlay when tags and/or customers are selected. */
export function resolveEffectiveCustomers(
  rows: InvoiceRow[],
  cities: string[],
  customers: string[],
  customerTags: string[]
): string[] {
  if (customers.length === 0 && customerTags.length === 0) return [];

  const nameSet = customers.length > 0 ? new Set(customers) : null;
  const tagSet = customerTags.length > 0 ? new Set(customerTags) : null;
  const names = new Set<string>();

  rows.forEach((row) => {
    if (!matchesCity(row, cities)) return;
    const name = row.customerName?.trim();
    if (!name) return;
    if (nameSet && !nameSet.has(name)) return;
    if (tagSet) {
      const tag = row.customerTag?.trim();
      if (!tag || !tagSet.has(tag)) return;
    }
    names.add(name);
  });

  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function buildTrendSeries(
  allRows: InvoiceRow[],
  asOfDate: string,
  periodFrom: Date,
  periodTo: Date,
  cities: string[],
  customers: string[],
  customerTags: string[]
): DebitInsightsMetrics['trendSeries'] {
  const asOf = endOfDay(asOfDate);
  const points: DebitInsightsMetrics['trendSeries'] = [];

  let cursor = new Date(periodFrom.getFullYear(), periodFrom.getMonth(), 1);
  cursor.setHours(0, 0, 0, 0);
  const lastMonth = new Date(periodTo.getFullYear(), periodTo.getMonth(), 1);

  while (cursor <= lastMonth) {
    let monthEnd = endOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));
    if (monthEnd > periodTo) monthEnd = new Date(periodTo);
    if (monthEnd > asOf) monthEnd = new Date(asOf);

    let monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    if (monthStart < periodFrom) {
      monthStart = new Date(periodFrom);
      monthStart.setHours(0, 0, 0, 0);
    }

    const monthEndInput = toInputDate(monthEnd);
    const rowsAsOfMonth = filterRowsAsOf(allRows, monthEndInput, cities, customers, customerTags);
    const { totalOpenDebt } = computePortfolioAging(
      rowsAsOfMonth,
      monthEnd,
      cities,
      customers,
      customerTags
    );

    const monthKey = getMonthlyKey(monthEnd);
    points.push({
      month: monthKey,
      monthLabel: formatMonthLabel(monthKey),
      openDebt: totalOpenDebt,
      netSales: computeNetSales(rowsAsOfMonth, monthStart, monthEnd),
      collections: computeCollections(rowsAsOfMonth, monthStart, monthEnd),
    });

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return points;
}

export function computeDebitInsights(
  rows: InvoiceRow[],
  filters: InsightsFilters
): DebitInsightsMetrics {
  const cities = filters.salesRep;
  const customers = filters.customers;
  const customerTags = filters.customerTags || [];
  const rowsAsOf = filterRowsAsOf(rows, filters.asOfDate, cities, customers, customerTags);
  const referenceDate = endOfDay(filters.asOfDate);
  const { totalOpenDebt } = computePortfolioAging(
    rowsAsOf,
    referenceDate,
    cities,
    customers,
    customerTags
  );

  // Aging Breakdown: cities + customers/tags only — ignore as-of and period date filters
  const agingReferenceDate = endOfDay(toInputDate(new Date()));
  const rowsForAging = filterRowsByScope(rows, cities, customers, customerTags);
  const { agingBreakdown } = computePortfolioAging(
    rowsForAging,
    agingReferenceDate,
    cities,
    customers,
    customerTags
  );

  const { from, to } = resolvePeriodRange(
    filters.asOfDate,
    filters.periodPreset,
    filters.periodFrom,
    filters.periodTo
  );

  const netSales = computeNetSales(rowsAsOf, from, to);
  const priorFrom = shiftYears(from, -1);
  const priorTo = shiftYears(to, -1);
  const netSalesPriorYear = computeNetSales(rowsAsOf, priorFrom, priorTo);
  const netSalesYoYChange = computeYoYChange(netSales, netSalesPriorYear);
  const collections = computeCollections(rowsAsOf, from, to);
  const collectionRate = netSales > 0.01 ? (collections / netSales) * 100 : null;

  return {
    totalOpenDebt,
    agingBreakdown,
    period: { netSales, netSalesPriorYear, netSalesYoYChange, collections, collectionRate },
    trendSeries: buildTrendSeries(rows, filters.asOfDate, from, to, cities, customers, customerTags),
    salesReps: collectSalesReps(rows),
  };
}
