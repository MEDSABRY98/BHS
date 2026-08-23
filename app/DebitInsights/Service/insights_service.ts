'use server';

import { InvoiceRow } from '@/types';
import { getDebitData } from '@/app/Debit/Service/debit_service';
import {
  computeDebitInsights,
  resolvePeriodRange,
  resolveEffectiveCustomers,
} from '@/app/DebitInsights/Utils/AsOfLedgerEngine';
import { applySalesNetOverlay } from '@/app/DebitInsights/Utils/SalesSourceOverlay';
import { toInputDate } from '@/app/DebitInsights/Utils/DateUtils';
import type {
  DebitInsightsMetrics,
  InsightsFilters,
  InsightsSalesOverlay,
} from '@/app/DebitInsights/Utils/InsightsTypes';
import { getInsightsSalesOverlay } from '@/app/DebitInsights/Service/insights_sales_service';

interface DebitInsightsDataResult {
  success: boolean;
  data: InvoiceRow[];
  error?: string;
}

interface DebitInsightsComputeInput {
  rows: InvoiceRow[];
  filters: InsightsFilters;
  userId?: string;
}

/**
 * Main Debit Insights data loader — pulls full ledger from mix_DEBIT
 * (same source as Debit module via getDebitData).
 */
export async function getDebitInsightsData(): Promise<DebitInsightsDataResult> {
  try {
    const result = await getDebitData();
    const data = Array.isArray(result?.data) ? (result.data as InvoiceRow[]) : [];
    return { success: true, data };
  } catch (error) {
    console.error('Service Error getDebitInsightsData:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch Debit Insights data',
    };
  }
}

/**
 * Builds Debit Insights metrics from ledger rows.
 * When filters.salesSource === 'sales', overlays net sales from Sales DB.
 */
export async function computeDebitInsightsMetrics(
  input: DebitInsightsComputeInput
): Promise<DebitInsightsMetrics> {
  const { rows, filters, userId } = input;
  const metrics = computeDebitInsights(rows, filters);

  if (filters.salesSource !== 'sales') {
    return metrics;
  }

  const overlay = await fetchSalesOverlayForFilters(rows, filters, userId);
  return applySalesNetOverlay(metrics, overlay);
}

/**
 * Fetches Sales DB net-sales overlay for the resolved Insights period.
 */
async function fetchSalesOverlayForFilters(
  rows: InvoiceRow[],
  filters: InsightsFilters,
  userId?: string
): Promise<InsightsSalesOverlay> {
  const { from, to } = resolvePeriodRange(
    filters.asOfDate,
    filters.periodPreset,
    filters.periodFrom,
    filters.periodTo
  );
  const effectiveCustomers = resolveEffectiveCustomers(
    rows,
    [], // cities not present in InsightsFilters
    filters.customers || [],
    filters.customerTags || []
  );

  return getInsightsSalesOverlay({
    userId: userId || '',
    periodFrom: toInputDate(from),
    periodTo: toInputDate(to),
    cities: [], // cities not present in InsightsFilters
    customers: effectiveCustomers,
  });
}
