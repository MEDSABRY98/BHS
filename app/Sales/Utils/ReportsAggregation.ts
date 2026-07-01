export type SalesFilters = {
  invoiceType?: string;
  year?: string;
  month?: string;
  dateFrom?: string;
  dateTo?: string;
  area?: string;
  market?: string;
  merchandiser?: string;
  salesRep?: string;
  productTag?: string;
};

export type SalesItemWithDate = {
  invoiceDate?: string;
  invoiceNumber?: string;
  customerId?: string;
  customerName?: string;
  customerMainName?: string;
  productId?: string;
  product?: string;
  productTag?: string;
  barcode?: string;
  amount?: number;
  qty?: number;
  area?: string;
  market?: string;
  merchandiser?: string;
  salesRep?: string;
  salesRepId?: string;
  parsedDate: Date | null;
  time: number;
  yr: number;
  mn: number;
};

export type CompareMode = 'prevMonth' | 'sameMonthLastYear';

export type CustomerGroupBy = 'main' | 'sub';

export type CustomerChangeRow = {
  name: string;
  currentAmount: number;
  compareAmount: number;
  changeAmount: number;
  changePct: number;
};

export type CustomerRankRow = {
  rank: number;
  name: string;
  invoices: number;
  amount: number;
  comparePct: number;
  sharePct: number;
};

export type AtRiskRow = {
  rank: number;
  name: string;
  compareAmount: number;
  currentAmount: number;
};

export type ProductRankRow = {
  rank: number;
  barcode: string;
  name: string;
  qty: number;
  amount: number;
  sharePct: number;
};

export type CategoryRankRow = {
  rank: number;
  category: string;
  qty: number;
  amount: number;
  sharePct: number;
};

export type InvoiceRankRow = {
  rank: number;
  date: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
};

export type DailySalesCalendarDay = {
  day: number;
  date: string;
  amount: number;
  inRange: boolean;
};

export type DailySalesCalendar = {
  year: number;
  month: number;
  monthLabel: string;
  days: DailySalesCalendarDay[];
  maxAmount: number;
};

import { getPrimaryAmount, resolveReportingMode } from './ReportingMode';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function augmentWithDates(data: any[]): SalesItemWithDate[] {
  return data.map((item) => {
    let parsedDate: Date | null = null;
    let time = NaN;
    let yr = NaN;
    let mn = NaN;
    if (item.invoiceDate) {
      parsedDate = new Date(item.invoiceDate);
      time = parsedDate.getTime();
      if (!isNaN(time)) {
        yr = parsedDate.getFullYear();
        mn = parsedDate.getMonth() + 1;
      }
    }
    return { ...item, parsedDate, time, yr, mn };
  });
}

function matchesInvoiceType(item: SalesItemWithDate, invoiceType?: string): boolean {
  if (!invoiceType || invoiceType === 'all') return true;
  const num = item.invoiceNumber?.trim().toUpperCase() || '';
  if (invoiceType === 'sales') return num.startsWith('SAL') && !num.startsWith('RSAL');
  if (invoiceType === 'returns') return num.startsWith('RSAL');
  return true;
}

export function applyGeoFilters(data: SalesItemWithDate[], filters?: SalesFilters): SalesItemWithDate[] {
  if (!filters) return data;
  let result = data.filter((item) => matchesInvoiceType(item, filters.invoiceType));
  if (filters.productTag) result = result.filter((i) => i.productTag === filters.productTag);
  if (filters.area) result = result.filter((i) => i.area === filters.area);
  if (filters.market) result = result.filter((i) => i.market === filters.market);
  if (filters.merchandiser) result = result.filter((i) => i.merchandiser === filters.merchandiser);
  if (filters.salesRep) result = result.filter((i) => i.salesRep === filters.salesRep);
  return result;
}

export function filterByTimeRange(
  data: SalesItemWithDate[],
  fromTime: number,
  toTime: number
): SalesItemWithDate[] {
  return data.filter((item) => {
    if (isNaN(item.time)) return false;
    if (item.time < fromTime) return false;
    if (item.time > toTime) return false;
    return true;
  });
}

