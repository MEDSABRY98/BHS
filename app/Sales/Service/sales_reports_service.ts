'use server';

import { bhs_supabas } from '@/lib/supabase';
import {
  augmentWithDates,
  applyGeoFilters,
  buildAtRisk,
  buildCustomerChangeRows,
  buildDeclining,
  buildGrowing,
  buildLast6MonthsComparison,
  buildMonthlySparkline,
  buildTopCategories,
  buildTopCustomers,
  buildTopReturnCustomers,
  buildTopInvoicesByValue,
  buildTopProducts,
  buildDailySalesCalendars,
  computePeriodMetrics,
  getPrevMonthPeriod,
  getPrevPeriod,
  getSamePeriodLastYear,
  periodData,
  pctChange,
  absChange,
  resolveReportPeriod,
} from '@/app/Sales/Reports/ReportsAggregation';
import {
  getPrimaryAmount,
  REPORTING_MODE_LABELS,
  PRIMARY_AMOUNT_LABELS,
  resolveReportingMode,
  shouldShowReturnAmountKpi,
  shouldShowTargetAchievement,
  shouldShowTargetInChart,
} from '@/app/Sales/Reports/ReportingMode';

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

async function fetchUserName(uid: string): Promise<string> {
  const { data } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME')
    .eq('ID', uid.toUpperCase())
    .maybeSingle();
  return data?.NAME || uid;
}

async function resolveUserIdByName(name: string): Promise<string | null> {
  const { data: users } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
  if (!users) return null;
  const upper = name.trim().toUpperCase();
  const match = users.find((u) => String(u.NAME || '').trim().toUpperCase() === upper);
  return match?.ID || null;
}

async function checkIsManager(userId: string): Promise<boolean> {
  const { data: user } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME, ROLE, IS_SALESMANAGER')
    .eq('ID', String(userId).trim().toUpperCase())
    .maybeSingle();
  if (!user) return false;
  const userName = String(user.NAME || '').trim().toLowerCase();
  return (
    userName === 'med sabry' ||
    String(user.ROLE || '').toLowerCase() === 'admin' ||
    user.IS_SALESMANAGER === true ||
    String(user.IS_SALESMANAGER || '').toUpperCase() === 'TRUE'
  );
}

function sumTargetsForMonth(
  targetMap: Map<string, number>,
  year: number,
  month: number,
  userIds?: string[] | null,
  targetType?: 'sales_rep' | 'merchandiser' | null
): number {
  let total = 0;
  targetMap.forEach((amount, key) => {
    const parts = key.split('|');
    const uid = parts[0];
    const y = parseInt(parts[1], 10);
    const m = parseInt(parts[2], 10);
    const type = parts[3] || 'sales_rep';
    if (y !== year || m !== month) return;
    if (targetType && type !== targetType) return;
    if (userIds && userIds.length > 0 && !userIds.includes(uid)) return;
    total += amount;
  });
  return total;
}

function kpiBlock(value: number, change: number, sparkline: number[], changeIsPct = true) {
  return {
    value,
    changePct: changeIsPct ? change : undefined,
    changeAbs: !changeIsPct ? change : undefined,
    sparkline,
  };
}

// -------------------------------------------------------------
// 1. Reports Data
// -------------------------------------------------------------
export async function getReportsData(userId: string, filters: any) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_reports_data', {
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
    console.error('RPC Error in getReportsData:', error);
    throw error;
  }

  return data;
}

// -------------------------------------------------------------
// 2. Stock Report Data
// -------------------------------------------------------------
const calculateMode = (numbers: number[]): number => {
  if (!numbers || numbers.length === 0) return 0;
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = numbers[0];
  for (const n of numbers) {
    const val = parseFloat(n.toFixed(2));
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      mode = val;
    }
  }
  return mode;
};

