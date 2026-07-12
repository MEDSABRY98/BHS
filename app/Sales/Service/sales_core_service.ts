'use server';

import { 
  getMappingServer, 
  invalidateMappingCache, 
  checkIsManager, 
  isLegacyMappingRowId, 
  loadUserMaps, 
  loadCustomerMaps, 
  resolveCustomerId, 
  resolveMerchandiserUserId, 
  resolveSalesRepUserId 
} from '@/app/Sales/Utils/SalesMappingCache';
import { buildAndSaveCache, invalidateMemoryCache } from '@/app/Sales/Utils/SalesCache';
import { bhs_supabas } from '@/lib/supabase';

// -------------------------------------------------------------
// Helper functions
// -------------------------------------------------------------
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
};

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
  }

  const { data, error } = await bhs_supabas.rpc('get_sales_metadata', {
    p_user_id: userId
  });

  if (error) {
    console.error('RPC Error in getSalesMetadata:', error);
    return {
      uniqueValues: {
        areas: [],
        markets: [],
        merchandisers: [],
        salesReps: [],
        productTags: [],
        years: []
      },
      lastUpdated: null
    };
  }

  const result = data || {};
  const uv = result.uniqueValues || {};

  const lastUpdated = result.lastUpdated
    ? new Date(result.lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return {
    uniqueValues: {
      areas: uv.areas || [],
      markets: uv.markets || [],
      merchandisers: uv.merchandisers || [],
      salesReps: uv.salesReps || [],
      productTags: uv.productTags || [],
      years: uv.years || []
    },
    lastUpdated
  };
}

export async function uploadSalesMappingsBulk(userId: string, mapping: any) {
  const isManager = await checkIsManager(userId);
  if (!isManager) {
    throw new Error('Unauthorized. Only sales managers can upload mappings.');
  }

  if (!mapping || Object.keys(mapping).length === 0) {
    return { success: true, message: 'No mapping data provided' };
  }

  const { error: deleteError } = await bhs_supabas
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .delete()
    .gt('ID', '');

  if (deleteError) {
    throw deleteError;
  }

  const { userMapById, userMapByName } = await loadUserMaps();
  const { custMapById, custMapByName } = await loadCustomerMaps();

  const rowsByCustomer = new Map<string, Record<string, string>>();
  for (const rawCustomerId of Object.keys(mapping)) {
    if (isLegacyMappingRowId(rawCustomerId)) continue;

    const customerId = resolveCustomerId(rawCustomerId, custMapById, custMapByName);
    if (!customerId) {
      throw new Error(`Customer "${rawCustomerId}" was not found in the database.`);
    }
    const data = mapping[rawCustomerId];
    const repRaw = String(data.salesRep || data.salesRepId || '').trim();
    const repId = resolveSalesRepUserId(repRaw, userMapById, userMapByName);
    const merchRaw = String(data.merchandiserId || data.merchandiser || '').trim();
    const merchId = resolveMerchandiserUserId(merchRaw, userMapById, userMapByName);

    rowsByCustomer.set(customerId, {
      ID: customerId,
      SALES_REP: repId,
      'CUSTOMER ID': customerId,
      AREA: data.area || '',
      MARKET: data.market || '',
      MERCHANDISER: merchId,
    });
  }
  const rows = Array.from(rowsByCustomer.values());

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: insertError } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .insert(chunk);

    if (insertError) {
      throw insertError;
    }
  }

  invalidateMappingCache();

  return { success: true, message: `Uploaded ${rows.length} mappings successfully` };
}

// -------------------------------------------------------------
// 1. Overview Data
// -------------------------------------------------------------
export async function getOverviewData(userId: string, filters: any) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_overview_data', {
    p_user_id: userId,
    p_year: year ? parseInt(year, 10) : null,
    p_month: month ? parseInt(month, 10) : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_invoice_type: invoiceType || 'all',
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getOverviewData:', error);
    throw error;
  }

  return data;
}

