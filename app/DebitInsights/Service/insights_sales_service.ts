'use server';

import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';
import {
  endOfDay,
  getMonthlyKey,
  parseDate,
  startOfDay,
} from '@/app/DebitInsights/Utils/DateUtils';
import type { InsightsSalesOverlay } from '@/app/DebitInsights/Utils/InsightsTypes';

export type InsightsSalesOverlayInput = {
  userId: string;
  periodFrom: string;
  periodTo: string;
  cities: string[];
  customers: string[];
};

function isSalesOrReturn(invoiceNumber?: string | null): boolean {
  const num = (invoiceNumber || '').toString().toUpperCase().trim();
  return num.startsWith('SAL') || num.startsWith('RSAL');
}

function shiftYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function matchesCity(area: string | undefined, cities: string[]): boolean {
  if (cities.length === 0) return true;
  const value = (area || '').trim();
  return value ? cities.includes(value) : false;
}

function matchesCustomer(mainName: string | undefined, customers: string[]): boolean {
  if (customers.length === 0) return true;
  const value = (mainName || '').trim();
  return value ? customers.includes(value) : false;
}

function parseInvoiceDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const parsed = parseDate(raw);
  if (parsed) return parsed;
  const direct = new Date(raw);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function sumAmountInRange(
  rows: any[],
  from: Date,
  to: Date,
  cities: string[],
  customers: string[],
  monthlyOut?: Map<string, number>
): number {
  let total = 0;
  rows.forEach((row) => {
    if (!isSalesOrReturn(row.invoiceNumber)) return;
    if (!matchesCity(row.area, cities)) return;
    if (!matchesCustomer(row.customerMainName, customers)) return;

    const d = parseInvoiceDate(row.invoiceDate);
    if (!d || d < from || d > to) return;

    const amount = Number(row.amount) || 0;
    total += amount;

    if (monthlyOut) {
      const key = getMonthlyKey(d);
      monthlyOut.set(key, (monthlyOut.get(key) || 0) + amount);
    }
  });
  return total;
}

const EMPTY_OVERLAY: InsightsSalesOverlay = {
  periodNetSales: 0,
  priorYearNetSales: 0,
  monthly: [],
};

export async function getInsightsSalesOverlay(
  input: InsightsSalesOverlayInput
): Promise<InsightsSalesOverlay> {
  const userId = String(input.userId || '').trim();
  if (!userId) return EMPTY_OVERLAY;

  const from = startOfDay(input.periodFrom);
  const to = endOfDay(input.periodTo);
  const priorFrom = shiftYears(from, -1);
  const priorTo = shiftYears(to, -1);
  const cities = input.cities || [];
  const customers = input.customers || [];

  try {
    const rows = await getFilteredSalesData(userId);
    const monthlyMap = new Map<string, number>();

    const periodNetSales = sumAmountInRange(rows, from, to, cities, customers, monthlyMap);
    const priorYearNetSales = sumAmountInRange(rows, priorFrom, priorTo, cities, customers);

    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, netSales]) => ({ month, netSales }));

    return { periodNetSales, priorYearNetSales, monthly };
  } catch (error) {
    console.error('getInsightsSalesOverlay failed:', error);
    return EMPTY_OVERLAY;
  }
}
