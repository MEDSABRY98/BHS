import { bhs_supabas, hasSalesDataAccessFromDb, parseBoolFlag } from '@/lib/supabase';
import { getSalesDataServer } from '@/app/Sales/Utils/SalesCache';

let globalMappingCache: Map<string, any> | null = null;
let cachedUsersList: { id: string; name: string }[] | null = null;
let globalCustomerTagCache: Map<string, string> | null = null;
let globalCustomerClassCache: Map<string, string> | null = null;

export async function getGlobalMappings(): Promise<Map<string, any>> {
  if (globalMappingCache) return globalMappingCache;

  const { data: users, error: userErr } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
  const userMap = new Map<string, string>();
  const userMapByName = new Map<string, string>();
  if (!userErr && users) {
    users.forEach(u => {
      userMap.set(u.ID, u.NAME);
      userMapByName.set(String(u.NAME || '').trim().toUpperCase(), u.ID);
    });
    cachedUsersList = users
      .map(u => ({ id: u.ID, name: u.NAME }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } else {
    cachedUsersList = [];
  }

  const { data: customers, error: custErr } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME", "CUSTOMER CITY", "CUSTOMER TAG", "CUSTOMER CLASS", "SALES_REP", "MARKET", "MERCHANDISER"');

  const mappingMap = new Map<string, any>();
  const tagMap = new Map<string, string>();
  const classMap = new Map<string, string>();

  if (!custErr && customers) {
    customers.forEach(c => {
      const cId = String(c['CUSTOMER ID']).trim().toUpperCase();
      const tag = String(c['CUSTOMER TAG'] || '').trim();
      const customerClass = String(c['CUSTOMER CLASS'] || '').trim();
      if (tag) tagMap.set(cId, tag);
      if (customerClass) classMap.set(cId, customerClass);

      const rawRep = String(c['SALES_REP'] || '').trim();
      const repId = userMap.has(rawRep) ? rawRep : (userMapByName.get(rawRep.toUpperCase()) || rawRep);
      const rawMerch = String(c['MERCHANDISER'] || '').trim();
      const merchId = userMap.has(rawMerch) ? rawMerch : (userMapByName.get(rawMerch.toUpperCase()) || rawMerch);

      mappingMap.set(cId, {
        id: c['CUSTOMER ID'],
        customerId: c['CUSTOMER ID'],
        userId: repId,
        salesRep: userMap.get(repId) || (userMapByName.has(rawRep.toUpperCase()) ? rawRep : ''),
        area: String(c['CUSTOMER CITY'] || '').trim(),
        market: String(c['MARKET'] || '').trim(),
        merchandiserId: merchId,
        merchandiser: userMap.get(merchId) || (userMapByName.has(rawMerch.toUpperCase()) ? rawMerch : ''),
        customerMainName: c['CUSTOMER MAIN NAME'] || '',
        customerSubName: c['CUSTOMER SUB NAME'] || '',
        customerTag: tag,
        customerClass: customerClass,
      });
    });
  }

  globalCustomerTagCache = tagMap;
  globalCustomerClassCache = classMap;
  globalMappingCache = mappingMap;
  console.log(`🗺️ Global mappings cached: ${mappingMap.size} entries`);
  return mappingMap;
}

type SalesUserContext = {
  cleanUserId: string;
  cleanUserName: string;
  hasSalesDataAccess: boolean;
};

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
    .select('NAME, ROLE, SALES_DATA_ACCESS')
    .eq('ID', cleanUserId)
    .maybeSingle();

  if (!user) return null;

  return {
    cleanUserId,
    cleanUserName: String(user.NAME || '').trim().toUpperCase(),
    hasSalesDataAccess: hasSalesDataAccessFromDb(user),
  };
}

export async function getMappingServer(userId: string): Promise<Map<string, any>> {
  const allMappings = await getGlobalMappings();
  const userContext = await resolveSalesUserContext(userId);

  if (!userContext) return new Map();
  if (userContext.hasSalesDataAccess) return allMappings;

  const filtered = new Map<string, any>();
  allMappings.forEach((val, key) => {
    if (isMappingAssignedToUser(val, userContext.cleanUserId, userContext.cleanUserName)) {
      filtered.set(key, val);
    }
  });

  return filtered;
}

export function invalidateMappingCache(userId?: string) {
  globalMappingCache = null;
  cachedUsersList = null;
  globalCustomerTagCache = null;
  globalCustomerClassCache = null;
  console.log('🗑️ Global mapping cache invalidated');
}

export async function getCachedUsersList(): Promise<{ id: string; name: string }[]> {
  await getGlobalMappings();
  return cachedUsersList || [];
}

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
    merchandiserId: mapping.merchandiserId || '',
    salesRep: mapping.salesRep || item.salesRep,
    salesRepId: mapping.userId || '',
    customerTag: mapping.customerTag || globalCustomerTagCache?.get(cId) || item.customerTag || '',
    customerClass: mapping.customerClass || globalCustomerClassCache?.get(cId) || item.customerClass || '',
  };
}

