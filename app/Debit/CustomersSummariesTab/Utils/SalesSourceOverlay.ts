import type {
  CustomerSalesYearBreakdown,
  SummariesSalesOverlay,
} from './SummariesTypes';

export type CustomerSummarySalesFields = {
  customerName: string;
  city?: string;
  salesPrev: number;
  returnsPrev: number;
  salesCurrent: number;
  returnsCurrent: number;
  netSalesPrev: number;
  netSalesCurrent: number;
  growth: number | null;
  oneToThirty?: number;
  thirtyOneToSixty?: number;
  sixtyOneToNinety?: number;
  ninetyOneToOneTwenty?: number;
  older?: number;
  totalAging?: number;
};

/**
 * Overlay Sales DB net sales onto Debit-based customer summaries.
 * Aging fields are preserved from Debit rows; Sales-only customers get zero aging.
 */
export function applyCustomerSalesOverlay<T extends CustomerSummarySalesFields>(
  debitSummaries: T[],
  overlay: SummariesSalesOverlay
): T[] {
  const lookup = new Map<string, CustomerSalesYearBreakdown>();
  overlay.byCustomer.forEach((row) => {
    lookup.set(row.customerName.trim().toLowerCase(), row);
  });

  const debitNames = new Set(debitSummaries.map((row) => row.customerName.trim().toLowerCase()));
  const merged: T[] = debitSummaries.map((row) => {
    const sales = lookup.get(row.customerName.trim().toLowerCase());
    if (!sales) {
      return {
        ...row,
        salesPrev: 0,
        returnsPrev: 0,
        salesCurrent: 0,
        returnsCurrent: 0,
        netSalesPrev: 0,
        netSalesCurrent: 0,
        growth: null,
      };
    }

    const netSalesPrev = sales.netSalesPrev;
    const netSalesCurrent = sales.netSalesCurrent;
    const growth =
      netSalesPrev > 0 ? ((netSalesCurrent - netSalesPrev) / netSalesPrev) * 100 : null;

    return {
      ...row,
      salesPrev: sales.salesPrev,
      returnsPrev: sales.returnsPrev,
      salesCurrent: sales.salesCurrent,
      returnsCurrent: sales.returnsCurrent,
      netSalesPrev,
      netSalesCurrent,
      growth,
    };
  });

  overlay.byCustomer.forEach((sales) => {
    const key = sales.customerName.trim().toLowerCase();
    if (debitNames.has(key)) return;
    if (Math.abs(sales.netSalesPrev) <= 0.01 && Math.abs(sales.netSalesCurrent) <= 0.01) {
      return;
    }

    const growth =
      sales.netSalesPrev > 0
        ? ((sales.netSalesCurrent - sales.netSalesPrev) / sales.netSalesPrev) * 100
        : null;

    merged.push({
      customerName: sales.customerName,
      city: sales.city,
      salesPrev: sales.salesPrev,
      returnsPrev: sales.returnsPrev,
      salesCurrent: sales.salesCurrent,
      returnsCurrent: sales.returnsCurrent,
      netSalesPrev: sales.netSalesPrev,
      netSalesCurrent: sales.netSalesCurrent,
      growth,
      oneToThirty: 0,
      thirtyOneToSixty: 0,
      sixtyOneToNinety: 0,
      ninetyOneToOneTwenty: 0,
      older: 0,
      totalAging: 0,
    } as T);
  });

  return merged;
}
