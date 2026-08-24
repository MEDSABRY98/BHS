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

async function fetchTargets(): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  const { data: users } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
  const { data: personnel } = await bhs_supabas.from('web_Sales_DB_PERSONNEL').select('ID, NAME');
  
  const nameToUserId = new Map<string, string>();
  if (users) {
    users.forEach(u => {
      const name = String(u.NAME || '').trim().toUpperCase();
      if (name) nameToUserId.set(name, String(u.ID));
    });
  }

  const personnelToUserId = new Map<string, string>();
  if (personnel) {
    personnel.forEach(p => {
      const name = String(p.NAME || '').trim().toUpperCase();
      if (name && nameToUserId.has(name)) {
        personnelToUserId.set(String(p.ID), nameToUserId.get(name)!);
      }
    });
  }

  const { data, error } = await bhs_supabas
    .from('web_Sales_DB_TARGET')
    .select('"USER_ID", "YEAR", "MONTH", "TARGET_AMOUNT", "TARGET_TYPE"');
  if (error || !data) return map;
  
  data.forEach((row: Record<string, unknown>) => {
    const type = String(row.TARGET_TYPE || 'sales_rep');
    const rawUserId = String(row.USER_ID || '');
    const resolvedUserId = personnelToUserId.get(rawUserId) || rawUserId;
    
    const key = `${resolvedUserId}|${row.YEAR}|${row.MONTH}|${type}`;
    map.set(key, (map.get(key) || 0) + (Number(row.TARGET_AMOUNT) || 0));
  });
  return map;
}


export async function getOverviewData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);
  const targetMap = await fetchTargets();
  
  // Extract relevant user IDs for targets based on filters
  let targetUserIds: string[] | null = null;
  if (filters?.salesRep) {
    targetUserIds = [filters.salesRep];
  } else {
    // If no specific sales rep, sum across all reps that appear in augmentedData
    const reps = new Set<string>();
    augmentedData.forEach(r => {
      if (r.salesRep) reps.add(r.salesRep);
    });
    targetUserIds = Array.from(reps);
  }

  return buildOverviewFromFilteredData(augmentedData, filters, targetMap, targetUserIds);
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

