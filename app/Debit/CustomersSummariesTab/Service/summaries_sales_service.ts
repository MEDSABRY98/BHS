'use server';

import { getFilteredSalesData } from '@/app/Sales/Utils/SalesMappingCache';
import { parseDate } from '@/app/Debit/DebitInsightsTab/Utils/DateUtils';
import type {
  CustomerSalesYearBreakdown,
  SummariesSalesOverlay,
  SummariesSalesOverlayInput,
} from '../Utils/SummariesTypes';

export type {
  CustomerSalesYearBreakdown,
  SummariesSalesOverlay,
  SummariesSalesOverlayInput,
} from '../Utils/SummariesTypes';

function isSalesOrReturn(invoiceNumber?: string | null): boolean {
  const num = (invoiceNumber || '').toString().toUpperCase().trim();
  return num.startsWith('SAL') || num.startsWith('RSAL');
}

function parseInvoiceDate(raw?: string | null): Date | null {
  if (!raw) return null;
  const parsed = parseDate(raw);
  if (parsed) return parsed;
  const direct = new Date(raw);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function isWithinFairYtd(date: Date, fairMonth: number, fairDay: number): boolean {
  const m = date.getMonth();
  const d = date.getDate();
  if (m > fairMonth) return false;
  if (m === fairMonth && d > fairDay) return false;
  return true;
}

const EMPTY_OVERLAY: SummariesSalesOverlay = { byCustomer: [] };

/**
 * Per-customer net sales from web_Sales_DB using the same fair YTD window
 * as Customers Summaries (month/day <= today for each year).
 */
export async function getSummariesSalesOverlay(
  input: SummariesSalesOverlayInput
): Promise<SummariesSalesOverlay> {
  const userId = String(input.userId || '').trim();
  if (!userId) return EMPTY_OVERLAY;

  const { currentYear, previousYear, fairMonth, fairDay } = input;

  try {
    const rows = await getFilteredSalesData(userId);
    const map = new Map<
      string,
      {
        city: string;
        salesPrev: number;
        returnsPrev: number;
        salesCurrent: number;
        returnsCurrent: number;
      }
    >();

    rows.forEach((row: any) => {
      if (!isSalesOrReturn(row.invoiceNumber)) return;

      const customerName = String(row.customerMainName || '').trim();
      if (!customerName) return;

      const date = parseInvoiceDate(row.invoiceDate);
      if (!date || !isWithinFairYtd(date, fairMonth, fairDay)) return;

      const year = date.getFullYear();
      if (year !== currentYear && year !== previousYear) return;

      const amount = Number(row.amount) || 0;
      const num = String(row.invoiceNumber || '').toUpperCase().trim();
      const city = String(row.area || '').trim();

      const entry = map.get(customerName) || {
        city: '',
        salesPrev: 0,
        returnsPrev: 0,
        salesCurrent: 0,
        returnsCurrent: 0,
      };

      if (!entry.city && city) entry.city = city;

      const isReturn = num.startsWith('RSAL');
      if (year === previousYear) {
        if (isReturn) entry.returnsPrev += Math.abs(amount);
        else entry.salesPrev += amount;
      } else {
        if (isReturn) entry.returnsCurrent += Math.abs(amount);
        else entry.salesCurrent += amount;
      }

      map.set(customerName, entry);
    });

    const byCustomer: CustomerSalesYearBreakdown[] = Array.from(map.entries()).map(
      ([customerName, entry]) => ({
        customerName,
        city: entry.city,
        salesPrev: entry.salesPrev,
        returnsPrev: entry.returnsPrev,
        salesCurrent: entry.salesCurrent,
        returnsCurrent: entry.returnsCurrent,
        netSalesPrev: entry.salesPrev - entry.returnsPrev,
        netSalesCurrent: entry.salesCurrent - entry.returnsCurrent,
      })
    );

    return { byCustomer };
  } catch (error) {
    console.error('getSummariesSalesOverlay failed:', error);
    return EMPTY_OVERLAY;
  }
}