export async function getFilteredSalesData(userId: string): Promise<any[]> {
  const userContext = await resolveSalesUserContext(userId);
  if (!userContext) return [];

  const rawSales = await getSalesDataServer();
  const allMappings = await getGlobalMappings();
  const { cleanUserId, cleanUserName, hasSalesDataAccess } = userContext;

  const processed: any[] = [];
  rawSales.forEach((item: any) => {
    const cId = String(item.customerId || '').trim().toUpperCase();
    const mapping = allMappings.get(cId);

    const isAssigned = isMappingAssignedToUser(mapping, cleanUserId, cleanUserName);

    if (hasSalesDataAccess || isAssigned) {
      processed.push({
        ...item,
        customerMainName: mapping?.customerMainName || item.customerMainName,
        customerName: mapping?.customerSubName || item.customerName,
        area: mapping?.area || '',
        market: mapping?.market || '',
        merchandiser: mapping?.merchandiser || '',
        merchandiserId: mapping?.merchandiserId || '',
        salesRep: mapping?.salesRep || '',
        salesRepId: mapping?.userId || '',
        customerTag: mapping?.customerTag || globalCustomerTagCache?.get(cId) || item.customerTag || '',
        customerClass: mapping?.customerClass || globalCustomerClassCache?.get(cId) || item.customerClass || '',
      });
    }
  });

  return processed;
}

async function checkHasSalesDataAccess(userId: string): Promise<boolean> {
  const userContext = await resolveSalesUserContext(userId);
  return userContext?.hasSalesDataAccess ?? false;
}

export { checkHasSalesDataAccess, isMappingAssignedToUser, resolveSalesUserContext };

export function isLegacyMappingRowId(value: string): boolean {
  return /^R-\d+$/i.test(String(value || '').trim());
}

export async function normalizeMappingCustomerId(customerId: string): Promise<string> {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Customer ID is required');

  const { data, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID"')
    .eq('CUSTOMER ID', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Customer ID "${id}" was not found.`);

  return String(data['CUSTOMER ID']).trim();
}

export function resolveSalesRepUserId(
  salesRepIdOrName: string,
  userMapById: Map<string, string>,
  userMapByName: Map<string, string>
): string {
  const raw = String(salesRepIdOrName || '').trim();
  if (!raw) return '';
  if (userMapById.has(raw)) return raw;
  return userMapByName.get(raw.toUpperCase()) || raw;
}

export const resolveMerchandiserUserId = resolveSalesRepUserId;

export async function loadUserMaps() {
  const { data: users, error } = await bhs_supabas.from('bhs_USERS').select('ID, NAME');
  if (error) throw error;

  const userMapById = new Map<string, string>();
  const userMapByName = new Map<string, string>();
  (users || []).forEach((u) => {
    userMapById.set(u.ID, u.NAME);
    userMapByName.set(String(u.NAME || '').trim().toUpperCase(), u.ID);
  });
  return { userMapById, userMapByName };
}

export async function loadCustomerMaps() {
  const { data: customers, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME", "CUSTOMER CITY"');
  if (error) throw error;

  const custMapById = new Map<string, string>();
  const custMapByName = new Map<string, string>();
  const custCityById = new Map<string, string>();
  
  (customers || []).forEach(c => {
    const id = String(c['CUSTOMER ID'] || '').trim();
    if (!id) return;
    custMapById.set(id.toUpperCase(), id);
    custCityById.set(id.toUpperCase(), String(c['CUSTOMER CITY'] || '').trim());
    
    const mainName = String(c['CUSTOMER MAIN NAME'] || '').trim().toUpperCase();
    if (mainName) custMapByName.set(mainName, id);
    
    const subName = String(c['CUSTOMER SUB NAME'] || '').trim().toUpperCase();
    if (subName) custMapByName.set(subName, id);
  });
  
  return { custMapById, custMapByName, custCityById };
}

export function resolveCustomerId(
  rawIdOrName: string,
  custMapById: Map<string, string>,
  custMapByName: Map<string, string>
): string {
  const raw = String(rawIdOrName || '').trim();
  if (!raw) return '';
  const upperRaw = raw.toUpperCase();
  if (custMapById.has(upperRaw)) return custMapById.get(upperRaw)!;
  if (custMapByName.has(upperRaw)) return custMapByName.get(upperRaw)!;
  return '';
}
