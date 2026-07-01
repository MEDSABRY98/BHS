import type { SalesCommonFilters } from '@/app/Sales/Model/SalesFilters';

export type CompareMode = 'prevMonth' | 'sameMonthLastYear';
export type CustomerView = 'main' | 'sub';

export type CustomerCompareBlock = {
  topCustomers: Array<{
    rank: number;
    name: string;
    invoices: number;
    amount: number;
    comparePct?: number;
    sharePct?: number;
  }>;
  topReturnCustomers: Array<{
    rank: number;
    name: string;
    invoices: number;
    amount: number;
    comparePct?: number;
    sharePct?: number;
  }>;
  topDeclining: Array<{
    rank: number;
    name: string;
    currentAmount: number;
    compareAmount: number;
    changeAmount: number;
    changePct?: number;
  }>;
  topGrowing: Array<{
    rank: number;
    name: string;
    currentAmount: number;
    compareAmount: number;
    changeAmount: number;
    changePct?: number;
  }>;
  atRisk: Array<{
    rank: number;
    name: string;
    compareAmount: number;
    currentAmount: number;
  }>;
};

export type ReportsPayload = {
  repDisplayName: string;
  periodLabel: string;
  reportingMode?: 'all' | 'sales' | 'returns';
  reportingModeLabel?: string;
  primaryAmountLabel?: string;
  compareModes: Record<CompareMode, { label: string }>;
  kpis: Record<
    string,
    {
      value: number;
      changePct?: number;
      changeAbs?: number;
      sparkline?: number[];
      grvAmount?: number;
      returnsAmount?: number;
    }
  >;
  kpiViews?: Record<CompareMode, ReportsPayload['kpis']>;
  monthlyComparison: { month: string; actual: number; target: number; lastYear: number; prevMonth: number }[];
  dailySalesCalendars?: import('@/app/Sales/Utils/ReportsAggregation').DailySalesCalendar[];
  customerViews: Record<CustomerView, Record<CompareMode, CustomerCompareBlock>>;
  topProducts: Array<{
    rank: number;
    barcode?: string;
    name: string;
    qty: number;
    amount: number;
    sharePct?: number;
  }>;
  topCategories: Array<{
    rank: number;
    category: string;
    qty: number;
    amount: number;
    sharePct?: number;
  }>;
  topSalesInvoices?: Array<{
    rank: number;
    date: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
  }>;
  topReturnInvoices?: Array<{
    rank: number;
    date: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
  }>;
};

export type SalesReportsInput = {
  data: ReportsPayload;
  compareBlock: CustomerCompareBlock;
  compareMode: CompareMode;
  compareLabel: string;
  customerView: CustomerView;
  filters: SalesCommonFilters;
  dateFrom?: string;
  dateTo?: string;
};

export type ReportsTableSection = {
  title: string;
  subtitle?: string;
  head: string[];
  body: string[][];
  columnWidths: number[];
  negativeColumns?: number[];
  textColumnIndexes?: number[];
  amountColumnIndexes?: number[];
};
