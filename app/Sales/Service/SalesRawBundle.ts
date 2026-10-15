'use server';
import { requireSession } from '@/lib/session';

import { fetchSalesStockRawData } from '@/app/Sales/Service/sales_core_service';
import { memoSalesResult } from '@/app/Sales/Cache/SalesMappingCache';
import {
  buildDailySalesFromRaw,
  buildStatisticsFromRaw,
  buildStockReportFromRaw,
} from '@/app/Sales/Utils/SalesRawAggregations';

export async function getSalesRawDataBundle(userId: string, filters: any, invoiceTypeFilter: string) {
  await requireSession();
  return memoSalesResult('rawBundle', userId, [filters, invoiceTypeFilter], async () => {
    const raw = await fetchSalesStockRawData(userId, filters);
    return {
      dailySales: buildDailySalesFromRaw(raw, invoiceTypeFilter),
      statistics: buildStatisticsFromRaw(raw),
      stockReport: buildStockReportFromRaw(raw),
    };
  });
}
