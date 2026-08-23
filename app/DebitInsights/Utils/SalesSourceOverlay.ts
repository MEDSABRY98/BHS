import type {
  DebitInsightsMetrics,
  InsightsSalesOverlay,
} from './InsightsTypes';

function computeYoYChange(current: number, previous: number): number | null {
  if (Math.abs(previous) <= 0.01) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Replaces Debit-ledger net sales with Sales DB amounts.
 * Keeps open debt, aging, and collections from Debit.
 */
export function applySalesNetOverlay(
  metrics: DebitInsightsMetrics,
  overlay: InsightsSalesOverlay
): DebitInsightsMetrics {
  const monthlyLookup = new Map(overlay.monthly.map((point) => [point.month, point.netSales]));
  const currentYearLookup = new Map(overlay.monthlyCurrentYear.map((point) => [point.month, point.netSales]));
  const previousYearLookup = new Map(overlay.monthlyPreviousYear.map((point) => [point.month, point.netSales]));

  const netSales = overlay.periodNetSales;
  const netSalesPriorYear = overlay.priorYearNetSales;
  const netSalesYoYChange = computeYoYChange(netSales, netSalesPriorYear);
  const collections = metrics.period.collections;
  const collectionRate = netSales > 0.01 ? (collections / netSales) * 100 : null;

  return {
    ...metrics,
    period: {
      ...metrics.period,
      netSales,
      netSalesPriorYear,
      netSalesYoYChange,
      collectionRate,
    },
    trendSeries: metrics.trendSeries.map((point) => ({
      ...point,
      netSales: monthlyLookup.get(point.month) ?? 0,
    })),
    currentYearTrend: metrics.currentYearTrend.map((point) => ({
      ...point,
      netSales: currentYearLookup.get(point.month) ?? 0,
    })),
    previousYearTrend: metrics.previousYearTrend.map((point) => ({
      ...point,
      netSales: previousYearLookup.get(point.month) ?? 0,
    })),
  };
}
