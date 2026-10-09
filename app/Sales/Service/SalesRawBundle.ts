'use server';
import { requireSession } from '@/lib/session';

import { fetchSalesStockRawData } from '@/app/Sales/Service/sales_core_service';
import {
  buildDailySalesFromRaw,
  buildStatisticsFromRaw,
  buildStockReportFromRaw,
} from '@/app/Sales/Utils/SalesRawAggregations';

export async function getSalesRawDataBundle(userId: string, filters: any, invoiceTypeFilter: string) {
  await requireSession();
  const raw = await fetchSalesStockRawData(userId, filters);
  return {
    dailySales: buildDailySalesFromRaw(raw, invoiceTypeFilter),
    statistics: buildStatisticsFromRaw(raw),
    stockReport: buildStockReportFromRaw(raw),
  };
}