export function filterByYearMonth(
  data: SalesItemWithDate[],
  year: number,
  month: number
): SalesItemWithDate[] {
  return data.filter((item) => item.yr === year && item.mn === month);
}

export function getMainCustomerName(item: SalesItemWithDate): string {
  return (item.customerMainName || item.customerName || 'Unknown').trim();
}

export function getCustomerGroupKey(item: SalesItemWithDate, groupBy: CustomerGroupBy = 'main'): string {
  if (groupBy === 'sub') {
    const sub = (item.customerName || '').trim();
    const id = (item.customerId || '').trim();
    return sub || id || getMainCustomerName(item);
  }
  return getMainCustomerName(item);
}

export function isSalInvoice(invoiceNumber?: string): boolean {
  const num = invoiceNumber?.trim().toUpperCase() || '';
  return num.startsWith('SAL') && !num.startsWith('RSAL');
}

export function isGrvInvoice(invoiceNumber?: string): boolean {
  return (invoiceNumber?.trim().toUpperCase() || '').startsWith('RSAL');
}

function shouldCountInvoiceForMode(invoiceNumber: string | undefined, invoiceType?: string): boolean {
  const num = invoiceNumber?.trim().toUpperCase() || '';
  if (!num) return false;
  if (invoiceType === 'returns') return num.startsWith('RSAL');
  return num.startsWith('SAL') && !num.startsWith('RSAL');
}

function monthPrimaryAmount(
  geoData: SalesItemWithDate[],
  fromTime: number,
  toTime: number,
  invoiceType?: string
): number {
  const slice = filterByTimeRange(geoData, fromTime, toTime);
  return getPrimaryAmount(
    computePeriodMetrics(slice, [], invoiceType),
    resolveReportingMode(invoiceType)
  );
}

export function resolveReportPeriod(filters?: SalesFilters): {
  year: number;
  month: number;
  fromTime: number;
  toTime: number;
  label: string;
} {
  const now = new Date();
  let year = filters?.year ? parseInt(filters.year, 10) : now.getFullYear();
  let month = filters?.month ? parseInt(filters.month, 10) : now.getMonth() + 1;

  if (filters?.dateFrom || filters?.dateTo) {
    const from = filters.dateFrom ? new Date(filters.dateFrom) : new Date(year, month - 1, 1);
    const to = filters.dateTo ? new Date(filters.dateTo) : new Date(year, month, 0, 23, 59, 59, 999);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return {
      year: from.getFullYear(),
      month: from.getMonth() + 1,
      fromTime: from.getTime(),
      toTime: to.getTime(),
      label: `${MONTH_NAMES_LONG[from.getMonth()]} ${from.getFullYear()} – ${MONTH_NAMES_LONG[to.getMonth()]} ${to.getFullYear()}`,
    };
  }

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    year,
    month,
    fromTime: from.getTime(),
    toTime: to.getTime(),
    label: `${MONTH_NAMES_LONG[month - 1]} ${year}`,
  };
}

export function getPrevMonthPeriod(year: number, month: number) {
  let py = year;
  let pm = month - 1;
  if (pm < 1) {
    pm = 12;
    py -= 1;
  }
  const from = new Date(py, pm - 1, 1);
  const to = new Date(py, pm, 0, 23, 59, 59, 999);
  return {
    year: py,
    month: pm,
    fromTime: from.getTime(),
    toTime: to.getTime(),
    label: `${MONTH_NAMES_LONG[pm - 1]} ${py}`,
  };
}

export function getSameMonthLastYearPeriod(year: number, month: number) {
  const py = year - 1;
  const from = new Date(py, month - 1, 1);
  const to = new Date(py, month, 0, 23, 59, 59, 999);
  return {
    year: py,
    month,
    fromTime: from.getTime(),
    toTime: to.getTime(),
    label: `${MONTH_NAMES_LONG[month - 1]} ${py}`,
  };
}

