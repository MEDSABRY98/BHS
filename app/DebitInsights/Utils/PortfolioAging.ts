import { InvoiceRow } from '@/types';
import { parseDate } from './DateUtils';
import { AgingBreakdown } from './InsightsTypes';

export interface CustomerAgingResult {
  customerName: string;
  netDebt: number;
  overdueAmount: number;
  agingBreakdown: AgingBreakdown;
}

export interface PortfolioAgingResult {
  totalOpenDebt: number;
  agingBreakdown: AgingBreakdown;
  openByCustomer: CustomerAgingResult[];
}

const EMPTY_AGING: AgingBreakdown = {
  atDate: 0,
  oneToThirty: 0,
  thirtyOneToSixty: 0,
  sixtyOneToNinety: 0,
  ninetyOneToOneTwenty: 0,
  older: 0,
};

function normalizeReferenceDate(referenceDate: Date): Date {
  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);
  return ref;
}

function addToBucket(breakdown: AgingBreakdown, daysOverdue: number, amount: number) {
  if (daysOverdue <= 0) breakdown.atDate += amount;
  else if (daysOverdue <= 30) breakdown.oneToThirty += amount;
  else if (daysOverdue <= 60) breakdown.thirtyOneToSixty += amount;
  else if (daysOverdue <= 90) breakdown.sixtyOneToNinety += amount;
  else if (daysOverdue <= 120) breakdown.ninetyOneToOneTwenty += amount;
  else breakdown.older += amount;
}

function computeDaysOverdue(
  dueDate: string | null | undefined,
  invoiceDate: string | null | undefined,
  referenceDate: Date
): number {
  const targetDate = dueDate ? parseDate(dueDate) : invoiceDate ? parseDate(invoiceDate) : null;
  if (!targetDate) return 0;
  targetDate.setHours(0, 0, 0, 0);
  return Math.ceil((referenceDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeCustomerAging(
  customerInvoices: InvoiceRow[],
  referenceDate: Date = new Date()
): CustomerAgingResult {
  const ref = normalizeReferenceDate(referenceDate);
  const customerName = customerInvoices[0]?.customerName || '';
  const netDebt =
    customerInvoices.reduce((sum, inv) => sum + inv.debit, 0) -
    customerInvoices.reduce((sum, inv) => sum + inv.credit, 0);

  const agingBreakdown: AgingBreakdown = { ...EMPTY_AGING };
  let totalOverdue = 0;

  const matchingGroups = new Map<string, InvoiceRow[]>();
  customerInvoices.forEach((inv) => {
    const key = inv.matching || 'UNMATCHED';
    const group = matchingGroups.get(key) || [];
    group.push(inv);
    matchingGroups.set(key, group);
  });

  matchingGroups.forEach((group, matchingKey) => {
    const groupNetDebt = group.reduce((sum, inv) => sum + (inv.debit - inv.credit), 0);
    if (Math.abs(groupNetDebt) <= 0.01) return;

    if (matchingKey === 'UNMATCHED') {
      group.forEach((inv) => {
        const invNetDebt = inv.debit - inv.credit;
        if (Math.abs(invNetDebt) <= 0.01) return;
        const daysOverdue = computeDaysOverdue(inv.dueDate, inv.date, ref);
        addToBucket(agingBreakdown, daysOverdue, invNetDebt);
        totalOverdue += invNetDebt;
      });
    } else {
      const firstInv = group[0];
      const daysOverdue = computeDaysOverdue(firstInv.dueDate, firstInv.date, ref);
      addToBucket(agingBreakdown, daysOverdue, groupNetDebt);
      totalOverdue += groupNetDebt;
    }
  });

  return { customerName, netDebt, overdueAmount: totalOverdue, agingBreakdown };
}

function mergeBreakdowns(target: AgingBreakdown, source: AgingBreakdown) {
  target.atDate += source.atDate;
  target.oneToThirty += source.oneToThirty;
  target.thirtyOneToSixty += source.thirtyOneToSixty;
  target.sixtyOneToNinety += source.sixtyOneToNinety;
  target.ninetyOneToOneTwenty += source.ninetyOneToOneTwenty;
  target.older += source.older;
}

export function computePortfolioAging(
  rows: InvoiceRow[],
  referenceDate: Date = new Date(),
  cities: string[] = [],
  customers: string[] = [],
  customerTags: string[] = []
): PortfolioAgingResult {
  const customerMap = new Map<string, InvoiceRow[]>();

  rows.forEach((row) => {
    if (cities.length > 0) {
      const city = row.salesRep?.trim();
      if (!city || !cities.includes(city)) return;
    }
    if (customers.length > 0) {
      const name = row.customerName?.trim();
      if (!name || !customers.includes(name)) return;
    }
    if (customerTags.length > 0) {
      const tag = row.customerTag?.trim();
      if (!tag || !customerTags.includes(tag)) return;
    }
    const existing = customerMap.get(row.customerName) || [];
    existing.push(row);
    customerMap.set(row.customerName, existing);
  });

  const openByCustomer: CustomerAgingResult[] = [];
  const agingBreakdown: AgingBreakdown = { ...EMPTY_AGING };
  let totalOpenDebt = 0;

  customerMap.forEach((customerInvoices) => {
    const result = computeCustomerAging(customerInvoices, referenceDate);
    if (result.netDebt <= 0.01) return;
    openByCustomer.push(result);
    mergeBreakdowns(agingBreakdown, result.agingBreakdown);
    totalOpenDebt += result.overdueAmount;
  });

  openByCustomer.sort((a, b) => b.netDebt - a.netDebt);

  return { totalOpenDebt, agingBreakdown, openByCustomer };
}
