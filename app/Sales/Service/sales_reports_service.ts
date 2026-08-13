'use server';

import { bhs_supabas } from '@/lib/supabase';
import { getFilteredSalesData, checkHasSalesDataAccess } from '@/app/Sales/Utils/SalesMappingCache';
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
  const rawData = await getFilteredSalesData(userId);
  const geoData = applyGeoFilters(augmentWithDates(rawData), filters);
  const reportingMode = resolveReportingMode(filters?.invoiceType);

  const period = resolveReportPeriod(filters);
  const prevPeriod = getPrevPeriod(period.fromTime, period.toTime);
  const smlyPeriod = getSamePeriodLastYear(period.fromTime, period.toTime);
  const prevPrevPeriod = getPrevPeriod(prevPeriod.fromTime, prevPeriod.toTime);

  const currentData = periodData(geoData, period.fromTime, period.toTime);
  const prevMonthData = periodData(geoData, prevPeriod.fromTime, prevPeriod.toTime);
  const smlyData = periodData(geoData, smlyPeriod.fromTime, smlyPeriod.toTime);
  const prevPrevData = periodData(geoData, prevPrevPeriod.fromTime, prevPrevPeriod.toTime);

  const smlyPrevPeriod = getPrevPeriod(smlyPeriod.fromTime, smlyPeriod.toTime);
  const smlyPrevData = periodData(geoData, smlyPrevPeriod.fromTime, smlyPrevPeriod.toTime);

  const currentMetrics = computePeriodMetrics(currentData, [], filters?.invoiceType);
  const primaryCurrent = getPrimaryAmount(currentMetrics, reportingMode);

  const targetMap = await fetchTargets();
  const hasSalesDataAccess = await checkHasSalesDataAccess(userId);

  let targetUserIds: string[] | null = null;
  let targetType: 'sales_rep' | 'merchandiser' | null = null;
  if (filters?.salesRep) {
    const rid = await resolveUserIdByName(filters.salesRep);
    targetUserIds = rid ? [rid] : [];
    targetType = 'sales_rep';
  } else if (filters?.merchandiser) {
    const mid = await resolveUserIdByName(filters.merchandiser);
    targetUserIds = mid ? [mid] : [];
    targetType = 'merchandiser';
  } else if (!hasSalesDataAccess) {
    targetUserIds = [String(userId).trim().toUpperCase()];
    targetType = 'sales_rep';
  }

  const getTarget = (y: number, m: number) =>
    hasSalesDataAccess && !filters?.salesRep && !filters?.merchandiser
      ? sumTargetsForMonth(targetMap, y, m, null, 'sales_rep')
      : sumTargetsForMonth(targetMap, y, m, targetUserIds, targetType);

  const monthlyComparison = buildLast6MonthsComparison(
    geoData,
    period.year,
    period.month,
    getTarget,
    { showTarget: shouldShowTargetInChart(reportingMode), invoiceType: filters?.invoiceType }
  );

  const dailySalesCalendars = buildDailySalesCalendars(currentData, period);

  const sparkPrimary = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
    getPrimaryAmount(computePeriodMetrics(items, [], filters?.invoiceType), reportingMode)
  );
  const sparkInvoices = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
    computePeriodMetrics(items, [], filters?.invoiceType).invoices
  );
  const sparkCustomers = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.customerId || i.customerName || ''));
    return set.size;
  });
  const sparkAvgInv = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
    computePeriodMetrics(items, [], filters?.invoiceType).avgInvoiceValue
  );
  const sparkNewCust = buildMonthlySparkline(geoData, period.year, period.month, 8, (items) => {
    const y = items[0]?.yr ?? period.year;
    const m = items[0]?.mn ?? period.month;
    const pp = getPrevMonthPeriod(y, m);
    const prevItems = periodData(geoData, pp.fromTime, pp.toTime);
    return computePeriodMetrics(items, prevItems, filters?.invoiceType).newCustomers;
  });
  const sparkReturns = shouldShowReturnAmountKpi(reportingMode)
    ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
        computePeriodMetrics(items, [], filters?.invoiceType).returnsRate
      )
    : [];
  const sparkReturnInvoices = shouldShowReturnAmountKpi(reportingMode)
    ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
        computePeriodMetrics(items, [], filters?.invoiceType).grvInvoices
      )
    : [];
  const sparkAvgReturn = shouldShowReturnAmountKpi(reportingMode)
    ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) =>
        computePeriodMetrics(items, [], filters?.invoiceType).avgGrvValue
      )
    : [];
  const sparkTarget = shouldShowTargetAchievement(reportingMode)
    ? buildMonthlySparkline(geoData, period.year, period.month, 8, (items) => {
        const y = items[0]?.yr;
        const m = items[0]?.mn;
        if (!y || !m) return 0;
        const actual = getPrimaryAmount(
          computePeriodMetrics(items, [], filters?.invoiceType),
          reportingMode
        );
        const tgt = getTarget(y, m);
        return tgt > 0 ? (actual / tgt) * 100 : 0;
      })
    : [];

  const fixedNewCustomers = computePeriodMetrics(
    currentData,
    prevMonthData,
    filters?.invoiceType
  ).newCustomers;

  const buildKpiView = (
    compareData: typeof currentData,
    compareBaselineData: typeof currentData,
    compareTargetYear: number,
    compareTargetMonth: number
  ) => {
    const metrics = computePeriodMetrics(currentData, compareData, filters?.invoiceType);
    const baselineMetrics = computePeriodMetrics(compareData, compareBaselineData, filters?.invoiceType);
    const compareOnlyMetrics = computePeriodMetrics(compareData, [], filters?.invoiceType);

    const primary = getPrimaryAmount(metrics, reportingMode);
    const primaryCompare = getPrimaryAmount(compareOnlyMetrics, reportingMode);

    const tgt = getTarget(period.year, period.month);
    const compareTgt = getTarget(compareTargetYear, compareTargetMonth);
    const tgtAch =
      shouldShowTargetAchievement(reportingMode) && tgt > 0 ? (primary / tgt) * 100 : 0;
    const compareTgtAch =
      shouldShowTargetAchievement(reportingMode) && compareTgt > 0
        ? (primaryCompare / compareTgt) * 100
        : 0;

    return {
      totalSales: {
        ...kpiBlock(primary, pctChange(primary, primaryCompare), sparkPrimary),
        salesAmount: metrics.salesAmount,
        returnsAmount: metrics.grvAmount,
      },
      ...(shouldShowTargetAchievement(reportingMode)
        ? {
            targetAchievement: {
              value: tgtAch,
              targetAmount: tgt,
              actualAmount: primary,
              changePct: pctChange(tgtAch, compareTgtAch),
              sparkline: sparkTarget,
            },
          }
        : {}),
      invoices: kpiBlock(
        metrics.invoices,
        absChange(metrics.invoices, compareOnlyMetrics.invoices),
        sparkInvoices,
        false
      ),
      activeCustomers: kpiBlock(
        metrics.activeCustomers,
        absChange(metrics.activeCustomers, compareOnlyMetrics.activeCustomers),
        sparkCustomers,
        false
      ),
      avgInvoiceValue: kpiBlock(
        metrics.avgInvoiceValue,
        pctChange(metrics.avgInvoiceValue, compareOnlyMetrics.avgInvoiceValue),
        sparkAvgInv
      ),
      newCustomers: kpiBlock(
        fixedNewCustomers,
        absChange(fixedNewCustomers, baselineMetrics.newCustomers),
        sparkNewCust,
        false
      ),
      ...(shouldShowReturnAmountKpi(reportingMode)
        ? {
            returnsRate: {
              value: metrics.returnsRate,
              changePct: pctChange(metrics.returnsRate, compareOnlyMetrics.returnsRate),
              grvAmount: metrics.grvAmount,
              salesAmount: metrics.salesAmount,
              sparkline: sparkReturns,
            },
            returnInvoices: kpiBlock(
              metrics.grvInvoices,
              absChange(metrics.grvInvoices, compareOnlyMetrics.grvInvoices),
              sparkReturnInvoices,
              false
            ),
            avgReturnValue: kpiBlock(
              metrics.avgGrvValue,
              pctChange(metrics.avgGrvValue, compareOnlyMetrics.avgGrvValue),
              sparkAvgReturn
            ),
          }
        : {}),
    };
  };

  const kpiViews = {
    prevMonth: buildKpiView(prevMonthData, prevPrevData, prevPeriod.year, prevPeriod.month),
    sameMonthLastYear: buildKpiView(smlyData, smlyPrevData, smlyPeriod.year, smlyPeriod.month),
  };

  const comparePrevRowsMain = buildCustomerChangeRows(currentData, prevMonthData, 'main');
  const compareSmlyRowsMain = buildCustomerChangeRows(currentData, smlyData, 'main');
  const comparePrevRowsSub = buildCustomerChangeRows(currentData, prevMonthData, 'sub');
  const compareSmlyRowsSub = buildCustomerChangeRows(currentData, smlyData, 'sub');

  const buildCompareBlock = (
    rows: ReturnType<typeof buildCustomerChangeRows>,
    comparePeriodData: typeof prevMonthData,
    groupBy: 'main' | 'sub'
  ) => ({
    topCustomers: buildTopCustomers(
      currentData,
      rows,
      primaryCurrent,
      groupBy,
      filters?.invoiceType
    ),
    topReturnCustomers: buildTopReturnCustomers(
      currentData,
      comparePeriodData,
      currentMetrics.grvAmount,
      groupBy
    ),
    topDeclining: buildDeclining(rows).map((r, i) => ({ ...r, rank: i + 1 })),
    topGrowing: buildGrowing(rows).map((r, i) => ({ ...r, rank: i + 1 })),
    atRisk: buildAtRisk(rows),
  });

  const customerViews = {
    main: {
      prevMonth: buildCompareBlock(comparePrevRowsMain, prevMonthData, 'main'),
      sameMonthLastYear: buildCompareBlock(compareSmlyRowsMain, smlyData, 'main'),
    },
    sub: {
      prevMonth: buildCompareBlock(comparePrevRowsSub, prevMonthData, 'sub'),
      sameMonthLastYear: buildCompareBlock(compareSmlyRowsSub, smlyData, 'sub'),
    },
  };

  let repDisplayName = await fetchUserName(userId);
  if (filters?.salesRep) repDisplayName = filters.salesRep;
  else if (filters?.merchandiser) repDisplayName = filters.merchandiser;
  else if (hasSalesDataAccess) repDisplayName = 'All Sales Reps';

  return {
    repDisplayName,
    periodLabel: period.label,
    reportingMode,
    reportingModeLabel: REPORTING_MODE_LABELS[reportingMode],
    primaryAmountLabel: PRIMARY_AMOUNT_LABELS[reportingMode],
    compareModes: {
      prevMonth: { label: prevPeriod.label },
      sameMonthLastYear: { label: smlyPeriod.label },
    },
    kpis: kpiViews.prevMonth,
    kpiViews,
    monthlyComparison,
    dailySalesCalendars,
    customerViews,
    topProducts: buildTopProducts(currentData, primaryCurrent),
    topCategories: buildTopCategories(currentData, primaryCurrent),
    topSalesInvoices: buildTopInvoicesByValue(currentData, 'sales'),
    topReturnInvoices: buildTopInvoicesByValue(currentData, 'returns'),
  };
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
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, customerName, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (year && year !== 'All') globallyFilteredData = globallyFilteredData.filter(i => new Date(i.invoiceDate).getFullYear().toString() === year);
    if (month && month !== 'All') globallyFilteredData = globallyFilteredData.filter(i => (new Date(i.invoiceDate).getMonth() + 1).toString() === month);
    if (dateFrom) globallyFilteredData = globallyFilteredData.filter(i => new Date(i.invoiceDate) >= new Date(dateFrom));
    if (dateTo) globallyFilteredData = globallyFilteredData.filter(i => new Date(i.invoiceDate) <= new Date(dateTo));
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
    if (customerTag) globallyFilteredData = globallyFilteredData.filter(i => i.customerTag === customerTag);
    if (customerName) globallyFilteredData = globallyFilteredData.filter(i => i.customerName === customerName || i.customerMainName === customerName);
    if (customerClass) globallyFilteredData = globallyFilteredData.filter(i => i.customerClass === customerClass);
    if (area) globallyFilteredData = globallyFilteredData.filter(i => i.area === area);
    if (market) globallyFilteredData = globallyFilteredData.filter(i => i.market === market);
    if (merchandiser) globallyFilteredData = globallyFilteredData.filter(i => i.merchandiser === merchandiser);
    if (salesRep) globallyFilteredData = globallyFilteredData.filter(i => i.salesRep === salesRep);
  }

  const sortedData = [...globallyFilteredData].sort((a, b) => {
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
    let price = itemAny.price || itemAny.unitPrice || 0;
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
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, customerName, customerTag, customerClass } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
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
// 4. New Listings Data
// -------------------------------------------------------------
export async function getNewListingsData(userId: string, filters: any) {
  const augmentedData = await getFilteredSalesData(userId);

  // Find the absolute FIRST purchase date for each (Customer, Product) pair.
  // We apply non-date global filters FIRST (Area, Market, etc)
  let preFilteredData = augmentedData;
  if (filters) {
    const { area, market, merchandiser, salesRep, productTag, customerName, customerTag, customerClass } = filters;
    if (productTag) preFilteredData = preFilteredData.filter(i => i.productTag === productTag);
    if (customerTag) preFilteredData = preFilteredData.filter(i => i.customerTag === customerTag);
    if (customerName) preFilteredData = preFilteredData.filter(i => i.customerName === customerName || i.customerMainName === customerName);
    if (customerClass) preFilteredData = preFilteredData.filter(i => i.customerClass === customerClass);
    if (area) preFilteredData = preFilteredData.filter(i => i.area === area);
    if (market) preFilteredData = preFilteredData.filter(i => i.market === market);
    if (merchandiser) preFilteredData = preFilteredData.filter(i => i.merchandiser === merchandiser);
    if (salesRep) preFilteredData = preFilteredData.filter(i => i.salesRep === salesRep);
  }

  // Step 1: Find first purchase date for each Customer+Product pair
  const firstPurchaseMap = new Map<string, { time: number, invoiceItem: any }>();

  for (const item of preFilteredData) {
    // ONLY consider SALES invoices
    if (!item.invoiceNumber || typeof item.invoiceNumber !== 'string') continue;

    const invNum = item.invoiceNumber;
    // Fast check for 'SAL' prefix (ignoring case, avoiding trim/toUpperCase for speed)
    if (!(invNum[0] === 'S' || invNum[0] === 's') || !(invNum[1] === 'A' || invNum[1] === 'a') || !(invNum[2] === 'L' || invNum[2] === 'l')) {
      continue;
    }

    if (!item.invoiceDate) continue;

    const customerId = item.customerId || item.customerName;
    const productId = item.productId || item.product;

    if (!customerId || !productId) continue;

    const key = `${customerId}|||${productId}`;
    const itemTime = Date.parse(item.invoiceDate);

    if (isNaN(itemTime)) continue;

    const existing = firstPurchaseMap.get(key);
    if (!existing || itemTime < existing.time) {
      firstPurchaseMap.set(key, { time: itemTime, invoiceItem: item });
    }
  }

  // Step 2: Group by Month and apply date filters
  const monthlyListings: Record<string, any> = {};

  for (const [key, data] of firstPurchaseMap.entries()) {
    const { time, invoiceItem } = data;
    const date = new Date(time);

    // Apply date filters to the "First Purchase Event"
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

    if (!monthlyListings[monthKey]) {
      monthlyListings[monthKey] = {
        products: {}
      };
    }

    const productId = invoiceItem.productId || invoiceItem.product;
    const barcode = invoiceItem.barcode || '-';
    const productName = invoiceItem.product;
    const customerId = invoiceItem.customerId || invoiceItem.customerName;
    const customerName = invoiceItem.customerName || invoiceItem.customerMainName || 'Unknown';

    if (!monthlyListings[monthKey].products[productId]) {
      monthlyListings[monthKey].products[productId] = {
        barcode,
        productName,
        customersMap: new Map() // to ensure unique customers
      };
    }

    monthlyListings[monthKey].products[productId].customersMap.set(customerId, customerName);
  }

  // Transform to Array
  const result: any[] = [];
  const sortedMonths = Object.keys(monthlyListings).sort().reverse(); // Newest first

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
      if (b.customersCount !== a.customersCount) {
        return b.customersCount - a.customersCount;
      }
      return (a.productName || '').localeCompare(b.productName || '');
    });

    // Parse month name for UI convenience
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
