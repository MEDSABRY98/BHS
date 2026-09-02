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

function matchesCustomerClass(row: InvoiceRow, customerClasses: string[]): boolean {
  if (customerClasses.length === 0) return true;
  const cClass = row.customerClass?.trim();
  return cClass ? customerClasses.includes(cClass) : false;
}

function matchesRowFilters(
  row: InvoiceRow,
  cities: string[],
  customers: string[],
  customerTags: string[] = [],
  customerClasses: string[] = []
): boolean {
  return (
    matchesCity(row, cities) &&
    matchesCustomer(row, customers) &&
    matchesCustomerTag(row, customerTags) &&
    matchesCustomerClass(row, customerClasses)
  );
}

function filterRowsByScope(
  rows: InvoiceRow[],
  cities: string[],
  customers: string[],
  customerTags: string[] = [],
  customerClasses: string[] = []
): InvoiceRow[] {
  if (cities.length === 0 && customers.length === 0 && customerTags.length === 0 && customerClasses.length === 0) return rows;
  return rows.filter((row) => matchesRowFilters(row, cities, customers, customerTags, customerClasses));
}

function filterRowsAsOf(
  rows: InvoiceRow[],
  asOfDate: string,
  cities: string[],
  customers: string[],
  customerTags: string[] = [],
  customerClasses: string[] = []
): InvoiceRow[] {
  const cutoff = endOfDay(asOfDate);
  return rows.filter((row) => {
    if (!matchesRowFilters(row, cities, customers, customerTags, customerClasses)) return false;
    const d = parseDate(row.date);
    if (d === null) return true;
    return d <= cutoff;
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
  const scope = filterRowsByScope(rows, cities, []);
  const tags = new Set<string>();
  for (const row of scope) {
    if (row.customerTag?.trim()) {
      tags.add(row.customerTag.trim());
    }
  }
  return Array.from(tags).sort();
}

export function collectCustomerClassifications(rows: InvoiceRow[], cities: string[]): string[] {
  const scope = filterRowsByScope(rows, cities, []);
  const classes = new Set<string>();
  for (const row of scope) {
    if (row.customerClass?.trim()) {
      classes.add(row.customerClass.trim());
    }
  }
  return Array.from(classes).sort();
}

/** Customer names in scope for Sales overlay when tags and/or customers are selected. */
export function resolveEffectiveCustomers(
  rows: InvoiceRow[],
  cities: string[],
  selectedCustomers: string[],
  selectedTags: string[] = [],
  selectedClasses: string[] = []
): string[] {
  if (selectedCustomers.length > 0) {
    return selectedCustomers;
  }
  const scope = filterRowsByScope(rows, cities, [], selectedTags, selectedClasses);
  const names = new Set<string>();
  scope.forEach((row) => {
    const name = row.customerName?.trim();
    if (name) names.add(name);
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
  customerTags: string[],
  customerClasses: string[]
): DebitInsightsMetrics['trendSeries'] {
  const asOf = endOfDay(asOfDate);
  const points: DebitInsightsMetrics['trendSeries'] = [];

  // Filter rows by scope once to avoid doing it every month
  const scopedRows = filterRowsByScope(allRows, cities, customers, customerTags, customerClasses);

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

    if (monthStart > monthEnd) {
      const monthKey = getMonthlyKey(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
      points.push({
        month: monthKey,
        monthLabel: formatMonthLabel(monthKey),
        openDebt: 0,
        netSales: 0,
        collections: 0,
      });
    } else {
      const today = new Date();
      const isCurrentMonth =
        cursor.getFullYear() === today.getFullYear() &&
        cursor.getMonth() === today.getMonth();

      const monthEndInput = toInputDate(monthEnd);

      // Current month: use all scoped rows. Past months: use rows up to monthEnd
      const rowsForDebt = isCurrentMonth
        ? scopedRows
        : filterRowsAsOf(scopedRows, monthEndInput, [], [], [], []);

      // totalOpenDebt is simply the sum of (debit - credit) for all applicable rows
      let totalOpenDebt = 0;
      for (let i = 0; i < rowsForDebt.length; i++) {
        totalOpenDebt += (rowsForDebt[i].debit || 0) - (rowsForDebt[i].credit || 0);
      }

      // netSales/collections always use date-scoped rows
      const rowsAsOfMonth = filterRowsAsOf(scopedRows, monthEndInput, [], [], [], []);

      const monthKey = getMonthlyKey(monthEnd);
      points.push({
        month: monthKey,
        monthLabel: formatMonthLabel(monthKey),
        openDebt: totalOpenDebt,
        netSales: computeNetSales(rowsAsOfMonth, monthStart, monthEnd),
        collections: computeCollections(rowsAsOfMonth, monthStart, monthEnd),
      });
    }

    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return points;
}

export function computeDebitInsightsMetrics(
  rows: InvoiceRow[],
  filters: InsightsFilters
): DebitInsightsMetrics {
  const { periodPreset, periodFrom, periodTo, asOfDate, salesRep, customers, customerTags, customerClassifications } =
    filters;

  const cities = salesRep;
  const tags = customerTags || [];
  const classes = customerClassifications || [];
  const validRows = filterRowsAsOf(rows, asOfDate, cities, customers, tags, classes);
  const referenceDate = endOfDay(asOfDate);

  // Open Debt KPI: if asOfDate = today → include all rows (matches AgesTab)
  // If asOfDate is a past date → use rows up to that date (historical view)
  const todayStr = toInputDate(new Date());
  const rowsForOpenDebt = asOfDate >= todayStr
    ? filterRowsByScope(rows, cities, customers, tags, classes)
    : validRows;

  const agingReferenceDate = endOfDay(toInputDate(new Date()));
  const { totalOpenDebt, agingBreakdown } = computePortfolioAging(
    rowsForOpenDebt,
    agingReferenceDate,
    cities,
    customers,
    tags,
    classes
  );

  const { from, to } = resolvePeriodRange(
    filters.asOfDate,
    filters.periodPreset,
    filters.periodFrom,
    filters.periodTo
  );

  const netSales = computeNetSales(validRows, from, to);
  const priorFrom = shiftYears(from, -1);
  const priorTo = shiftYears(to, -1);
  const netSalesPriorYear = computeNetSales(validRows, priorFrom, priorTo);
  const netSalesYoYChange = computeYoYChange(netSales, netSalesPriorYear);
  const collections = computeCollections(validRows, from, to);
  const collectionRate = netSales > 0.01 ? (collections / netSales) * 100 : null;

  const currentYearStr = filters.asOfDate.substring(0, 4);
  const prevYearStr = String(Number(currentYearStr) - 1);
  const cyStart = new Date(`${currentYearStr}-01-01T00:00:00`);
  const cyEnd = new Date(`${currentYearStr}-12-31T23:59:59.999`);
  const pyStart = new Date(`${prevYearStr}-01-01T00:00:00`);
  const pyEnd = new Date(`${prevYearStr}-12-31T23:59:59.999`);

  const currentYearTrend = buildTrendSeries(rows, filters.asOfDate, cyStart, cyEnd, cities, customers, tags, classes);
  const previousYearTrend = buildTrendSeries(rows, filters.asOfDate, pyStart, pyEnd, cities, customers, tags, classes);

  return {
    totalOpenDebt,
    agingBreakdown,
    period: { netSales, netSalesPriorYear, netSalesYoYChange, collections, collectionRate },
    trendSeries: buildTrendSeries(rows, filters.asOfDate, from, to, cities, customers, tags, classes),
    currentYearTrend,
    previousYearTrend,
    cities: collectSalesReps(rows),
  };
}
