import { InvoiceRow } from '@/types';
import {
  exportStyledExcelWorkbook,
  recordsFromTable,
  type StyledExcelSheet,
} from '@/app/Components/Export/ExcelExport';
import { computePaymentExportPayload, type PeriodMetric } from './PaymentExportData';
import type { PaymentPdfFilterContext } from './PaymentUtils';

const SECTION_LABELS: Record<keyof NonNullable<PaymentPdfFilterContext['sections']>, string> = {
  summary: 'Summary',
  summaryPrevious: 'Summary Previous',
  summaryLastYear: 'Summary Last Year',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  customerList: 'Customers Paid',
  nonPayerList: 'Customers Not Paid',
  gapAnalysis: 'Gap Analysis',
  salesRep: 'City',
};

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, '').trim().slice(0, 31) || 'Sheet';
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (date: Date) =>
    date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${fmt(start)} - ${fmt(end)}`;
}

function periodMetricRows(metrics: PeriodMetric[], periodLabel: string) {
  return metrics.map((metric) => {
    const diffPrev = metric.previous > 0 ? ((metric.current - metric.previous) / metric.previous) * 100 : 0;
    const diffLy = metric.lastYear > 0 ? ((metric.current - metric.lastYear) / metric.lastYear) * 100 : 0;
    return {
      [periodLabel]: metric.label,
      Current: metric.current,
      Previous: metric.previous,
      'Change %': Number(diffPrev.toFixed(1)),
      'Last Year': metric.lastYear,
      'YoY %': Number(diffLy.toFixed(1)),
    };
  });
}

function buildSheets(
  payload: ReturnType<typeof computePaymentExportPayload>,
  sections: PaymentPdfFilterContext['sections'],
): StyledExcelSheet[] {
  const sheets: StyledExcelSheet[] = [];
  const selected = sections ?? {};

  if (selected.summary !== false) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.summary),
      data: [
        {
          Metric: 'Date Range',
          Value: formatDateRange(payload.startDate, payload.endDate),
        },
        { Metric: 'Total Collections', Value: payload.curMet.total },
        { Metric: 'Transactions', Value: payload.curMet.count },
        { Metric: 'Active Customers', Value: payload.curMet.uniqueCustomers },
        { Metric: 'Collections Growth vs Previous %', Value: Number(payload.revenueTrend.toFixed(1)) },
        { Metric: 'Customer Growth vs Previous %', Value: Number(payload.custTrend.toFixed(1)) },
        { Metric: 'Transaction Growth vs Previous %', Value: Number(payload.countTrend.toFixed(1)) },
        { Metric: 'Collections Growth vs Last Year %', Value: Number(payload.revenueTrendLY.toFixed(1)) },
        { Metric: 'Customer Growth vs Last Year %', Value: Number(payload.custTrendLY.toFixed(1)) },
        { Metric: 'Transaction Growth vs Last Year %', Value: Number(payload.countTrendLY.toFixed(1)) },
      ],
      options: {
        numericColumns: [
          'Value',
        ],
      },
    });
  }

  if (selected.summaryPrevious !== false) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.summaryPrevious),
      data: [
        { Metric: 'Date Range', Value: formatDateRange(payload.prevStartDate, payload.prevEndDate) },
        { Metric: 'Total Collections', Value: payload.prevMet.total },
        { Metric: 'Transactions', Value: payload.prevMet.count },
        { Metric: 'Active Customers', Value: payload.prevMet.uniqueCustomers },
      ],
      options: { numericColumns: ['Value'] },
    });
  }

  if (selected.summaryLastYear !== false && payload.hasLYData) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.summaryLastYear),
      data: [
        { Metric: 'Date Range', Value: formatDateRange(payload.lyStartDate, payload.lyEndDate) },
        { Metric: 'Total Collections', Value: payload.lyMet.total },
        { Metric: 'Transactions', Value: payload.lyMet.count },
        { Metric: 'Active Customers', Value: payload.lyMet.uniqueCustomers },
      ],
      options: { numericColumns: ['Value'] },
    });
  }

  if (selected.daily !== false && payload.days.length > 0) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.daily),
      data: periodMetricRows(payload.days, 'Date'),
      options: {
        numericColumns: ['Current', 'Previous', 'Change %', 'Last Year', 'YoY %'],
      },
    });
  }

  if (selected.weekly !== false && payload.weeks.length > 0) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.weekly),
      data: periodMetricRows(payload.weeks, 'Week'),
      options: {
        numericColumns: ['Current', 'Previous', 'Change %', 'Last Year', 'YoY %'],
      },
    });
  }

  if (selected.monthly !== false && payload.months.length > 0) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.monthly),
      data: periodMetricRows(payload.months, 'Month'),
      options: {
        numericColumns: ['Current', 'Previous', 'Change %', 'Last Year', 'YoY %'],
      },
    });
  }

  if (selected.customerList !== false && payload.paidCustomerRows.length > 0) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.customerList),
      data: recordsFromTable(
        ['#', 'Customer Name', 'City', 'Total Paid', 'Count', 'Payment Dates', 'Gap'],
        payload.paidCustomerRows,
      ),
      options: {
        numericColumns: ['Total Paid', 'Count'],
      },
    });
  }

  if (selected.nonPayerList !== false && payload.nonPayerRows.length > 0) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.nonPayerList),
      data: recordsFromTable(
        ['#', 'Customer Name', 'City', 'Balance Due', 'Last Payment', 'Last Payment Amount', 'Days Since'],
        payload.nonPayerRows,
      ),
      options: {
        numericColumns: ['Balance Due', 'Last Payment Amount'],
      },
    });
  }

  if (selected.gapAnalysis !== false) {
    const bucketLabels = Object.keys(payload.gapBuckets);
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.gapAnalysis),
      data: bucketLabels.map((label) => ({
        Bucket: label,
        'Current Count': payload.gapBuckets[label].count,
        'Current Amount': payload.gapBuckets[label].totalAmount,
        'Previous Count': payload.gapBucketsPrev[label]?.count ?? 0,
        'Previous Amount': payload.gapBucketsPrev[label]?.totalAmount ?? 0,
        'Last Year Count': payload.gapBucketsLY[label]?.count ?? 0,
        'Last Year Amount': payload.gapBucketsLY[label]?.totalAmount ?? 0,
      })),
      options: {
        numericColumns: [
          'Current Count',
          'Current Amount',
          'Previous Count',
          'Previous Amount',
          'Last Year Count',
          'Last Year Amount',
        ],
      },
    });
  }

  if (selected.salesRep !== false && payload.cityRows.length > 0) {
    sheets.push({
      name: sanitizeSheetName(SECTION_LABELS.salesRep),
      data: recordsFromTable(
        ['#', 'City', 'Total Collected', 'Txns', 'Clients', 'Share %'],
        payload.cityRows,
      ),
      options: {
        numericColumns: ['Total Collected', 'Txns', 'Clients', 'Share %'],
      },
    });
  }

  return sheets;
}

export async function generatePaymentAnalysisExcel(
  allData: InvoiceRow[],
  filters: PaymentPdfFilterContext,
): Promise<void> {
  const payload = computePaymentExportPayload(allData, filters);
  const sheets = buildSheets(payload, filters.sections);

  if (sheets.length === 0) {
    throw new Error('No report sections selected for Excel export.');
  }

  const dateStr = new Date().toISOString().split('T')[0];
  await exportStyledExcelWorkbook(sheets, `Collections_Analysis_${dateStr}.xlsx`);
}
