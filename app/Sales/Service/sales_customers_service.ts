'use server';

import { bhs_supabas } from '@/lib/supabase';
import { 
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
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const rpcParams = {
    p_user_id: userId,
    p_active_tab: activeTab || 'sub',
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
  };

  const { data, error } = await bhs_supabas.rpc('get_sales_customers_aggregated', rpcParams);

  if (error) {
    console.error('RPC Error in getCustomersData:', error);
    return [];
  }

  return data || [];
}

// -------------------------------------------------------------
// 2. Customer Details Data
// -------------------------------------------------------------
export async function getCustomerDetailsData(userId: string, filters: any, customerName: string, customerId: string, customerType: string) {
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const targetCustomerId = customerId ? customerId.trim() : '';

  const rpcParams = {
    p_user_id: userId,
    p_customer_name: customerName,
    p_customer_id: targetCustomerId,
    p_customer_type: customerType || 'sub',
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
  };

  const { data, error } = await bhs_supabas.rpc('get_sales_customer_details_raw', rpcParams);

  if (error) {
    console.error('RPC Error in getCustomerDetailsData:', error);
    return { data: [], allData: [] };
  }

  return data || { data: [], allData: [] };
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
  const { invoiceType, area, market, merchandiser, salesRep, productTag } = filters || {};

  const rpcParams = {
    p_user_id: userId,
    p_current_year: currentYear,
    p_prev_year: prevYear,
    p_selected_month: selectedMonth ? parseInt(selectedMonth, 10) : null,
    p_invoice_type: invoiceType || 'all',
    p_area: area || null,
    p_market: market || null,
    p_merchandiser: merchandiser || null,
    p_sales_rep: salesRep || null,
    p_product_tag: productTag || null
  };

  const { data, error } = await bhs_supabas.rpc('get_sales_customers_comparison', rpcParams);

  if (error) {
    console.error('RPC Error in getCustomersComparisonData:', error);
    return { mainComparison: [], subComparison: [] };
  }

  return data || { mainComparison: [], subComparison: [] };
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
  const { invoiceType, year, month, dateFrom, dateTo, area, market, merchandiser, salesRep, productTag } = filters || {};

  const rpcParams = {
    p_user_id: userId,
    p_days: parseInt(String(days)) || 10,
    p_min_amount: parseFloat(String(minAmount)) || 0,
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
  };

  const { data, error } = await bhs_supabas.rpc('get_sales_inactive_customers', rpcParams);

  if (error) {
    console.error('RPC Error in getInactiveCustomersData:', error);
    return [];
  }

  return data || [];
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
