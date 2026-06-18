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
  const userMapByName = new Map<string, string>();
  if (!userErr && users) {
    users.forEach(u => {
      userMap.set(u.ID, u.NAME);
      userMapByName.set(String(u.NAME || '').trim().toUpperCase(), u.ID);
    });
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
      const rawRep = String(m['SALES_REP'] || '').trim();
      const repId = userMap.has(rawRep)
        ? rawRep
        : (userMapByName.get(rawRep.toUpperCase()) || rawRep);

      mappingMap.set(cId, {
        id: m.ID,
        customerId: m['CUSTOMER ID'],
        userId: repId,
        salesRep: userMap.get(repId) || (userMapByName.has(rawRep.toUpperCase()) ? rawRep : ''),
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

type SalesUserContext = {
  cleanUserId: string;
  cleanUserName: string;
  isManager: boolean;
};

function isManagerUser(user: { NAME?: string; ROLE?: string; IS_SALESMANAGER?: boolean | string } | null | undefined): boolean {
  if (!user) return false;
  return user.NAME === 'MED Sabry'
    || user.ROLE?.toLowerCase() === 'admin'
    || user.IS_SALESMANAGER === true
    || user.IS_SALESMANAGER === 'TRUE';
}

/** Match mapping to user by ID or legacy name stored in SALES_REP. */
function isMappingAssignedToUser(
  mapping: { userId?: string; salesRep?: string } | undefined,
  cleanUserId: string,
  cleanUserName: string
): boolean {
  if (!mapping) return false;

  const repValue = String(mapping.userId || '').trim().toUpperCase();
  if (!repValue) return false;
  if (repValue === cleanUserId) return true;
  if (cleanUserName && repValue === cleanUserName) return true;
  if (cleanUserName && String(mapping.salesRep || '').trim().toUpperCase() === cleanUserName) return true;

  return false;
}

async function resolveSalesUserContext(userId: string): Promise<SalesUserContext | null> {
  const cleanUserId = String(userId || '').trim().toUpperCase();
  if (!cleanUserId) return null;

  const { data: user } = await bhs_supabas
    .from('bhs_USERS')
    .select('NAME, ROLE, IS_SALESMANAGER')
    .eq('ID', cleanUserId)
    .maybeSingle();

  if (!user) return null;

  return {
    cleanUserId,
    cleanUserName: String(user.NAME || '').trim().toUpperCase(),
    isManager: isManagerUser(user),
  };
}

/**
 * Returns mappings filtered by user permissions.
 * Manager sees all, representatives see only their assignments.
 */
export async function getMappingServer(userId: string): Promise<Map<string, any>> {
  const allMappings = await getGlobalMappings();
  const userContext = await resolveSalesUserContext(userId);

  if (!userContext) {
    return new Map();
  }

  if (userContext.isManager) {
    return allMappings;
  }

  const filtered = new Map<string, any>();
  allMappings.forEach((val, key) => {
    if (isMappingAssignedToUser(val, userContext.cleanUserId, userContext.cleanUserName)) {
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
  const userContext = await resolveSalesUserContext(userId);
  if (!userContext) {
    return [];
  }

  const rawSales = await getSalesDataServer();
  const allMappings = await getGlobalMappings();
  const { cleanUserId, cleanUserName, isManager } = userContext;

  const processed: any[] = [];
  rawSales.forEach((item: any) => {
    const cId = String(item.customerId || '').trim().toUpperCase();
    const mapping = allMappings.get(cId);

    const isAssigned = isMappingAssignedToUser(mapping, cleanUserId, cleanUserName);

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

/** Internal helper to check manager rights */
async function checkIsManager(userId: string): Promise<boolean> {
  const userContext = await resolveSalesUserContext(userId);
  return userContext?.isManager ?? false;
}

export { checkIsManager, isMappingAssignedToUser, resolveSalesUserContext };
