import { SalesCommonFilters } from '@/app/Sales/Model/SalesFilters';

export function buildSalesFetchKey(
  tabKey: string,
  userId: string,
  filters: SalesCommonFilters,
  dataVersion = 0,
  extra = ''
): string {
  return [
    tabKey,
    userId,
    dataVersion,
    extra,
    filters.invoiceType,
    filters.year,
    filters.month,
    filters.dateFrom,
    filters.dateTo,
    filters.area,
    filters.market,
    filters.merchandiser,
    filters.salesRep,
    filters.productTag,
    filters.product,
    filters.customerName,
    filters.customerTag,
    filters.customerClass,
  ].join('|');
}