export function periodData(
  geoData: SalesItemWithDate[],
  fromTime: number,
  toTime: number
): SalesItemWithDate[] {
  return filterByTimeRange(geoData, fromTime, toTime);
}

type PeriodMetrics = {
  totalSales: number;
  salesAmount: number;
  grvAmount: number;
  returnsRate: number;
  invoices: number;
  grvInvoices: number;
  avgGrvValue: number;
  activeCustomers: number;
  avgInvoiceValue: number;
  newCustomers: number;
};

export function computePeriodMetrics(
  currentData: SalesItemWithDate[],
  compareData: SalesItemWithDate[],
  invoiceType?: string
): PeriodMetrics {
  let totalSales = 0;
  let salesAmount = 0;
  let grvAmount = 0;
  const invoiceSet = new Set<string>();
  const grvInvoiceSet = new Set<string>();
  const customers = new Set<string>();

  currentData.forEach((item) => {
    const amt = Number(item.amount) || 0;
    totalSales += amt;
    if (amt > 0) salesAmount += amt;
    else if (amt < 0) grvAmount += Math.abs(amt);
    if (isGrvInvoice(item.invoiceNumber)) {
      grvInvoiceSet.add(item.invoiceNumber!.trim());
    }
    if (shouldCountInvoiceForMode(item.invoiceNumber, invoiceType)) {
      invoiceSet.add(item.invoiceNumber!.trim());
    }
    customers.add(item.customerId || item.customerName || getMainCustomerName(item));
  });

  const compareByMain = groupCustomerAmounts(compareData);
  const currentByMain = groupCustomerAmounts(currentData);
  let newCustomers = 0;
  currentByMain.forEach((amount, name) => {
    if (amount > 0 && (compareByMain.get(name) || 0) === 0) newCustomers += 1;
  });

  const invoices = invoiceSet.size;
  const grvInvoices = grvInvoiceSet.size;
  const returnsRate = salesAmount > 0 ? (grvAmount / salesAmount) * 100 : 0;

  let avgInvoiceValue = 0;
  if (invoices > 0) {
    if (invoiceType === 'returns') avgInvoiceValue = grvAmount / invoices;
    else if (invoiceType === 'sales') avgInvoiceValue = salesAmount / invoices;
    else avgInvoiceValue = totalSales / invoices;
  }

  const avgGrvValue = grvInvoices > 0 ? grvAmount / grvInvoices : 0;

  return {
    totalSales,
    salesAmount,
    grvAmount,
    returnsRate,
    invoices,
    grvInvoices,
    avgGrvValue,
    activeCustomers: customers.size,
    avgInvoiceValue,
    newCustomers,
  };
}

export function groupCustomerAmounts(
  data: SalesItemWithDate[],
  groupBy: CustomerGroupBy = 'main'
): Map<string, number> {
  const map = new Map<string, number>();
  data.forEach((item) => {
    const name = getCustomerGroupKey(item, groupBy);
    map.set(name, (map.get(name) || 0) + (Number(item.amount) || 0));
  });
  return map;
}

export function buildCustomerChangeRows(
  currentData: SalesItemWithDate[],
  compareData: SalesItemWithDate[],
  groupBy: CustomerGroupBy = 'main'
): CustomerChangeRow[] {
  const current = groupCustomerAmounts(currentData, groupBy);
  const compare = groupCustomerAmounts(compareData, groupBy);
  const names = new Set([...current.keys(), ...compare.keys()]);
  const rows: CustomerChangeRow[] = [];

  names.forEach((name) => {
    const currentAmount = current.get(name) || 0;
    const compareAmount = compare.get(name) || 0;
    const changeAmount = currentAmount - compareAmount;
    const changePct =
      compareAmount !== 0 ? (changeAmount / Math.abs(compareAmount)) * 100 : currentAmount !== 0 ? 100 : 0;
    rows.push({ name, currentAmount, compareAmount, changeAmount, changePct });
  });

  return rows;
}

