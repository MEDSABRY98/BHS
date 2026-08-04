export type InsightsPeriodPreset = 'trailing12m' | 'ytd' | 'trailing6m' | 'trailing3m' | 'custom';

export interface InsightsFilters {
  asOfDate: string;
  periodPreset: InsightsPeriodPreset;
  periodFrom: string;
  periodTo: string;
  salesRep: string[];
  customers: string[];
}

export interface AgingBreakdown {
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
}

export interface InsightsPeriodMetrics {
  netSales: number;
  netSalesPriorYear: number;
  netSalesYoYChange: number | null;
  collections: number;
  collectionRate: number | null;
}

export interface InsightsTrendPoint {
  month: string;
  monthLabel: string;
  openDebt: number;
  netSales: number;
  collections: number;
}

export interface DebitInsightsMetrics {
  totalOpenDebt: number;
  agingBreakdown: AgingBreakdown;
  period: InsightsPeriodMetrics;
  trendSeries: InsightsTrendPoint[];
  salesReps: string[];
}
