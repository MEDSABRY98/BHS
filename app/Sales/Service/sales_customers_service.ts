'use server';

import { bhs_supabas } from '@/lib/supabase';
import { 
  getFilteredSalesData,
  checkIsManager,
  getMappingServer,
  invalidateMappingCache,
  loadUserMaps,
  migrateLegacyMappingRowIds,
  migrateLegacyMerchandiserNames,
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
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
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
    const { invoiceType, area, market, merchandiser, salesRep, productTag } = filters;
    if (invoiceType && invoiceType !== 'all') {
      allData = allData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) allData = allData.filter(i => i.productTag === productTag);
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

  return { data, allData };
}

// -------------------------------------------------------------
// 3. Customers List
// -------------------------------------------------------------
export async function getCustomersList() {
  const { data, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"')
    .order('CUSTOMER MAIN NAME', { ascending: true });

  if (error) throw error;

  return (data || []).map((c: any) => ({
    id: c['CUSTOMER ID'],
    mainName: c['CUSTOMER MAIN NAME'] || '',
    subName: c['CUSTOMER SUB NAME'] || ''
  }));
}

// -------------------------------------------------------------
// 4. Customers Comparison
// -------------------------------------------------------------
export async function getCustomersComparisonData(userId: string, filters: any, currentYear: number, prevYear: number, selectedMonth: string) {
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, area, market, merchandiser, salesRep, productTag } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
    if (area) globallyFilteredData = globallyFilteredData.filter(i => i.area === area);
    if (market) globallyFilteredData = globallyFilteredData.filter(i => i.market === market);
    if (merchandiser) globallyFilteredData = globallyFilteredData.filter(i => i.merchandiser === merchandiser);
    if (salesRep) globallyFilteredData = globallyFilteredData.filter(i => i.salesRep === salesRep);
  }

  const salesOnly = globallyFilteredData.filter(item =>
    item.invoiceNumber?.trim().toUpperCase().startsWith('SAL')
  );

  const targetMonth = selectedMonth ? parseInt(selectedMonth) : null;
  const today = new Date();

  const processDataForType = (type: 'main' | 'sub') => {
    const mapPrev = new Map<string, { mainName: string; subName: string; amount: number }>();
    const mapCurr = new Map<string, { mainName: string; subName: string; amount: number }>();

    for (let i = 0; i < salesOnly.length; i++) {
      const item = salesOnly[i];
      if (!item.invoiceDate) continue;

      const d = new Date(item.invoiceDate);
      if (isNaN(d.getTime())) continue;

      const year = d.getFullYear();
      const month = d.getMonth() + 1;

      if (targetMonth && month !== targetMonth) continue;
      if (year === currentYear && d > today) continue; 

      const key = type === 'sub'
        ? (item.customerId?.trim() || item.customerName?.trim())
        : (item.customerMainName?.trim() || item.customerName?.trim());

      if (!key) continue;

      const mainName = item.customerMainName?.trim() || item.customerName?.trim() || '';
      const subName = item.customerName?.trim() || '';

      if (year === prevYear) {
        const existing = mapPrev.get(key) || { mainName, subName, amount: 0 };
        existing.amount += Number(item.amount) || 0;
        mapPrev.set(key, existing);
      } else if (year === currentYear) {
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
    subComparison: processDataForType('sub') 
  };
}

// -------------------------------------------------------------
// 5. My Customers (Mappings)
// -------------------------------------------------------------
export async function getMyCustomersData(userId: string) {
  await migrateLegacyMappingRowIds();
  await migrateLegacyMerchandiserNames();

  const filteredMappings = await getMappingServer(userId);
  const rawMappings = Array.from(filteredMappings.values()).map((m) => ({
    ID: m.id,
    'CUSTOMER ID': m.customerId,
    'SALES_REP': m.userId,
    'MERCHANDISER': m.merchandiserId,
    'AREA': m.area,
    'MARKET': m.market,
  }));

  const { data: customers, error: custError } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"');
  if (custError) throw custError;

  const custMap = new Map<string, { mainName: string; subName: string }>();
  if (customers) {
    customers.forEach((c) => {
      const cId = String(c['CUSTOMER ID']).trim().toUpperCase();
      custMap.set(cId, {
        mainName: c['CUSTOMER MAIN NAME'] || '',
        subName: c['CUSTOMER SUB NAME'] || '',
      });
    });
  }

  const { data: users, error: userError } = await bhs_supabas
    .from('bhs_USERS')
    .select('ID, NAME');
  if (userError) throw userError;

  const userMap = new Map<string, string>();
  if (users) {
    users.forEach((u) => userMap.set(u.ID, u.NAME));
  }

  const enrichedData = (rawMappings || []).map((m: any) => {
    const cId = String(m['CUSTOMER ID']).trim().toUpperCase();
    const cInfo = custMap.get(cId);
    return {
      ID: m.ID,
      'CUSTOMER ID': m['CUSTOMER ID'],
      'USER_ID': m['SALES_REP'],
      'MERCHANDISER_ID': m['MERCHANDISER'],
      'CUSTOMER MAIN NAME': cInfo?.mainName || '',
      'CUSTOMER SUB NAME': cInfo?.subName || '',
      'AREA': m['AREA'] || '',
      'MARKET': m['MARKET'] || '',
      'SALES_REP': userMap.get(m['SALES_REP']) || '',
      'MERCHANDISER': userMap.get(m['MERCHANDISER']) || '',
    };
  });

  enrichedData.sort((a, b) => a['CUSTOMER MAIN NAME'].localeCompare(b['CUSTOMER MAIN NAME']));
  return enrichedData;
}

export async function saveCustomerMapping(userId: string, mapping: any) {
  const isManager = await checkIsManager(userId);
  if (!isManager) {
    throw new Error('Unauthorized. Only sales managers can modify assignments.');
  }

  const customerId = await normalizeMappingCustomerId(mapping.customerId);
  const { userMapById, userMapByName } = await loadUserMaps();
  const salesRepId = resolveSalesRepUserId(mapping.salesRepId || '', userMapById, userMapByName);
  const merchandiserId = resolveMerchandiserUserId(
    mapping.merchandiserId || mapping.merchandiser || '',
    userMapById,
    userMapByName
  );

  const { data: existing } = await bhs_supabas
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .select('ID')
    .eq('CUSTOMER ID', customerId)
    .maybeSingle();

  if (existing) {
    const { error } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .update({
        SALES_REP: salesRepId,
        AREA: mapping.area || '',
        MARKET: mapping.market || '',
        MERCHANDISER: merchandiserId,
      })
      .eq('CUSTOMER ID', customerId);
    if (error) throw error;
  } else {
    const { error } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .insert({
        ID: customerId,
        SALES_REP: salesRepId,
        'CUSTOMER ID': customerId,
        AREA: mapping.area || '',
        MARKET: mapping.market || '',
        MERCHANDISER: merchandiserId,
      });
    if (error) throw error;
  }

  invalidateMappingCache();
  return { success: true };
}

export async function batchSaveCustomerMapping(userId: string, mapping: Record<string, any>) {
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
    console.error('Error deleting old mappings:', deleteError);
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
      console.error('Error inserting mapping chunk:', insertError);
      throw insertError;
    }
  }

  invalidateMappingCache();

  return { success: true, message: `Uploaded ${rows.length} mappings successfully` };
}

export async function deleteCustomerMapping(userId: string, customerId: string) {
  const isManager = await checkIsManager(userId);
  if (!isManager) {
    throw new Error('Unauthorized. Only sales managers can remove assignments.');
  }

  const { error } = await bhs_supabas
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .delete()
    .eq('CUSTOMER ID', customerId);

  if (error) throw error;

  invalidateMappingCache();
  return { success: true };
}

// -------------------------------------------------------------
// 6. Inactive Customers
// -------------------------------------------------------------
export async function getInactiveCustomersData(userId: string, filters: any, days: number | string, minAmount: number | string) {
  const augmentedData = await getFilteredSalesData(userId);

  let globallyFilteredData = augmentedData;
  if (filters) {
    const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters;

    if (invoiceType && invoiceType !== 'all') {
      globallyFilteredData = globallyFilteredData.filter(item => {
        const num = item.invoiceNumber?.trim().toUpperCase() || '';
        if (invoiceType === 'sales') return num.startsWith('SAL');
        if (invoiceType === 'returns') return num.startsWith('RSAL');
        return true;
      });
    }
    if (productTag) globallyFilteredData = globallyFilteredData.filter(i => i.productTag === productTag);
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
