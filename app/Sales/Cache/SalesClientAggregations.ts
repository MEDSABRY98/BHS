import { applySalesCommonFilters } from '@/app/Sales/Utils/SalesDataFilters';
import { buildOverviewFromFilteredData } from '@/app/Sales/Overview/SalesOverviewAggregation';
import { buildDailySalesFromRaw, buildStatisticsFromRaw, buildStockReportFromRaw } from '@/app/Sales/Utils/SalesRawAggregations';

// -------------------------------------------------------------
// 1. Overview Data
// -------------------------------------------------------------
export function getOverviewDataClient(augmentedData: any[], filters: any) {
  return buildOverviewFromFilteredData(augmentedData, filters);
}

// -------------------------------------------------------------
// 2. Daily Sales Data
// -------------------------------------------------------------
export function fetchSalesStockRawDataClient(augmentedData: any[], filters: any) {
  return applySalesCommonFilters(augmentedData, filters);
}

export function getDailySalesDataClient(augmentedData: any[], filters: any, invoiceTypeFilter: string) {
  const raw = fetchSalesStockRawDataClient(augmentedData, filters);
  return buildDailySalesFromRaw(raw, invoiceTypeFilter);
}

// -------------------------------------------------------------
// 3. Statistics Data
// -------------------------------------------------------------
export function getStatisticsDataClient(augmentedData: any[], filters: any) {
  const raw = fetchSalesStockRawDataClient(augmentedData, filters);
  return buildStatisticsFromRaw(raw);
}

// -------------------------------------------------------------
// 4. Stock Report Data
// -------------------------------------------------------------
export function getStockReportClient(augmentedData: any[], filters: any) {
  const raw = fetchSalesStockRawDataClient(augmentedData, filters);
  return buildStockReportFromRaw(raw);
}
