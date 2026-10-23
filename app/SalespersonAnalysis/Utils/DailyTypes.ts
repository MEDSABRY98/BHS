// Daily sales report data (Scheduled Reports → Reports/DailySales.ts)

import type { Period } from './Types';

/** One sales line in the report period. */
export type DailySalesLine = {
  date: string; // YYYY-MM-DD
  invoice: string;
  salespersonId: string;
  customerId: string;
  productId: string;
  amount: number; // < 0 = return
  qty: number;
  cost: number; // unit cost, 0 when costs are hidden for the user
};

/** Totals of a period (used for the previous period comparison). */
export type DailyTotals = {
  gross: number;
  returns: number; // positive number
  net: number;
  invoices: number;
  customers: number;
  qty: number; // quantity sold (sales lines)
  profit: number; // gross profit of the lines that have a cost
  costedSales: number; // net sales of the lines that have a cost (for the margin %)
};

export type DailySalesReportData = {
  period: Period;
  /** the period of the same length right before (e.g. the day before) */
  prevPeriod: Period;
  /** false = the user only sees himself */
  allSalespersons: boolean;
  showCosts: boolean;
  salespersons: Record<string, string>; // id -> name
  customers: Record<string, { name: string; mainName: string; city: string }>;
  products: Record<string, { barcode: string; name: string; category: string }>;
  lines: DailySalesLine[];
  prevTotals: DailyTotals;
  prevNetBySalesperson: Record<string, number>;
  /** previous period totals per salesperson (for his own cards) */
  prevTotalsBySalesperson?: Record<string, DailyTotals>;
  /** per customer: previous period net + buying pattern of the last 180 days (Declining / Missed tables) */
  customerStats?: Record<string, CustomerStats>;
};

export type CustomerStats = {
  salespersonId: string;
  prevNet: number; // net in the previous period (same length)
  lastPurchase: string; // last day with a sale, up to the period end (YYYY-MM-DD)
  purchaseDays: number; // days with a sale in the last 180 days
  avgGapDays: number; // average days between those purchase days (0 = one day only)
  avgOrder: number; // gross / invoices in the last 180 days
};
