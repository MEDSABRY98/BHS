'use server';

import { 
  getMappingServer,
  getFilteredSalesData,
  invalidateMappingCache, 
  checkHasSalesDataAccess, 
  isLegacyMappingRowId, 
  loadUserMaps, 
  loadCustomerMaps, 
  resolveCustomerId, 
  resolveMerchandiserUserId, 
  resolveSalesRepUserId 
} from '@/app/Sales/Utils/SalesMappingCache';
import { buildAndSaveCache, invalidateMemoryCache } from '@/app/Sales/Utils/SalesCache';
import { buildDailySalesFromRaw, buildStatisticsFromRaw } from '@/app/Sales/Utils/SalesRawAggregations';
import { applySalesCommonFilters } from '@/app/Sales/Utils/SalesDataFilters';
import { buildOverviewFromFilteredData } from '@/app/Sales/Overview/SalesOverviewAggregation';
import { bhs_supabas } from '@/lib/supabase';

// -------------------------------------------------------------
// 0. Cache & Metadata (From api/Sales/route.ts, Build, Metadata, Mapping)
// -------------------------------------------------------------
export async function getSalesMonthsCache(refresh: boolean = false) {
  if (!refresh) {
    const { data: cacheRow, error: cacheErr } = await bhs_supabas
      .from('web_Sales_DB_Cache')
      .select('DATA')
      .eq('KEY', 'months_data')
      .single();

    if (!cacheErr && cacheRow && cacheRow.DATA) {
      return cacheRow.DATA;
    }
  }

  const { data, error } = await bhs_supabas.rpc('get_sales_months_summary');
  if (error) throw error;

  const monthsList = (data || []).map((row: any) => ({
    year: Number(row.year),
    month: Number(row.month),
    count: Number(row.count),
  }));

  await bhs_supabas
    .from('web_Sales_DB_Cache')
    .update({ DATA: monthsList, UPDATED_AT: new Date().toISOString() })
    .eq('KEY', 'months_data');

  return monthsList;
}

export async function getSalesDataCache(refresh: boolean = false) {
  if (!refresh) {
    const { data: cacheRow, error: cacheErr } = await bhs_supabas
      .from('web_Sales_DB_Cache')
      .select('DATA')
      .eq('KEY', 'sales_data')
      .single();

    if (!cacheErr && cacheRow && cacheRow.DATA) {
      return cacheRow.DATA;
    }
  }

  const { error: rpcErr } = await bhs_supabas.rpc('refresh_sales_cache');
  if (rpcErr) throw rpcErr;

  const { data: freshCache, error: fetchErr } = await bhs_supabas
    .from('web_Sales_DB_Cache')
    .select('DATA')
    .eq('KEY', 'sales_data')
    .single();

  if (fetchErr) throw fetchErr;
  return freshCache?.DATA || [];
}

export async function deleteSalesMonth(year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const { error } = await bhs_supabas
    .from('web_Sales_DB')
    .delete()
    .gte('INVOICE DATE', startDate)
    .lt('INVOICE DATE', endDate);

  if (error) throw error;

  await bhs_supabas.from('web_Sales_DB_Cache').update({ DATA: null }).eq('KEY', 'sales_data');
  await bhs_supabas.from('web_Sales_DB_Cache').update({ DATA: null }).eq('KEY', 'months_data');

  return { success: true };
}

export async function deleteAllSalesData() {
  const { error } = await bhs_supabas
    .from('web_Sales_DB')
    .delete()
    .neq('ID', 'dummy_id_to_match_all'); // .neq acts as a hack to delete all rows

  if (error) throw error;

  await bhs_supabas.from('web_Sales_DB_Cache').update({ DATA: null }).eq('KEY', 'sales_data');
  await bhs_supabas.from('web_Sales_DB_Cache').update({ DATA: null }).eq('KEY', 'months_data');

  return { success: true };
}

export async function buildSalesCache() {
  const { rows } = await buildAndSaveCache();
  return { success: true, rows };
}