// -------------------------------------------------------------
// 2. Daily Sales Data
// -------------------------------------------------------------
export async function getDailySalesData(userId: string, filters: any, invoiceTypeFilter: string) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data: globallyFilteredData, error } = await bhs_supabas.rpc('get_sales_stock_raw_data', {
    p_user_id: userId,
    p_invoice_type: invoiceType || 'all',
    p_year: year || null,
    p_month: month || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getDailySalesData:', error);
    return { dailySalesData: [], salesByDayData: [], avgSalesByDayData: [] };
  }

  const invoiceMap = new Map<string, any>();
  globallyFilteredData.forEach(item => {
    if (!item.invoiceNumber) return;

    const existing = invoiceMap.get(item.invoiceNumber) || {
      invoiceDate: item.invoiceDate || '',
      invoiceNumber: item.invoiceNumber,
      customerName: item.customerName || '',
      amount: 0,
      qty: 0,
      products: new Set<string>(),
      searchTerms: new Set<string>(),
      totalCost: 0,
      totalPrice: 0,
      costCount: 0,
      priceCount: 0,
      items: []
    };

    existing.items.push(item);
    existing.amount += Number(item.amount) || 0;
    existing.qty += Number(item.qty) || 0;

    if (item.product) existing.searchTerms.add(item.product.toLowerCase());
    if (item.barcode) existing.searchTerms.add(item.barcode.toLowerCase());
    if (item.productId) existing.searchTerms.add(item.productId.toLowerCase());

    const productKey = item.productId || item.barcode || item.product;
    if (productKey) existing.products.add(productKey);

    if (item.productCost) {
      existing.totalCost += Number(item.productCost);
      existing.costCount += 1;
    }
    if (item.productPrice) {
      existing.totalPrice += Number(item.productPrice);
      existing.priceCount += 1;
    }

    invoiceMap.set(item.invoiceNumber, existing);
  });

  const allInvoices = Array.from(invoiceMap.values()).map(invoice => {
    const avgCost = invoice.costCount > 0 ? invoice.totalCost / invoice.costCount : 0;
    const avgPrice = invoice.priceCount > 0 ? invoice.totalPrice / invoice.priceCount : 0;

    return {
      ...invoice,
      productsCount: invoice.products.size,
      searchTerms: Array.from(invoice.searchTerms),
      avgCost,
      avgPrice,
      products: undefined, 
    };
  }).sort((a, b) => {
    const dateA = new Date(a.invoiceDate).getTime();
    const dateB = new Date(b.invoiceDate).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return b.invoiceNumber.localeCompare(a.invoiceNumber);
  });

  let filteredInvoices = allInvoices;
  if (invoiceTypeFilter && invoiceTypeFilter !== 'all') {
    filteredInvoices = allInvoices.filter(inv => {
      const num = inv.invoiceNumber.trim().toUpperCase();
      if (invoiceTypeFilter === 'sales') return num.startsWith('SAL');
      if (invoiceTypeFilter === 'returns') return num.startsWith('RSAL');
      return true;
    });
  }

  const dateMap = new Map<string, any>();
  globallyFilteredData.forEach(item => {
    if (!item.invoiceDate) return;
    const dateKey = formatDate(item.invoiceDate);
    if (!dateKey) return;

    const existing = dateMap.get(dateKey) || {
      date: dateKey,
      amount: 0,
      qty: 0,
      invoiceNumbers: new Set<string>(),
      products: new Set<string>(),
      customers: new Set<string>(),
      salInvoiceNumbers: new Set<string>(),
      salProducts: new Set<string>(),
      salCustomers: new Set<string>()
    };

    existing.amount += Number(item.amount) || 0;
    existing.qty += Number(item.qty) || 0;

    if (item.invoiceNumber) {
      existing.invoiceNumbers.add(item.invoiceNumber);
      if (item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.salInvoiceNumbers.add(item.invoiceNumber);
        const pKey = item.productId || item.barcode || item.product;
        if (pKey) existing.salProducts.add(pKey);
        const cKey = item.customerId || item.customerName;
        if (cKey) existing.salCustomers.add(cKey);
      }
    }

    const pKey = item.productId || item.barcode || item.product;
    if (pKey) existing.products.add(pKey);
    const cKey = item.customerId || item.customerName;
    if (cKey) existing.customers.add(cKey);

    dateMap.set(dateKey, existing);
  });

  const salesByDayData = Array.from(dateMap.values()).map(item => ({
    date: item.date,
    amount: item.amount,
    qty: item.qty,
    invoicesCount: item.invoiceNumbers.size,
    productsCount: item.products.size,
    customersCount: item.customers.size,
    salInvoicesCount: item.salInvoiceNumbers.size,
    salProductsCount: item.salProducts.size,
    salCustomersCount: item.salCustomers.size
  })).sort((a, b) => {
    const dateA = new Date(a.date.split('/').reverse().join('-')).getTime();
    const dateB = new Date(b.date.split('/').reverse().join('-')).getTime();
    return dateB - dateA;
  });

  const monthMap = new Map<string, any>();
  salesByDayData.forEach(item => {
    if (!item.date) return;
    const [day, month, year] = item.date.split('/');
    if (!day || !month || !year) return;

    const monthKey = `${year}-${month.padStart(2, '0')}`;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = monthNames[parseInt(month, 10) - 1] || month;
    const monthYear = `${monthName.toUpperCase()} ${year}`;

    const existing = monthMap.get(monthKey) || {
      monthKey,
      monthYear,
      totalAmount: 0,
      totalQty: 0,
      totalInvoices: 0,
      totalCustomers: 0,
      totalProducts: 0,
      daysCount: 0
    };

    existing.totalAmount += item.amount;
    existing.totalQty += item.qty;
    existing.totalInvoices += item.salInvoicesCount;
    existing.totalCustomers += item.salCustomersCount;
    existing.totalProducts += item.salProductsCount;
    existing.daysCount += 1;

    monthMap.set(monthKey, existing);
  });

  const avgSalesByDayData = Array.from(monthMap.values()).map(item => ({
    monthKey: item.monthKey,
    monthYear: item.monthYear,
    avgAmount: item.daysCount > 0 ? item.totalAmount / item.daysCount : 0,
    avgQty: item.daysCount > 0 ? item.totalQty / item.daysCount : 0,
    avgInvoices: item.daysCount > 0 ? item.totalInvoices / item.daysCount : 0,
    avgCustomers: item.daysCount > 0 ? item.totalCustomers / item.daysCount : 0,
    avgProducts: item.daysCount > 0 ? item.totalProducts / item.daysCount : 0
  })).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

  return { dailySalesData: filteredInvoices, salesByDayData, avgSalesByDayData };
}

