'use server';

import { bhs_supabas, SalesInvoice } from '@/lib/supabase';
import { 
  getFilteredSalesData,
  checkHasSalesDataAccess,
  getMappingServer,
  getCachedUsersList,
  invalidateMappingCache,
  loadUserMaps,
  normalizeMappingCustomerId,
  resolveMerchandiserUserId,
  resolveSalesRepUserId,
  loadCustomerMaps,
  resolveCustomerId,
  isLegacyMappingRowId
} from '@/app/Sales/Utils/SalesMappingCache';

function normCustomerId(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value).trim().toUpperCase();
}

async function getCustomerNameMap() {
  const { data, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"');

  if (error) throw error;

  const map = new Map<string, { mainName: string; subName: string }>();
  (data || []).forEach((row) => {
    const id = normCustomerId(row['CUSTOMER ID']);
    if (!id) return;
    map.set(id, {
      mainName: row['CUSTOMER MAIN NAME'] || '',
      subName: row['CUSTOMER SUB NAME'] || '',
    });
  });
  return map;
}

// -------------------------------------------------------------
// 1. Customers Data
// -------------------------------------------------------------
export async function getCustomersData(userId: string, filters: any, activeTab: string) {
  const augmentedData = await getFilteredSalesData(userId);
  const customerNameMap = await getCustomerNameMap();

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag, product, customerMainName, customerSubName, customerTag, customerClass } = filters;

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
    if (customerMainName) globallyFilteredData = globallyFilteredData.filter(i => i.customerMainName === customerMainName);
    if (customerSubName) globallyFilteredData = globallyFilteredData.filter(i => i.customerName === customerSubName);
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

  const customerMap = new Map<string, any>();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  for (let i = 0; i < globallyFilteredData.length; i++) {
    const item = globallyFilteredData[i];
    const normalizedId = normCustomerId(item.customerId);
    const freshNames = normalizedId ? customerNameMap.get(normalizedId) : undefined;

    let key: string;
    let displayName: string;

    if (activeTab === 'main') {
      displayName = freshNames?.mainName || item.customerMainName || item.customerName || 'Unknown';
      key = displayName;
    } else {
      key = normalizedId || item.customerName || 'Unknown';
      displayName = freshNames?.subName || item.customerName || item.customerMainName || 'Unknown';
    }

    let existing = customerMap.get(key);

    if (!existing) {
      existing = {
        customerId: normalizedId || key,
        customer: displayName,
        area: item.area || '',
        market: item.market || '',
        totalAmount: 0,
        totalQty: 0,
        barcodes: new Set<string>(),
        months: new Set<string>(),
        invoiceNumbers: new Set<string>(),
        monthlyData: {} 
      };
      customerMap.set(key, existing);
    } else if (displayName && existing.customer !== displayName && freshNames?.subName) {
      existing.customer = displayName;
    }

    existing.totalAmount += Number(item.amount) || 0;
    existing.totalQty += Number(item.qty) || 0;

    if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
      existing.invoiceNumbers.add(item.invoiceNumber);
      const productKey = item.productId || item.barcode || item.product;
      existing.barcodes.add(productKey);
    }

    if (item.invoiceDate) {
      const date = new Date(item.invoiceDate);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const monthKey = `${year}-${month < 10 ? '0' : ''}${month}`;
        existing.months.add(monthKey);

        if (!existing.monthlyData[monthKey]) {
          existing.monthlyData[monthKey] = { amount: 0, qty: 0 };
        }
        existing.monthlyData[monthKey].amount += Number(item.amount) || 0;
        existing.monthlyData[monthKey].qty += Number(item.qty) || 0;
      }
    }
  }

  return Array.from(customerMap.values()).map(item => {
    let totalMonths = 1;
    if (item.months.size > 0) {
      const sortedMonths = Array.from(item.months as Set<string>).sort();
      const firstMonthKey = sortedMonths[0];
      const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);
      const firstDate = new Date(firstYear, firstMonth - 1, 1);
      const lastDate = new Date(currentYear, currentMonth, 1);
      const yearsDiff = lastDate.getFullYear() - firstDate.getFullYear();
      const monthsDiff = lastDate.getMonth() - firstDate.getMonth();
      totalMonths = (yearsDiff * 12) + monthsDiff + 1;
      if (totalMonths < 1) totalMonths = 1;
    }

    return {
      customerId: item.customerId,
      customer: item.customer,
      area: item.area,
      market: item.market,
      totalAmount: item.totalAmount,
      totalQty: item.totalQty,
      averageAmount: item.totalAmount / totalMonths,
      averageQty: item.totalQty / totalMonths,
      productsCount: item.barcodes.size,
      transactions: item.invoiceNumbers.size,
      monthlyData: item.monthlyData
    };
  });
}

