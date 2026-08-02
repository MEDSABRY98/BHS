'use client';

import { useMemo } from 'react';
import { InvoiceRow } from '@/types';
import { computeDebitInsights } from '../Utils/AsOfLedgerEngine';
import { DebitInsightsMetrics, InsightsFilters } from '../Utils/InsightsTypes';

export function useDebitInsightsMetrics(
  rows: InvoiceRow[],
  filters: InsightsFilters
): DebitInsightsMetrics {
  return useMemo(() => computeDebitInsights(rows, filters), [rows, filters]);
}