export function buildTopCustomers(
  currentData: SalesItemWithDate[],
  compareRows: CustomerChangeRow[],
  totalSales: number,
  groupBy: CustomerGroupBy = 'main',
  invoiceType?: string
): CustomerRankRow[] {
  const compareMap = new Map(compareRows.map((r) => [r.name, r]));
  const map = new Map<string, { amount: number; invoices: Set<string> }>();

  currentData.forEach((item) => {
    const name = getCustomerGroupKey(item, groupBy);
    const ex = map.get(name) || { amount: 0, invoices: new Set<string>() };
    ex.amount += Number(item.amount) || 0;
    if (shouldCountInvoiceForMode(item.invoiceNumber, invoiceType)) {
      ex.invoices.add(item.invoiceNumber!.trim());
    }
    map.set(name, ex);
  });

  return Array.from(map.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10)
    .map(([name, val], i) => {
      const cmp = compareMap.get(name);
      const comparePct = cmp?.changePct ?? 0;
      return {
        rank: i + 1,
        name,
        invoices: val.invoices.size,
        amount: val.amount,
        comparePct,
        sharePct: totalSales > 0 ? (val.amount / totalSales) * 100 : 0,
      };
    });
}

function groupCustomerGrvAmounts(
  data: SalesItemWithDate[],
  groupBy: CustomerGroupBy = 'main'
): Map<string, number> {
  const map = new Map<string, number>();
  data.forEach((item) => {
    if (!isGrvInvoice(item.invoiceNumber)) return;
    const amt = Math.abs(Number(item.amount) || 0);
    if (amt <= 0) return;
    const name = getCustomerGroupKey(item, groupBy);
    map.set(name, (map.get(name) || 0) + amt);
  });
  return map;
}

function buildCustomerGrvChangeRows(
  currentData: SalesItemWithDate[],
  compareData: SalesItemWithDate[],
  groupBy: CustomerGroupBy = 'main'
): CustomerChangeRow[] {
  const current = groupCustomerGrvAmounts(currentData, groupBy);
  const compare = groupCustomerGrvAmounts(compareData, groupBy);
  const names = new Set([...current.keys(), ...compare.keys()]);
  const rows: CustomerChangeRow[] = [];

  names.forEach((name) => {
    const currentAmount = current.get(name) || 0;
    const compareAmount = compare.get(name) || 0;
    const changeAmount = currentAmount - compareAmount;
    const changePct =
      compareAmount !== 0 ? (changeAmount / Math.abs(compareAmount)) * 100 : currentAmount !== 0 ? 100 : 0;
    rows.push({ name, currentAmount, compareAmount, changeAmount, changePct });
  });

  return rows;
}

export function buildTopReturnCustomers(
  currentData: SalesItemWithDate[],
  compareData: SalesItemWithDate[],
  totalGrv: number,
  groupBy: CustomerGroupBy = 'main'
): CustomerRankRow[] {
  const compareRows = buildCustomerGrvChangeRows(currentData, compareData, groupBy);
  const compareMap = new Map(compareRows.map((r) => [r.name, r]));
  const map = new Map<string, { amount: number; invoices: Set<string> }>();

  currentData.forEach((item) => {
    if (!isGrvInvoice(item.invoiceNumber)) return;
    const amt = Math.abs(Number(item.amount) || 0);
    if (amt <= 0) return;
    const name = getCustomerGroupKey(item, groupBy);
    const ex = map.get(name) || { amount: 0, invoices: new Set<string>() };
    ex.amount += amt;
    ex.invoices.add(item.invoiceNumber!.trim());
    map.set(name, ex);
  });

  return Array.from(map.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10)
    .map(([name, val], i) => {
      const cmp = compareMap.get(name);
      return {
        rank: i + 1,
        name,
        invoices: val.invoices.size,
        amount: val.amount,
        comparePct: cmp?.changePct ?? 0,
        sharePct: totalGrv > 0 ? (val.amount / totalGrv) * 100 : 0,
      };
    });
}