// -------------------------------------------------------------
// 2. Customer Details Data
// -------------------------------------------------------------
export async function getCustomerDetailsData(userId: string, filters: any, customerName: string, customerId: string, customerType: string) {
  const augmentedData = await getFilteredSalesData(userId);
  const targetCustomerId = normCustomerId(customerId);

  let customerRawData = augmentedData.filter(item => {
    if (customerType === 'main') {
      return (item.customerMainName || item.customerName || 'Unknown') === customerName;
    }
    if (targetCustomerId) {
      return normCustomerId(item.customerId) === targetCustomerId;
    }
    return item.customerName === customerName;
  });

  let allData = customerRawData;
  if (filters) {
    const { invoiceType, area, market, merchandiser, salesRep, productTag, product, customerMainName, customerSubName, customerTag, customerClass } = filters;
    if (invoiceType && invoiceType !== 'all') {
      allData = allData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) allData = allData.filter(i => i.productTag === productTag);
    if (product) allData = allData.filter(i => i.product === product);
    if (customerMainName) allData = allData.filter(i => i.customerMainName === customerMainName);
    if (customerSubName) allData = allData.filter(i => i.customerName === customerSubName);
    if (customerClass) allData = allData.filter(i => i.customerClass === customerClass);
    if (area) allData = allData.filter(i => i.area === area);
    if (market) allData = allData.filter(i => i.market === market);
    if (merchandiser) allData = allData.filter(i => i.merchandiser === merchandiser);
    if (salesRep) allData = allData.filter(i => i.salesRep === salesRep);
  }

  let data = allData;
  if (filters) {
    const { year, month, dateFrom, dateTo } = filters;
    if (year) {
      const yearNum = parseInt(year, 10);
      data = data.filter(item => {
        if (!item.invoiceDate) return false;
        const d = new Date(item.invoiceDate);
        return !isNaN(d.getTime()) && d.getFullYear() === yearNum;
      });
    }
    if (month) {
      const monthNum = parseInt(month, 10);
      data = data.filter(item => {
        if (!item.invoiceDate) return false;
        const d = new Date(item.invoiceDate);
        return !isNaN(d.getTime()) && d.getMonth() + 1 === monthNum;
      });
    }
    if (dateFrom || dateTo) {
      data = data.filter(item => {
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

  const mainGroupData =
    customerType === 'sub'
      ? buildMainGroupDataForSub(augmentedData, customerRawData, filters)
      : [];

  return { data, allData, mainGroupData };
}

function buildMainGroupDataForSub(
  augmentedData: SalesInvoice[],
  customerRawData: SalesInvoice[],
  filters: any
): SalesInvoice[] {
  if (customerRawData.length === 0) return [];

  const mainName = (customerRawData[0].customerMainName || customerRawData[0].customerName || '').trim();
  if (!mainName) return [];

  let mainGroupData = augmentedData.filter(
    (item) => (item.customerMainName || item.customerName || 'Unknown').trim() === mainName
  );

  if (filters) {
    const { invoiceType, area, market, merchandiser, salesRep, productTag, product, customerName, customerTag, customerClass } = filters;
    if (invoiceType && invoiceType !== 'all') {
      mainGroupData = mainGroupData.filter((item) => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) mainGroupData = mainGroupData.filter((i) => i.productTag === productTag);
    if (product) mainGroupData = mainGroupData.filter((i) => i.product === product);
    if (customerTag) mainGroupData = mainGroupData.filter(i => i.customerTag === customerTag);
    if (customerName) mainGroupData = mainGroupData.filter(i => i.customerName === customerName || i.customerMainName === customerName);
    if (customerClass) mainGroupData = mainGroupData.filter(i => i.customerClass === customerClass);
    if (area) mainGroupData = mainGroupData.filter((i) => i.area === area);
    if (market) mainGroupData = mainGroupData.filter((i) => i.market === market);
    if (merchandiser) mainGroupData = mainGroupData.filter((i) => i.merchandiser === merchandiser);
    if (salesRep) mainGroupData = mainGroupData.filter((i) => i.salesRep === salesRep);
  }

  return mainGroupData;
}

// -------------------------------------------------------------
// 3. Customers List
// -------------------------------------------------------------
export async function getCustomersList() {
  const { data, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME", "CUSTOMER CITY"')
    .order('CUSTOMER MAIN NAME', { ascending: true });

  if (error) throw error;

  return (data || []).map((c: any) => ({
    id: c['CUSTOMER ID'],
    mainName: c['CUSTOMER MAIN NAME'] || '',
    subName: c['CUSTOMER SUB NAME'] || '',
    city: String(c['CUSTOMER CITY'] || '').trim(),
  }));
}

// -------------------------------------------------------------
// 4. Customers Comparison
// -------------------------------------------------------------
export async function getCustomersComparisonData(userId: string, filters: any, currentYear: number, prevYear: number, selectedMonths: string[]) {
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, area, market, merchandiser, salesRep, productTag, product, customerName, customerTag, customerClass } = filters;

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
  }

  const targetMonths = Array.isArray(selectedMonths) 
    ? selectedMonths.filter(m => m !== '').map(m => parseInt(m, 10)) 
    : (selectedMonths && typeof selectedMonths === 'string' ? [parseInt(selectedMonths as string, 10)] : []);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Match Overview: use latest year/month in data as comparison window (not full prior year).
  let latestMonthKey = '';
  for (let i = 0; i < globallyFilteredData.length; i++) {
    const item = globallyFilteredData[i];
    if (!item.invoiceDate) continue;
    const d = new Date(item.invoiceDate);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key > latestMonthKey) latestMonthKey = key;
  }

  const resolvedCurrentYear = latestMonthKey
    ? parseInt(latestMonthKey.split('-')[0], 10)
    : currentYear;
  const resolvedPrevYear = resolvedCurrentYear - 1;

  let ytdEndMonth: number | null = null;
  if (targetMonths.length === 0 && latestMonthKey) {
    ytdEndMonth = parseInt(latestMonthKey.split('-')[1], 10);
    const todayMonth = today.getMonth() + 1;
    if (resolvedCurrentYear === today.getFullYear()) {
      ytdEndMonth = Math.min(ytdEndMonth, todayMonth);
    }
  }

  const processDataForType = (type: 'main' | 'sub') => {
    const mapPrev = new Map<string, { mainName: string; subName: string; amount: number }>();
    const mapCurr = new Map<string, { mainName: string; subName: string; amount: number }>();

    for (let i = 0; i < globallyFilteredData.length; i++) {
      const item = globallyFilteredData[i];
      if (!item.invoiceDate) continue;

      const d = new Date(item.invoiceDate);
      if (isNaN(d.getTime())) continue;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;

      if (targetMonths.length > 0) {
        if (!targetMonths.includes(month)) continue;
      } else if (ytdEndMonth !== null && month > ytdEndMonth) {
        continue;
      }

      if (year === resolvedCurrentYear && d > today) continue;

      const key = type === 'sub'
        ? (item.customerId?.trim() || item.customerName?.trim())
        : (item.customerMainName?.trim() || item.customerName?.trim());

      if (!key) continue;

      const mainName = item.customerMainName?.trim() || item.customerName?.trim() || '';
      const subName = item.customerName?.trim() || '';

      if (year === resolvedPrevYear) {
        const existing = mapPrev.get(key) || { mainName, subName, amount: 0 };
        existing.amount += Number(item.amount) || 0;
        mapPrev.set(key, existing);
      } else if (year === resolvedCurrentYear) {
        const existing = mapCurr.get(key) || { mainName, subName, amount: 0 };
        existing.amount += Number(item.amount) || 0;
        mapCurr.set(key, existing);
      }
    }

    const allKeys = new Set([...mapPrev.keys(), ...mapCurr.keys()]);
    const result: any[] = [];

    for (const key of allKeys) {
      const prev = mapPrev.get(key);
      const curr = mapCurr.get(key);
      const prevAmt = prev?.amount ?? 0;
      const currAmt = curr?.amount ?? 0;
      const diff = currAmt - prevAmt;
      const pct = prevAmt > 0 ? (diff / prevAmt) * 100 : (currAmt > 0 ? 100 : 0);

      const mainName = (curr?.mainName || prev?.mainName) ?? '';
      const subName = type === 'sub' ? ((curr?.subName || prev?.subName) ?? '') : '';

      result.push({
        customerId: key,
        mainName,
        subName,
        prev: prevAmt,
        curr: currAmt,
        diff,
        pct,
      });
    }

    return result;
  };

  return {
    mainComparison: processDataForType('main'),
    subComparison: processDataForType('sub'),
    currentYear: resolvedCurrentYear,
    prevYear: resolvedPrevYear,
    ytdEndMonth,
  };
}

// -------------------------------------------------------------
// 5. My Customers (Mappings)
// -------------------------------------------------------------
function mapMappingToCustomerRow(m: {
  id: string;
  customerId: string;
  userId?: string;
  merchandiserId?: string;
  customerMainName?: string;
  customerSubName?: string;
  area?: string;
  market?: string;
  salesRep?: string;
  merchandiser?: string;
}) {
  return {
    'CUSTOMER ID': m.customerId,
    'USER_ID': m.userId || '',
    'MERCHANDISER_ID': m.merchandiserId || '',
    'CUSTOMER MAIN NAME': m.customerMainName || '',
    'CUSTOMER SUB NAME': m.customerSubName || '',
    'AREA': m.area || '',
    'MARKET': m.market || '',
    'SALES_REP': m.salesRep || '',
    'MERCHANDISER': m.merchandiser || '',
  };
}

export async function getMyCustomersData(userId: string) {
  const filteredMappings = await getMappingServer(userId);
  return Array.from(filteredMappings.values())
    .map(mapMappingToCustomerRow)
    .sort((a, b) => a['CUSTOMER MAIN NAME'].localeCompare(b['CUSTOMER MAIN NAME']));
}

export async function batchSaveCustomerMapping(userId: string, mapping: Record<string, any>) {
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
// 6. Inactive Customers
// -------------------------------------------------------------
export async function getInactiveCustomersData(userId: string, filters: any, days: number | string, minAmount: number | string) {
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

  const customerMap = new Map<string, any>();
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < globallyFilteredData.length; i++) {
    const item = globallyFilteredData[i];
    const key = item.customerId || item.customerName;
    let existing = customerMap.get(key);

    if (!existing) {
      existing = {
        customerId: key,
        customer: item.customerName,
        lastPurchaseDate: null,
        totalAmount: 0,
        invoiceNumbers: new Set<string>(),
      };
      customerMap.set(key, existing);
    }

    if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
      existing.totalAmount += Number(item.amount) || 0;
      existing.invoiceNumbers.add(item.invoiceNumber);

      if (item.invoiceDate) {
        const date = new Date(item.invoiceDate);
        if (!isNaN(date.getTime())) {
          if (!existing.lastPurchaseDate || date > existing.lastPurchaseDate) {
            existing.lastPurchaseDate = date;
          }
        }
      }
    }
  }

  const result: any[] = [];
  const minD = parseInt(String(days)) || 10;
  const minA = parseFloat(String(minAmount)) || 0;

  customerMap.forEach(item => {
    if (!item.lastPurchaseDate) return;

    const daysSince = Math.floor((currentDate.getTime() - item.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSince < minD) return;
    if (item.totalAmount < minA) return;

    const orderCount = item.invoiceNumbers.size;
    const averageOrderValue = orderCount > 0 ? item.totalAmount / orderCount : 0;

    let status = 'Lost';
    if (daysSince < 30) status = 'At Risk';
    else if (daysSince < 60) status = 'Inactive';

    result.push({
      customerId: item.customerId,
      customer: item.customer,
      lastPurchaseDate: item.lastPurchaseDate,
      daysSinceLastPurchase: daysSince,
      totalAmount: item.totalAmount,
      averageOrderValue,
      orderCount,
      status
    });
  });

  return result;
}

// -------------------------------------------------------------
// 7. Inactive Customers Exceptions
// -------------------------------------------------------------
const INACTIVE_CUSTOMERS_TABLE = 'web_Sales_DB_INACTIVECUSTOMERS';

async function resolveCustomerNames(customerIds: string[]) {
  const uniqueIds = [...new Set(customerIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, string>();

  const { data: customers, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER SUB NAME", "CUSTOMER MAIN NAME"')
    .in('CUSTOMER ID', uniqueIds);

  if (error) throw error;

  const nameById = new Map<string, string>();
  (customers || []).forEach((c) => {
    const id = String(c['CUSTOMER ID'] || '').trim();
    const name =
      c['CUSTOMER SUB NAME'] ||
      c['CUSTOMER MAIN NAME'] ||
      id;
    if (id) nameById.set(id, name);
  });

  return nameById;
}

export async function getInactiveCustomerExceptions() {
  const { data: rows, error } = await bhs_supabas
    .from(INACTIVE_CUSTOMERS_TABLE)
    .select('"ID", "CUSTOMER ID", "CREATED_AT"')
    .order('CREATED_AT', { ascending: false });

  if (error) throw error;

  const customerIds = (rows || []).map((r) => String(r['CUSTOMER ID'] || '').trim());
  const nameById = await resolveCustomerNames(customerIds);

  return (rows || []).map((row) => {
    const customerId = String(row['CUSTOMER ID'] || '').trim();
    return {
      customerId,
      customerName: nameById.get(customerId) || customerId,
    };
  });
}

export async function hideInactiveCustomer(customerId: string, customerName?: string) {
  const cId = String(customerId || '').trim();
  if (!cId) {
    throw new Error('customerId is required');
  }

  const { data: existing, error: existingError } = await bhs_supabas
    .from(INACTIVE_CUSTOMERS_TABLE)
    .select('"ID"')
    .eq('CUSTOMER ID', cId)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return { success: true, alreadyExists: true };
  }

  const { error } = await bhs_supabas.from(INACTIVE_CUSTOMERS_TABLE).insert({
    ID: cId,
    'CUSTOMER ID': cId,
  });

  if (error) throw error;

  return {
    success: true,
    data: { customerId: cId, customerName: customerName || cId },
  };
}

export async function restoreInactiveCustomer(customerId: string) {
  const cId = String(customerId || '').trim();
  if (!cId) {
    throw new Error('customerId is required');
  }

  const { error } = await bhs_supabas
    .from(INACTIVE_CUSTOMERS_TABLE)
    .delete()
    .eq('CUSTOMER ID', cId);

  if (error) throw error;

  return { success: true };
}
