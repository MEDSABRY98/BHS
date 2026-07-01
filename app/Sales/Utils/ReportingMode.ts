import type { InvoiceTypeFilter } from '@/app/Sales/Model/SalesFilters';

export type ReportingMode = InvoiceTypeFilter;

export const REPORTING_MODE_LABELS: Record<ReportingMode, string> = {
  all: 'Net Sales',
  sales: 'Sales Only',
  returns: 'GRV Only',
};

export const PRIMARY_AMOUNT_LABELS: Record<ReportingMode, string> = {
  all: 'Net Sales Amount',
  sales: 'Sales Amount',
  returns: 'GRV Amount',
};

export const INVOICES_LABELS: Record<ReportingMode, string> = {
  all: 'Invoices Issued',
  sales: 'Invoices Issued',
  returns: 'GRV Invoices',
};

export const AVG_INVOICE_LABELS: Record<ReportingMode, string> = {
  all: 'Avg Invoice Value',
  sales: 'Avg Invoice Value',
  returns: 'Avg GRV Value',
};

export type KpiConfigKey =
  | 'totalSales'
  | 'targetAchievement'
  | 'returnsRate'
  | 'invoices'
  | 'avgInvoiceValue'
  | 'returnInvoices'
  | 'avgReturnValue'
  | 'activeCustomers'
  | 'newCustomers';

export type PeriodAmounts = {
  totalSales: number;
  salesAmount: number;
  grvAmount: number;
};

export function resolveReportingMode(invoiceType?: string): ReportingMode {
  if (invoiceType === 'sales') return 'sales';
  if (invoiceType === 'returns') return 'returns';
  return 'all';
}

export function getPrimaryAmount(metrics: PeriodAmounts, mode: ReportingMode): number {
  if (mode === 'sales') return metrics.salesAmount;
  if (mode === 'returns') return metrics.grvAmount;
  return metrics.totalSales;
}

export function shouldShowTargetAchievement(mode: ReportingMode): boolean {
  return mode !== 'returns';
}

export function shouldShowReturnAmountKpi(mode: ReportingMode): boolean {
  return mode === 'all';
}

export function shouldShowTargetInChart(mode: ReportingMode): boolean {
  return mode !== 'returns';
}

export function getVisibleKpiKeys(mode: ReportingMode): KpiConfigKey[] {
  const keys: KpiConfigKey[] = ['totalSales'];
  if (shouldShowTargetAchievement(mode)) keys.push('targetAchievement');
  keys.push('invoices', 'avgInvoiceValue');
  if (shouldShowReturnAmountKpi(mode)) {
    keys.push('returnsRate', 'returnInvoices', 'avgReturnValue');
  }
  keys.push('activeCustomers', 'newCustomers');
  return keys;
}

export function shouldInvertReturnKpiChange(key: KpiConfigKey): boolean {
  return key === 'returnsRate' || key === 'returnInvoices' || key === 'avgReturnValue';
}

export function getChartTitle(
  mode: ReportingMode,
  compareMode: 'prevMonth' | 'sameMonthLastYear'
): string {
  if (mode === 'returns') {
    return compareMode === 'prevMonth'
      ? 'Monthly GRV vs Previous Month'
      : 'Monthly GRV vs Same Period Last Year';
  }
  const amountWord = mode === 'sales' ? 'Sales' : 'Net Sales';
  return compareMode === 'prevMonth'
    ? `Monthly ${amountWord} vs Target & Previous Month`
    : `Monthly ${amountWord} vs Target & Last Year`;
}

export function getChartActualLabel(mode: ReportingMode): string {
  if (mode === 'returns') return 'Actual GRV';
  if (mode === 'sales') return 'Actual Sales';
  return 'Actual Net Sales';
}

export function getCustomersTableTitle(mode: ReportingMode): string {
  if (mode === 'returns') return 'Top 10 Customers by GRV';
  if (mode === 'sales') return 'Top 10 Customers by Sales';
  return 'Top 10 Customers by Net Sales';
}

export function getReturnCustomersTableTitle(): string {
  return 'Top 10 Customers by Returns';
}

export function getAmountTableSubtitle(mode: ReportingMode): string {
  if (mode === 'returns') return 'By GRV amount this period';
  if (mode === 'sales') return 'By sales amount this period';
  return 'By net sales amount this period';
}

export function getKpiCompareLabel(
  compareMode: 'prevMonth' | 'sameMonthLastYear',
  comparePeriodLabel?: string
): string {
  if (compareMode === 'sameMonthLastYear') {
    return comparePeriodLabel ? `vs ${comparePeriodLabel}` : 'vs same month last year';
  }
  return 'vs last month';
}

export function getKpiLabel(
  key: KpiConfigKey,
  mode: ReportingMode
): string {
  switch (key) {
    case 'totalSales':
      return PRIMARY_AMOUNT_LABELS[mode];
    case 'invoices':
      return INVOICES_LABELS[mode];
    case 'avgInvoiceValue':
      return AVG_INVOICE_LABELS[mode];
    case 'targetAchievement':
      return 'Target Achievement';
    case 'returnsRate':
      return 'Return Amount';
    case 'returnInvoices':
      return 'Return Invoices';
    case 'avgReturnValue':
      return 'Avg Return Value';
    case 'activeCustomers':
      return 'Active Customers';
    case 'newCustomers':
      return 'New Customers';
    default:
      return key;
  }
}
