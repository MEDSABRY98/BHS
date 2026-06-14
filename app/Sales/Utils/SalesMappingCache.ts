import { bhs_supabas } from '@/lib/supabase';
import { getSalesDataServer } from './SalesCache';

// ─────────────────────────────────────────────────────────────
//  Mapping Cache — Global, memory-level
//  Eliminates the per-request DB hit for customer mapping
//  across ALL Sales API routes (Overview, Products, Customers…)
// ─────────────────────────────────────────────────────────────

let globalMappingCache: Map<string, any> | null = null;

/**
 * Fetches and builds the global customer mappings.
 * Joins mapping rows with user names from bhs_USERS and customer names from bhs_CUSTOMERS in-memory.
 */
export async function getGlobalMappings(): Promise<Map<string, any>> {
  if (globalMappingCache) {
    return globalMappingCache;
  }

  // 1. Fetch mappings
  const { data: mappings, error: mapErr } = await bhs_supabas
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .select('*');

  if (mapErr) {
    console.error('Error fetching mappings:', mapErr);
    return new Map();
  }

  // 2. Fetch users
  const { data: users, error: userErr } = await bhs_supabas
    .from('bhs_USERS')
    .select('ID, NAME');

  const userMap = new Map<string, string>();
  if (!userErr && users) {
    users.forEach(u => userMap.set(u.ID, u.NAME));
  }

  // 3. Fetch customers
  const { data: customers, error: custErr } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"');

  const custMap = new Map<string, { mainName: string; subName: string }>();
  if (!custErr && customers) {
    customers.forEach(c => {
      const cId = String(c['CUSTOMER ID']).trim().toUpperCase();
      custMap.set(cId, {
        mainName: c['CUSTOMER MAIN NAME'] || '',
        subName: c['CUSTOMER SUB NAME'] || '',
      });
    });
  }

  // 4. Merge mapping records
  const mappingMap = new Map<string, any>();
  if (mappings) {
    mappings.forEach((m: any) => {
      const cId = String(m['CUSTOMER ID']).trim().toUpperCase();
      mappingMap.set(cId, {
        id: m.ID,
        customerId: m['CUSTOMER ID'],
        userId: m['SALES_REP'],
        salesRep: userMap.get(m['SALES_REP']) || '',
        area: m['AREA'] || '',
        market: m['MARKET'] || '',
        merchandiser: m['MERCHANDISER'] || '',
        customerMainName: custMap.get(cId)?.mainName || '',
        customerSubName: custMap.get(cId)?.subName || '',
      });
    });
  }

  globalMappingCache = mappingMap;
  console.log(`🗺️ Global mappings cached: ${mappingMap.size} entries`);
  return mappingMap;
}

/**
 * Returns mappings filtered by user permissions.
 * Manager sees all, representatives see only their assignments.
 */
export async function getMappingServer(userId: string): Promise<Map<string, any>> {
  const allMappings = await getGlobalMappings();
  const cleanUserId = String(userId || '').trim().toUpperCase();

  if (cleanUserId === 'ADMIN') {
    return allMappings;
  }

  // Fetch requester info
  const { data: user } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME, ROLE, IS_SALESMANAGER')
    .eq('ID', cleanUserId)
    .maybeSingle();

  const isManager = user?.NAME === 'MED Sabry' || user?.ROLE?.toLowerCase() === 'admin' || user?.IS_SALESMANAGER === true || user?.IS_SALESMANAGER === 'TRUE';

  if (isManager) {
    return allMappings;
  }

  // Filter mappings to user assignments
  const filtered = new Map<string, any>();
  allMappings.forEach((val, key) => {
    if (String(val.userId || '').trim().toUpperCase() === cleanUserId) {
      filtered.set(key, val);
    }
  });

  return filtered;
}

/**
 * Invalidates the global mapping cache.
 */
export function invalidateMappingCache(userId?: string) {
  globalMappingCache = null;
  console.log('🗑️ Global mapping cache invalidated');
}

/**
 * Helper: Apply mapping Map to a single sales item
 */
export function applyMapping(item: any, mappingMap: Map<string, any>): any {
  if (mappingMap.size === 0) return item;
  const cId = String(item.customerId || '').trim().toUpperCase();
  const mapping = mappingMap.get(cId);
  if (!mapping) return item;
  return {
    ...item,
    customerMainName: mapping.customerMainName || item.customerMainName,
    customerName: mapping.customerSubName || item.customerName,
    area: mapping.area || item.area,
    market: mapping.market || item.market,
    merchandiser: mapping.merchandiser || item.merchandiser,
    salesRep: mapping.salesRep || item.salesRep,
    salesRepId: mapping.userId || '',
  };
}

/**
 * Fetch, augment, and filter sales data for a specific user ID.
 * Managers get all data, representatives only see their assigned customers.
 */
export async function getFilteredSalesData(userId: string): Promise<any[]> {
  const rawSales = await getSalesDataServer();
  const allMappings = await getGlobalMappings();
  const cleanUserId = String(userId || '').trim().toUpperCase();

  const isManager = cleanUserId === 'ADMIN' ? true : await checkIsManager(cleanUserId);

  const processed: any[] = [];
  rawSales.forEach((item: any) => {
    const cId = String(item.customerId || '').trim().toUpperCase();
    const mapping = allMappings.get(cId);

    const isAssigned = mapping && String(mapping.userId || '').trim().toUpperCase() === cleanUserId;

    if (isManager || isAssigned) {
      const mappedItem = {
        ...item,
        customerMainName: mapping?.customerMainName || item.customerMainName,
        customerName: mapping?.customerSubName || item.customerName,
        area: mapping?.area || '',
        market: mapping?.market || '',
        merchandiser: mapping?.merchandiser || '',
        salesRep: mapping?.salesRep || '',
        salesRepId: mapping?.userId || '',
      };
      processed.push(mappedItem);
    }
  });

  return processed;
}

/**
 * Internal helper to check manager rights
 */
async function checkIsManager(userId: string): Promise<boolean> {
  const cleanUserId = String(userId || '').trim().toUpperCase();
  const { data: user } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME, ROLE, IS_SALESMANAGER')
    .eq('ID', cleanUserId)
    .maybeSingle();

  if (!user) return false;
  return user.NAME === 'MED Sabry' || user.ROLE?.toLowerCase() === 'admin' || user.IS_SALESMANAGER === true || user.IS_SALESMANAGER === 'TRUE';
}