// -------------------------------------------------------------
// 3. Statistics Data
// -------------------------------------------------------------
function calculateStatsForDimension(data: any[], dimensionKey: string) {
  const dimensionMap = new Map<string, { amount: number; qty: number; count: number }>();
  const dimensionCustomersMap = new Map<string, Set<string>>();
  const dimensionMonthsMap = new Map<string, Set<string>>();
  const monthlyData = new Map<string, Map<string, { amount: number; qty: number }>>();

  data.forEach(item => {
    const dimValue = item[dimensionKey];
    if (!dimValue) return;

    const existing = dimensionMap.get(dimValue) || { amount: 0, qty: 0, count: 0 };
    dimensionMap.set(dimValue, {
      amount: existing.amount + (Number(item.amount) || 0),
      qty: existing.qty + (Number(item.qty) || 0),
      count: existing.count + 1
    });

    const customerKey = item.customerId || item.customerName;
    if (customerKey) {
      if (!dimensionCustomersMap.has(dimValue)) {
        dimensionCustomersMap.set(dimValue, new Set());
      }
      dimensionCustomersMap.get(dimValue)!.add(String(customerKey));
    }

    if (!item.invoiceDate) return;
    const date = new Date(item.invoiceDate);
    if (isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!dimensionMonthsMap.has(dimValue)) {
      dimensionMonthsMap.set(dimValue, new Set());
    }
    dimensionMonthsMap.get(dimValue)!.add(monthKey);

    if (!monthlyData.has(dimValue)) {
      monthlyData.set(dimValue, new Map());
    }
    const dimMonths = monthlyData.get(dimValue)!;

    if (!dimMonths.has(monthKey)) {
      dimMonths.set(monthKey, { amount: 0, qty: 0 });
    }
    const monthData = dimMonths.get(monthKey)!;
    monthData.amount += Number(item.amount) || 0;
    monthData.qty += Number(item.qty) || 0;
  });

  const totalAmountAll = Array.from(dimensionMap.values()).reduce((sum, v) => sum + v.amount, 0);

  const stats = Array.from(dimensionMap.entries()).map(([dim, values]) => {
    const monthsCount = dimensionMonthsMap.get(dim)?.size || 1;
    const averageMonthly = values.amount / monthsCount;

    const dimMonthlyData = monthlyData.get(dim);
    let averageMonthlyGrowth = 0;
    if (dimMonthlyData && dimMonthlyData.size > 1) {
      const sortedMonths = Array.from(dimMonthlyData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      const growths: number[] = [];
      for (let i = 1; i < sortedMonths.length; i++) {
        const prevAmount = sortedMonths[i - 1][1].amount;
        const currAmount = sortedMonths[i][1].amount;
        growths.push(currAmount - prevAmount);
      }
      if (growths.length > 0) {
        averageMonthlyGrowth = growths.reduce((sum, g) => sum + g, 0) / growths.length;
      }
    }

    return {
      name: dim,
      totalAmount: values.amount,
      totalQty: values.qty,
      invoiceCount: values.count,
      customerCount: dimensionCustomersMap.get(dim)?.size || 0,
      averageMonthly: averageMonthly,
      averageMonthlyGrowth: averageMonthlyGrowth,
      percentageOfTotal: totalAmountAll > 0 ? (values.amount / totalAmountAll) * 100 : 0
    };
  }).sort((a, b) => b.totalAmount - a.totalAmount);

  const serializedMonthlyData: Record<string, any> = {};
  for (const [dim, monthsMap] of monthlyData.entries()) {
    serializedMonthlyData[dim] = Object.fromEntries(monthsMap);
  }

  return { stats, monthlyData: serializedMonthlyData };
}

export async function getStatisticsData(userId: string, filters: any) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data: globallyFilteredData, error } = await bhs_supabas.rpc('get_sales_stock_raw_data', {
    p_user_id: userId,
    p_invoice_type: invoiceType || 'all',
    p_year: year || null,
    p_month: month || null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getStatisticsData:', error);
    return { areaStats: [], marketStats: [], merchandiserStats: [], salesRepStats: [] };
  }

  const areaStats = calculateStatsForDimension(globallyFilteredData, 'area');
  const marketStats = calculateStatsForDimension(globallyFilteredData, 'market');
  const merchandiserStats = calculateStatsForDimension(globallyFilteredData, 'merchandiser');
  const salesRepStats = calculateStatsForDimension(globallyFilteredData, 'salesRep');

  return { areaStats, marketStats, merchandiserStats, salesRepStats };
}
