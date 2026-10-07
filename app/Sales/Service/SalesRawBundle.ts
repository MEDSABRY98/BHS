'use server';

import { fetchSalesStockRawData } from '@/app/Sales/Service/sales_core_service';
import {
  buildDailySalesFromRaw,
  buildStatisticsFromRaw,
  buildStockReportFromRaw,
} from '@/app/Sales/Utils/SalesRawAggregations';

export async function getSalesRawDataBundle(userId: string, filters: any, invoiceTypeFilter: string) {
  const raw = await fetchSalesStockRawData(userId, filters);
  return {
    dailySales: buildDailySalesFromRaw(raw, invoiceTypeFilter),
    statistics: buildStatisticsFromRaw(raw),
    stockReport: buildStockReportFromRaw(raw),
  };
}