// -------------------------------------------------------------
// 4. Top 10 Data
// -------------------------------------------------------------
export async function getTop10Data(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, product, customerName, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
    if (product) globallyFilteredData = globallyFilteredData.filter(i => i.product === product);
    if (customerTag) globallyFilteredData = globallyFilteredData.filter(i => i.customerTag === customerTag);
    if (customerName) globallyFilteredData = globallyFilteredData.filter(i => i.customerName === customerName || i.customerMainName === customerName);
    if (customerClass) globallyFilteredData = globallyFilteredData.filter(i => i.customerClass === customerClass);
    if (area) globallyFilteredData = globallyFilteredData.filter(i => i.area === area);
    if (market) globallyFilteredData = globallyFilteredData.filter(i => i.market === market);
    if (merchandiser) globallyFilteredData = globallyFilteredData.filter(i => i.merchandiser === merchandiser);
    if (salesRep) globallyFilteredData = globallyFilteredData.filter(i => i.salesRep === salesRep);
    if (year) {
      const yearNum = parseInt(year, 10);
      globallyFilteredData = globallyFilteredData.filter(item => {
        if (!item.invoiceDate) return false;
        const d = new Date(item.invoiceDate);
        return !isNaN(d.getTime()) && d.getFullYear() === yearNum;
      });
    }
    if (month) {
      const monthNum = parseInt(month, 10);
      globallyFilteredData = globallyFilteredData.filter(item => {
        if (!item.invoiceDate) return false;
        const d = new Date(item.invoiceDate);
        return !isNaN(d.getTime()) && d.getMonth() + 1 === monthNum;
      });
    }
    if (dateFrom || dateTo) {
      globallyFilteredData = globallyFilteredData.filter(item => {
        if (!item.invoiceDate) return false;
        const itemDate = new Date(item.invoiceDate);
        if (isNaN(itemDate.getTime())) return false;
        if (dateFrom && itemDate < new Date(dateFrom)) return false;
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (itemDate > toDate) return false;
        }
        return true;
      });
    }
  }

  const productMap = new Map<string, any>();
  const mainCustomerMap = new Map<string, any>();
  const subCustomerMap = new Map<string, any>();

  globallyFilteredData.forEach(item => {
    const pKey = item.productId || item.product;
    const exP = productMap.get(pKey) || { productId: item.productId || '', barcodes: new Set(), products: new Set(), totalAmount: 0, totalQty: 0, invoiceNumbers: new Set() };
    if (item.barcode) exP.barcodes.add(item.barcode);
    if (item.product) exP.products.add(item.product);
    exP.totalAmount += Number(item.amount) || 0;
    exP.totalQty += Number(item.qty) || 0;
    if (item.invoiceNumber) exP.invoiceNumbers.add(item.invoiceNumber);
    productMap.set(pKey, exP);

    const mainKey = item.customerMainName || item.customerName || 'Unknown';
    const mainDisplay = item.customerMainName || item.customerName || 'Unknown';
    const exMain = mainCustomerMap.get(mainKey) || { customer: mainDisplay, totalAmount: 0, totalQty: 0, invoiceNumbers: new Set() };
    exMain.totalAmount += Number(item.amount) || 0;
    exMain.totalQty += Number(item.qty) || 0;
    if (item.invoiceNumber) exMain.invoiceNumbers.add(item.invoiceNumber);
    mainCustomerMap.set(mainKey, exMain);

    const subKey = item.customerId || item.customerName || 'Unknown';
    const subDisplay = item.customerName || 'Unknown';
    const exSub = subCustomerMap.get(subKey) || { customer: subDisplay, totalAmount: 0, totalQty: 0, invoiceNumbers: new Set() };
    exSub.totalAmount += Number(item.amount) || 0;
    exSub.totalQty += Number(item.qty) || 0;
    if (item.invoiceNumber) exSub.invoiceNumbers.add(item.invoiceNumber);
    subCustomerMap.set(subKey, exSub);
  });

  const productsData = Array.from(productMap.values()).map(p => ({
    productId: p.productId,
    barcode: Array.from(p.barcodes).join(', ') || '-',
    products: Array.from(p.products) as string[],
    totalAmount: p.totalAmount,
    totalQty: p.totalQty,
    transactions: p.invoiceNumbers.size
  }));

  const mapCustomers = (map: Map<string, any>) =>
    Array.from(map.values()).map(c => ({
      customer: c.customer,
      totalAmount: c.totalAmount,
      totalQty: c.totalQty,
      transactions: c.invoiceNumbers.size
    }));

  const mainCustomersData = mapCustomers(mainCustomerMap);
  const subCustomersData = mapCustomers(subCustomerMap);

  return { productsData, mainCustomersData, subCustomersData };
}

// -------------------------------------------------------------
// 5. New Listings Data
// First purchase in a customer's lifetime, keyed by canonical Product ID.
// -------------------------------------------------------------
function _normListingId(value: any): string {
  if (value == null || value === '') return '';
  const text = String(value).trim().toUpperCase();
  if (!text || text === '-' || text === 'NULL' || text === 'UNDEFINED') return '';
  return /^\d+\.0+$/.test(text) ? text.replace(/\.0+$/, '') : text;
}

function _isSalesInvoiceNumber(invoiceNumber: any): boolean {
  const inv = String(invoiceNumber || '').trim().toUpperCase();
  return inv.startsWith('SAL') && !inv.startsWith('RSAL');
}

function _parseInvoiceTime(invoiceDate: any): number {
  if (!invoiceDate) return NaN;
  if (invoiceDate instanceof Date) {
    const time = invoiceDate.getTime();
    return isNaN(time) ? NaN : time;
  }
  return Date.parse(String(invoiceDate).trim());
}

function _buildCanonicalProductIds(rows: any[]): Map<string, string> {
  const canonical = new Map<string, string>();
  for (const item of rows) {
    const rawId = _normListingId(item.productId);
    const barcode = _normListingId(item.barcode);
    if (!rawId || !barcode || rawId === barcode) continue;
    canonical.set(rawId, rawId);
    canonical.set(barcode, rawId);
  }
  return canonical;
}

function _resolveListingProductId(item: any, canonical: Map<string, string>): string {
  const rawId = _normListingId(item.productId);
  const barcode = _normListingId(item.barcode);
  return canonical.get(rawId) || canonical.get(barcode) || rawId || barcode;
}

