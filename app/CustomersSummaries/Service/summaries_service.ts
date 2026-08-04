'use server';

import { InvoiceRow } from '@/types';
import { getDebitData } from '@/app/Debit/Service/debit_service';
import {
  getSummariesSalesOverlay,
} from '@/app/CustomersSummaries/Service/summaries_sales_service';
import type {
  SummariesSalesOverlay,
  SummariesSalesOverlayInput,
  SummariesSalesSource,
} from '@/app/CustomersSummaries/Utils/SummariesTypes';

export type {
  SummariesSalesOverlay,
  SummariesSalesOverlayInput,
  SummariesSalesSource,
} from '@/app/CustomersSummaries/Utils/SummariesTypes';

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
  return getSummariesSalesOverlay(input);
}
