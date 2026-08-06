import { bhs_supabase, fetchAllData } from '@/lib/supabase';
import { getDebitData } from '@/app/Debit/Service/debit_service';
import {
  buildOpenBalanceMonthsByCustomer,
  isPastMonth,
  monthKey,
} from './OpenBalanceByMonth';

export type AutoSettleClearedMonthsResult = {
  settledCount: number;
  settledIds: string[];
  scannedPending: number;
  customerCount: number;
};

const UPDATE_CHUNK = 200;

/**
 * Marks past-month Pending settlements as Settled when the customer
 * has zero open overdue balance for that invoice-date month.
 * Current calendar month is never included.
 */
export async function autoSettleClearedMonths(): Promise<AutoSettleClearedMonthsResult> {
  const pendingRows = await fetchAllData(() =>
    bhs_supabase
      .from('web_CUSTOMERS_DISCOUNTS_SETTLEMENTS')
      .select('ID, CUSTOMER_ID, MONTH, YEAR, STATUS')
      .eq('STATUS', 'Pending'),
  );

  const pastPending = (pendingRows || []).filter((row: Record<string, unknown>) => {
    const month = Number(row.MONTH);
    const year = Number(row.YEAR);
    return Number.isFinite(month) && Number.isFinite(year) && isPastMonth(year, month);
  });

  if (pastPending.length === 0) {
    return { settledCount: 0, settledIds: [], scannedPending: 0, customerCount: 0 };
  }

  const customerIdSet = new Set(
    pastPending
      .map((row: Record<string, unknown>) => String(row.CUSTOMER_ID || '').trim())
      .filter(Boolean),
  );

  const { data: debitRows } = await getDebitData();
  const relevantDebit = (debitRows || []).filter((row) => {
    const id = String(row.customerId || '').trim();
    return id && customerIdSet.has(id);
  });

  const openMonthsByCustomer = buildOpenBalanceMonthsByCustomer(relevantDebit);

  const toSettleIds: string[] = [];
  for (const row of pastPending) {
    const customerId = String(row.CUSTOMER_ID || '').trim();
    const month = Number(row.MONTH);
    const year = Number(row.YEAR);
    const key = monthKey(year, month);
    const openMonths = openMonthsByCustomer.get(customerId);
    if (openMonths?.has(key)) continue;
    const id = String(row.ID || '').trim();
    if (id) toSettleIds.push(id);
  }

  for (let i = 0; i < toSettleIds.length; i += UPDATE_CHUNK) {
    const chunk = toSettleIds.slice(i, i + UPDATE_CHUNK);
    const { error } = await bhs_supabase
      .from('web_CUSTOMERS_DISCOUNTS_SETTLEMENTS')
      .update({ STATUS: 'Settled' })
      .in('ID', chunk);
    if (error) throw error;
  }

  return {
    settledCount: toSettleIds.length,
    settledIds: toSettleIds,
    scannedPending: pastPending.length,
    customerCount: customerIdSet.size,
  };
}