function _matchesListingFilters(item: any, filters: any): boolean {
  if (!filters) return true;
  const { area, market, merchandiser, salesRep, productTag, product, customerName, customerTag, customerClass } = filters;
  if (productTag && item.productTag !== productTag) return false;
  if (product && item.product !== product) return false;
  if (customerTag && item.customerTag !== customerTag) return false;
  if (customerName && item.customerName !== customerName && item.customerMainName !== customerName) return false;
  if (customerClass && item.customerClass !== customerClass) return false;
  if (area && item.area !== area) return false;
  if (market && item.market !== market) return false;
  if (merchandiser && item.merchandiser !== merchandiser) return false;
  if (salesRep && item.salesRep !== salesRep) return false;
  return true;
}

export async function getNewListingsData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);
  const canonicalProductIds = _buildCanonicalProductIds(augmentedData);

  const firstPurchaseMap = new Map<string, { time: number, invoiceItem: any }>();

  for (const item of augmentedData) {
    if (!_isSalesInvoiceNumber(item.invoiceNumber)) continue;
    const customerId = _normListingId(item.customerId);
    const productId = _resolveListingProductId(item, canonicalProductIds);
    if (!customerId || !productId) continue;
    const itemTime = _parseInvoiceTime(item.invoiceDate);
    if (isNaN(itemTime)) continue;
    const key = `${customerId}|||${productId}`;
    const existing = firstPurchaseMap.get(key);
    if (!existing || itemTime < existing.time) {
      firstPurchaseMap.set(key, { time: itemTime, invoiceItem: item });
    }
  }

  const monthlyListings: Record<string, any> = {};

  for (const [key, data] of firstPurchaseMap.entries()) {
    const { time, invoiceItem } = data;
    if (!_matchesListingFilters(invoiceItem, filters)) continue;

    const date = new Date(time);
    if (filters) {
      const { year, month, dateFrom, dateTo } = filters;
      if (year && date.getFullYear() !== parseInt(year, 10)) continue;
      if (month && date.getMonth() + 1 !== parseInt(month, 10)) continue;
      if (dateFrom && time < Date.parse(dateFrom)) continue;
      if (dateTo) {
        const tDate = new Date(dateTo);
        tDate.setHours(23, 59, 59, 999);
        if (time > tDate.getTime()) continue;
      }
    }

    const yearStr = date.getFullYear();
    const monthStr = date.getMonth() + 1;
    const monthKey = `${yearStr}-${monthStr < 10 ? '0' : ''}${monthStr}`;

    if (!monthlyListings[monthKey]) monthlyListings[monthKey] = { products: {} };

    const [, productId] = key.split('|||');
    const barcode = invoiceItem.barcode || '-';
    const productName = invoiceItem.product;
    const customerId = _normListingId(invoiceItem.customerId);
    const customerName = invoiceItem.customerName || invoiceItem.customerMainName || 'Unknown';

    if (!monthlyListings[monthKey].products[productId]) {
      monthlyListings[monthKey].products[productId] = { barcode, productName, customersMap: new Map() };
    }
    monthlyListings[monthKey].products[productId].customersMap.set(customerId, customerName);
  }

  const result: any[] = [];
  const sortedMonths = Object.keys(monthlyListings).sort().reverse();

  for (const monthKey of sortedMonths) {
    const productsData = monthlyListings[monthKey].products;
    const productsArr: any[] = [];
    const uniqueCustomersInMonth = new Set<string>();

    for (const [productId, pData] of Object.entries(productsData)) {
      const customersArr = Array.from((pData as any).customersMap.entries()).map(([id, name]: any) => {
        uniqueCustomersInMonth.add(id as string);
        return { id, name };
      }).sort((a: any, b: any) => a.name.localeCompare(b.name));

      productsArr.push({
        productId,
        barcode: (pData as any).barcode,
        productName: (pData as any).productName,
        customers: customersArr,
        customersCount: customersArr.length
      });
    }

    productsArr.sort((a, b) => {
      if (b.customersCount !== a.customersCount) return b.customersCount - a.customersCount;
      return (a.productName || '').localeCompare(b.productName || '');
    });

    const [y, m] = monthKey.split('-');
    const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('default', { month: 'long' });

    result.push({
      monthKey,
      monthName: `${monthName} ${y}`,
      uniqueProductsCount: productsArr.length,
      uniqueCustomersCount: uniqueCustomersInMonth.size,
      products: productsArr
    });
  }

  return result;
}