export async function getStockReportData(userId: string, filters: any) {
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
    console.error('RPC Error in getStockReportData:', error);
    return { customersData: [], subCustomersData: [], productList: [] };
  }

  const sortedData = [...(globallyFilteredData || [])].sort((a, b) => {
    const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
    const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
    return dateB - dateA;
  });

  const customerMap = new Map<string, {
    customerId: string;
    latestName: string;
    allNames: Set<string>;
    products: Map<string, {
      barcode: string;
      product: string;
      prices: number[];
      cost: number;
      allNames: Set<string>;
      allBarcodes: Set<string>;
    }>;
  }>();

  const subCustomerMap = new Map<string, {
    customerId: string;
    latestName: string;
    allNames: Set<string>;
    products: Map<string, {
      barcode: string;
      product: string;
      prices: number[];
      cost: number;
      allNames: Set<string>;
      allBarcodes: Set<string>;
    }>;
  }>();

  const upsertCustomerProduct = (
    map: Map<string, any>,
    key: string,
    init: { customerId: string; latestName: string },
    item: any,
    pNum: number,
    productKey: string
  ) => {
    if (!map.has(key)) {
      map.set(key, {
        customerId: init.customerId,
        latestName: init.latestName,
        allNames: new Set<string>(),
        products: new Map(),
      });
    }
    const entry = map.get(key)!;
    if (item.customerMainName) entry.allNames.add(item.customerMainName.toLowerCase());
    if (item.customerName) entry.allNames.add(item.customerName.toLowerCase());

    if (!entry.products.has(productKey)) {
      entry.products.set(productKey, {
        barcode: item.barcode || '-',
        product: item.product || '-',
        prices: [],
        cost: item.productCost || 0,
        allNames: new Set<string>(),
        allBarcodes: new Set<string>(),
      });
    }
    const prodInCust = entry.products.get(productKey)!;
    if (item.product) prodInCust.allNames.add(item.product.toLowerCase());
    if (item.barcode) prodInCust.allBarcodes.add(item.barcode.toLowerCase());
    if (!isNaN(pNum) && pNum > 0) prodInCust.prices.push(pNum);
    if (item.productCost > 0) prodInCust.cost = Math.max(prodInCust.cost, item.productCost);
  };

  const finalizeCustomerEntries = (entries: Iterable<any>) =>
    Array.from(entries).map((entry: any) => ({
      customerId: entry.customerId,
      customer: entry.latestName,
      allNames: Array.from(entry.allNames),
      products: Array.from(entry.products.values()).map((p: any) => ({
        barcode: p.barcode,
        product: p.product,
        cost: p.cost,
        mostPrice: calculateMode(p.prices),
        lastPrice: p.prices[0] || 0,
        allNames: Array.from(p.allNames),
        allBarcodes: Array.from(p.allBarcodes),
      })).sort((a: any, b: any) => a.product.localeCompare(b.product)),
    })).sort((a, b) => a.customer.localeCompare(b.customer));

  const productMap = new Map<string, {
    productId: string;
    barcode: string;
    product: string;
    priceRange: { min: number, max: number };
    customers: Map<string, { prices: number[]; cost: number }>;
    allNames: Set<string>;
    allBarcodes: Set<string>;
  }>();

  sortedData.forEach(item => {
    const itemAny = item as any;
    let price = itemAny.productPrice || 0;
    if (!price && itemAny.amount && itemAny.qty) price = itemAny.amount / itemAny.qty;
    const pNum = parseFloat(price);

    const mainName = (item.customerMainName || item.customerName || 'Unknown').trim();
    const mainKey = mainName.toLowerCase();
    const subName = (item.customerName || '').trim() || item.customerMainName || 'Unknown';
    const subKey = item.customerId ? `${item.customerId}::${subName}` : subName;
    const productKey = item.productId || item.barcode || item.product || 'Unknown';

    upsertCustomerProduct(
      customerMap,
      mainKey,
      { customerId: item.customerId || '', latestName: mainName },
      item,
      pNum,
      productKey
    );

    upsertCustomerProduct(
      subCustomerMap,
      subKey,
      { customerId: item.customerId || '', latestName: subName },
      item,
      pNum,
      productKey
    );

    if (!productMap.has(productKey)) {
      productMap.set(productKey, {
        productId: item.productId || '',
        barcode: item.barcode || '-',
        product: item.product || '-',
        priceRange: { min: Infinity, max: -Infinity },
        customers: new Map(),
        allNames: new Set(),
        allBarcodes: new Set()
      });
    }
    const prodEntry = productMap.get(productKey)!;
    if (item.product) prodEntry.allNames.add(item.product.toLowerCase());
    if (item.barcode) prodEntry.allBarcodes.add(item.barcode.toLowerCase());

    if (!prodEntry.customers.has(mainName)) {
      prodEntry.customers.set(mainName, { prices: [], cost: item.productCost || 0 });
    }
    const custInProd = prodEntry.customers.get(mainName)!;
    if (!isNaN(pNum) && pNum > 0) {
      custInProd.prices.push(pNum);
      prodEntry.priceRange.min = Math.min(prodEntry.priceRange.min, pNum);
      prodEntry.priceRange.max = Math.max(prodEntry.priceRange.max, pNum);
    }
    if (item.productCost > 0) custInProd.cost = Math.max(custInProd.cost, item.productCost);
  });

  const customersData = finalizeCustomerEntries(customerMap.values());
  const subCustomersData = finalizeCustomerEntries(subCustomerMap.values());

  const productList = Array.from(productMap.values()).map(prod => {
    const customers = Array.from(prod.customers.entries()).map(([cName, stats]) => {
      return {
        customerName: cName,
        mostPrice: calculateMode(stats.prices),
        lastPrice: stats.prices[0] || 0,
        cost: stats.cost,
        pricesDistribution: stats.prices 
      };
    });

    return {
      productId: prod.productId,
      barcode: prod.barcode,
      product: prod.product,
      priceRange: prod.priceRange,
      customers,
      allNames: Array.from(prod.allNames),
      allBarcodes: Array.from(prod.allBarcodes)
    };
  }).sort((a, b) => a.product.localeCompare(b.product));

  return { customersData, subCustomersData, productList };
}

// -------------------------------------------------------------
// 3. Top 10 Data
// -------------------------------------------------------------
export async function getTop10Data(userId: string, filters: any) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_top_10', {
    p_user_id: userId,
    p_invoice_type: invoiceType || 'all',
    p_year: year ? parseInt(year, 10) : null,
    p_month: month ? parseInt(month, 10) : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getTop10Data:', error);
    return { productsData: [], mainCustomersData: [], subCustomersData: [] };
  }

  return data || { productsData: [], mainCustomersData: [], subCustomersData: [] };
}

// -------------------------------------------------------------
// 4. New Listings Data
// -------------------------------------------------------------
export async function getNewListingsData(userId: string, filters: any) {
  const { year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const { data, error } = await bhs_supabas.rpc('get_sales_new_listings', {
    p_user_id: userId,
    p_year: year ? parseInt(year, 10) : null,
    p_month: month ? parseInt(month, 10) : null,
    p_date_from: dateFrom || null,
    p_date_to: dateTo || null,
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  });

  if (error) {
    console.error('RPC Error in getNewListingsData:', error);
    return [];
  }

  return data || [];
}