export async function getSalesMetadata(userId: string, forceRefresh: boolean = false) {
  if (forceRefresh) {
    invalidateMemoryCache();
    invalidateMappingCache();
    await buildAndSaveCache();
  }

  const augmentedData = await getFilteredSalesData(userId);
  const myMappings = await getMappingServer(userId);

  const areas = new Set<string>();
  const markets = new Set<string>();
  const merchandisers = new Set<string>();
  const salesReps = new Set<string>();
  const productTags = new Set<string>();
  const products = new Set<string>();
  const productCategoryByName: Record<string, string> = {};
  const customerNames = new Set<string>();
  const customerTags = new Set<string>();
  const customerClasses = new Set<string>();
  const years = new Set<string>();

  myMappings.forEach(m => {
    if (m.area) areas.add(m.area);
    if (m.market) markets.add(m.market);
    if (m.merchandiser) merchandisers.add(m.merchandiser);
    if (m.salesRep) salesReps.add(m.salesRep);
    if (m.customerMainName) customerNames.add(m.customerMainName);
    if (m.customerSubName) customerNames.add(m.customerSubName);
    if (m.customerTag) customerTags.add(m.customerTag);
    if (m.customerClass) customerClasses.add(m.customerClass);
  });

  let latestDate = 0;

  augmentedData.forEach(item => {
    if (item.area) areas.add(item.area);
    if (item.market) markets.add(item.market);
    if (item.merchandiser) merchandisers.add(item.merchandiser);
    if (item.salesRep) salesReps.add(item.salesRep);
    if (item.productTag) productTags.add(item.productTag);
    if (item.product) {
      products.add(item.product);
      if (item.productTag) productCategoryByName[item.product] = item.productTag;
    }
    if (item.customerName) customerNames.add(item.customerName);
    if (item.customerMainName) customerNames.add(item.customerMainName);
    if (item.customerTag) customerTags.add(item.customerTag);
    if (item.customerClass) customerClasses.add(item.customerClass);

    if (item.invoiceDate) {
      const d = new Date(item.invoiceDate);
      if (!isNaN(d.getTime())) {
        years.add(d.getFullYear().toString());
        if (d.getTime() > latestDate) latestDate = d.getTime();
      }
    }
  });

  const lastUpdated = latestDate > 0
    ? new Date(latestDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return {
    uniqueValues: {
      areas: Array.from(areas).sort(),
      markets: Array.from(markets).sort(),
      merchandisers: Array.from(merchandisers).sort(),
      salesReps: Array.from(salesReps).sort(),
      productTags: Array.from(productTags).sort(),
      products: Array.from(products).sort(),
      productCategoryByName,
      customerNames: Array.from(customerNames).sort(),
      customerTags: Array.from(customerTags).sort(),
      customerClasses: Array.from(customerClasses).sort(),
      years: Array.from(years).sort((a, b) => b.localeCompare(a))
    },
    lastUpdated
  };
}

export async function uploadSalesMappingsBulk(userId: string, mapping: any) {
  const isManager = await checkHasSalesDataAccess(userId);
  if (!isManager) {
    throw new Error('Unauthorized. Only sales managers can upload mappings.');
  }

  if (!mapping || Object.keys(mapping).length === 0) {
    return { success: true, message: 'No mapping data provided' };
  }

  const { userMapById, userMapByName } = await loadUserMaps();
  const { custMapById, custMapByName } = await loadCustomerMaps();

  const updates: { customerId: string; data: any }[] = [];
  
  for (const rawCustomerId of Object.keys(mapping)) {
    const customerId = resolveCustomerId(rawCustomerId, custMapById, custMapByName);
    if (!customerId) continue;

    const data = mapping[rawCustomerId];
    const repRaw = String(data.salesRep || data.salesRepId || '').trim();
    const repId = resolveSalesRepUserId(repRaw, userMapById, userMapByName);
    const merchRaw = String(data.merchandiserId || data.merchandiser || '').trim();
    const merchId = resolveMerchandiserUserId(merchRaw, userMapById, userMapByName);

    updates.push({
      customerId,
      data: {
        SALES_REP: repId,
        MARKET: data.market || '',
        MERCHANDISER: merchId,
      }
    });
  }

  const chunkSize = 50;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(u => 
        bhs_supabas
          .from('bhs_CUSTOMERS')
          .update(u.data)
          .eq('CUSTOMER ID', u.customerId)
      )
    );
  }

  invalidateMappingCache();

  return { success: true, message: `Uploaded ${updates.length} mappings successfully` };
}

// -------------------------------------------------------------
// 1. Overview Data
// -------------------------------------------------------------
export async function getOverviewData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);
  return buildOverviewFromFilteredData(augmentedData, filters);
}

// -------------------------------------------------------------
// 2. Daily Sales Data
// -------------------------------------------------------------
export async function fetchSalesStockRawData(userId: string, filters: any) {
  const data = await getFilteredSalesData(userId);
  return applySalesCommonFilters(data, filters);
}

export async function getDailySalesData(userId: string, filters: any, invoiceTypeFilter: string) {
  const raw = await fetchSalesStockRawData(userId, filters);
  return buildDailySalesFromRaw(raw, invoiceTypeFilter);
}

// -------------------------------------------------------------
// 3. Statistics Data
// -------------------------------------------------------------
export async function getStatisticsData(userId: string, filters: any) {
  const raw = await fetchSalesStockRawData(userId, filters);
  return buildStatisticsFromRaw(raw);
}
