'use server';
import { requireSession } from '@/lib/session';

import { InvoiceRow } from '@/types';
import { getDebitData } from '@/app/CustomersAnalysis/Service/debit_service';
import {
  getSummariesSalesOverlay,
} from './summaries_sales_service';
import type {
  SummariesSalesOverlay,
  SummariesSalesOverlayInput,
  SummariesSalesSource,
} from '../Utils/SummariesTypes';

export type {
  SummariesSalesOverlay,
  SummariesSalesOverlayInput,
  SummariesSalesSource,
} from '../Utils/SummariesTypes';

export { getSummariesSalesOverlay };

export interface CustomersSummariesDataResult {
  success: boolean;
  data: InvoiceRow[];
  error?: string;
}

/**
 * Main Customers Summaries data loader — mix_DEBIT via getDebitData.
 */
export async function getCustomersSummariesData(): Promise<CustomersSummariesDataResult> {
  await requireSession();
  try {
    const result = await getDebitData();
    const data = Array.isArray(result?.data) ? (result.data as InvoiceRow[]) : [];
    return { success: true, data };
  } catch (error) {
    console.error('Service Error getCustomersSummariesData:', error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : 'Failed to fetch Customers Summaries data',
    };
  }
}

/**
 * Sales DB overlay for Customers Summaries net-sales columns.
 */
export async function fetchSummariesSalesOverlayForYears(
  input: SummariesSalesOverlayInput
): Promise<SummariesSalesOverlay> {
  await requireSession();
  return getSummariesSalesOverlay(input);
}