export function buildDeclining(rows: CustomerChangeRow[]): CustomerChangeRow[] {
  return rows
    .filter((r) => r.changeAmount < 0)
    .sort((a, b) => a.changeAmount - b.changeAmount)
    .slice(0, 10);
}

export function buildGrowing(rows: CustomerChangeRow[]): CustomerChangeRow[] {
  return rows
    .filter((r) => r.changeAmount > 0)
    .sort((a, b) => b.changeAmount - a.changeAmount)
    .slice(0, 10);
}

export function buildAtRisk(rows: CustomerChangeRow[]): AtRiskRow[] {
  return rows
    .filter((r) => r.currentAmount === 0 && r.compareAmount > 0)
    .sort((a, b) => b.compareAmount - a.compareAmount)
    .slice(0, 10)
    .map((r, i) => ({
      rank: i + 1,
      name: r.name,
      compareAmount: r.compareAmount,
      currentAmount: r.currentAmount,
    }));
}

export function buildTopProducts(data: SalesItemWithDate[], totalSales: number): ProductRankRow[] {
  const map = new Map<string, { barcode: string; name: string; qty: number; amount: number }>();
  data.forEach((item) => {
    const key = item.productId || item.product || item.barcode || 'Unknown';
    const ex = map.get(key) || {
      barcode: item.barcode || '',
      name: item.product || key,
      qty: 0,
      amount: 0,
    };
    ex.qty += Number(item.qty) || 0;
    ex.amount += Number(item.amount) || 0;
    map.set(key, ex);
  });

  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount || b.qty - a.qty)
    .slice(0, 10)
    .map((p, i) => ({
      rank: i + 1,
      ...p,
      sharePct: totalSales > 0 ? (p.amount / totalSales) * 100 : 0,
    }));
}

export function buildTopCategories(data: SalesItemWithDate[], totalSales: number): CategoryRankRow[] {
  const map = new Map<string, { qty: number; amount: number }>();
  data.forEach((item) => {
    const cat = item.productTag || 'Uncategorized';
    const ex = map.get(cat) || { qty: 0, amount: 0 };
    ex.qty += Number(item.qty) || 0;
    ex.amount += Number(item.amount) || 0;
    map.set(cat, ex);
  });

  return Array.from(map.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10)
    .map(([category, val], i) => ({
      rank: i + 1,
      category,
      qty: val.qty,
      amount: val.amount,
      sharePct: totalSales > 0 ? (val.amount / totalSales) * 100 : 0,
    }));
}

export function buildMonthlySparkline(
  geoData: SalesItemWithDate[],
  endYear: number,
  endMonth: number,
  points: number,
  valueFn: (items: SalesItemWithDate[]) => number
): number[] {
  const result: number[] = [];
  let y = endYear;
  let m = endMonth;

  for (let i = 0; i < points; i++) {
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59, 999);
    const slice = filterByTimeRange(geoData, from.getTime(), to.getTime());
    result.unshift(valueFn(slice));
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return result;
}

export function buildLast6MonthsComparison(
  geoData: SalesItemWithDate[],
  endYear: number,
  endMonth: number,
  getTarget: (year: number, month: number) => number,
  options?: { showTarget?: boolean; invoiceType?: string }
) {
  const invoiceType = options?.invoiceType;
  const months: { month: string; actual: number; target: number; lastYear: number; prevMonth: number }[] = [];
  let y = endYear;
  let m = endMonth;

  for (let i = 0; i < 6; i++) {
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59, 999);
    const lyFrom = new Date(y - 1, m - 1, 1);
    const lyTo = new Date(y - 1, m, 0, 23, 59, 59, 999);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const pmFrom = new Date(py, pm - 1, 1);
    const pmTo = new Date(py, pm, 0, 23, 59, 59, 999);

    const actual = monthPrimaryAmount(geoData, from.getTime(), to.getTime(), invoiceType);
    const lastYear = monthPrimaryAmount(geoData, lyFrom.getTime(), lyTo.getTime(), invoiceType);
    const prevMonth = monthPrimaryAmount(geoData, pmFrom.getTime(), pmTo.getTime(), invoiceType);

    months.unshift({
      month: MONTH_NAMES[m - 1],
      actual,
      target: options?.showTarget === false ? 0 : getTarget(y, m),
      lastYear,
      prevMonth,
    });

    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  return months;
}

function formatInvoiceDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function buildTopInvoicesByValue(
  data: SalesItemWithDate[],
  kind: 'sales' | 'returns',
  limit = 10
): InvoiceRankRow[] {
  const map = new Map<string, { date: string; customerName: string; amount: number }>();

  data.forEach((item) => {
    const num = item.invoiceNumber?.trim();
    if (!num) return;
    if (kind === 'sales' && !isSalInvoice(num)) return;
    if (kind === 'returns' && !isGrvInvoice(num)) return;

    const amt = Number(item.amount) || 0;
    const contribution = kind === 'returns' ? Math.abs(amt) : Math.max(0, amt);
    if (contribution <= 0) return;

    const existing = map.get(num);
    if (existing) {
      existing.amount += contribution;
    } else {
      map.set(num, {
        date: item.invoiceDate || '',
        customerName: (item.customerName || getMainCustomerName(item)).trim(),
        amount: contribution,
      });
    }
  });

  return [...map.entries()]
    .map(([invoiceNumber, val]) => ({ invoiceNumber, ...val }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((row, i) => ({
      rank: i + 1,
      date: formatInvoiceDate(row.date),
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName || '—',
      amount: row.amount,
    }));
}

function listMonthsInRange(fromTime: number, toTime: number): { year: number; month: number }[] {
  const from = new Date(fromTime);
  const to = new Date(toTime);
  const months: { year: number; month: number }[] = [];
  let y = from.getFullYear();
  let m = from.getMonth() + 1;
  const endY = to.getFullYear();
  const endM = to.getMonth() + 1;

  while (y < endY || (y === endY && m <= endM)) {
    months.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export function buildDailySalesCalendars(
  data: SalesItemWithDate[],
  period: { fromTime: number; toTime: number }
): DailySalesCalendar[] {
  const months = listMonthsInRange(period.fromTime, period.toTime);

  return months.map(({ year, month }) => {
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999).getTime();
    const rangeStart = Math.max(period.fromTime, monthStart);
    const rangeEnd = Math.min(period.toTime, monthEnd);

    const dayMap = new Map<number, number>();
    data.forEach((item) => {
      if (!item.time || item.time < rangeStart || item.time > rangeEnd) return;
      const d = new Date(item.time);
      if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;
      const day = d.getDate();
      dayMap.set(day, (dayMap.get(day) || 0) + (Number(item.amount) || 0));
    });

    const lastDay = new Date(year, month, 0).getDate();
    const days: DailySalesCalendarDay[] = [];
    let maxAmount = 0;

    for (let d = 1; d <= lastDay; d++) {
      const dayStart = new Date(year, month - 1, d).getTime();
      const dayEnd = new Date(year, month - 1, d, 23, 59, 59, 999).getTime();
      const inRange = dayEnd >= rangeStart && dayStart <= rangeEnd;
      const amount = inRange ? dayMap.get(d) || 0 : 0;
      if (inRange && amount > maxAmount) maxAmount = amount;

      days.push({
        day: d,
        date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        amount,
        inRange,
      });
    }

    return {
      year,
      month,
      monthLabel: `${MONTH_NAMES_LONG[month - 1]} ${year}`,
      days,
      maxAmount,
    };
  });
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current !== 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function absChange(current: number, previous: number): number {
  return current - previous;
}

export { MONTH_NAMES, MONTH_NAMES_LONG };
