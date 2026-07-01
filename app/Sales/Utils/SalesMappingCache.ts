import { bhs_supabas, parseBoolFlag } from '@/lib/supabase';
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

      const rawMerch = String(m['MERCHANDISER'] || '').trim();
      const merchId = userMap.has(rawMerch)
        ? rawMerch
        : (userMapByName.get(rawMerch.toUpperCase()) || rawMerch);

      mappingMap.set(cId, {
        id: m['CUSTOMER ID'] || m.ID,
        customerId: m['CUSTOMER ID'],
        userId: repId,
        salesRep: userMap.get(repId) || (userMapByName.has(rawRep.toUpperCase()) ? rawRep : ''),
        area: m['AREA'] || '',
        market: m['MARKET'] || '',
        merchandiserId: merchId,
        merchandiser: userMap.get(merchId) || (userMapByName.has(rawMerch.toUpperCase()) ? rawMerch : ''),
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
  const userName = String(user.NAME || '').trim().toLowerCase();
  return (
    userName === 'med sabry' ||
    user.ROLE?.toLowerCase() === 'admin' ||
    parseBoolFlag(user.IS_SALESMANAGER)
  );
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
    merchandiserId: mapping.merchandiserId || '',
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
        merchandiserId: mapping?.merchandiserId || '',
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

/** Legacy surrogate keys like R-0001 generated for mapping table rows. */
export function isLegacyMappingRowId(value: string): boolean {
  return /^R-\d+$/i.test(String(value || '').trim());
}

/** Ensures the value is a real CUSTOMER ID from bhs_CUSTOMERS. */
export async function normalizeMappingCustomerId(customerId: string): Promise<string> {
  const id = String(customerId || '').trim();
  if (!id) throw new Error('Customer ID is required');

  const { data, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID"')
    .eq('CUSTOMER ID', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    if (isLegacyMappingRowId(id)) {
      throw new Error(
        'Invalid customer ID: use the actual CUSTOMER ID, not a mapping row ID (R-XXXX).'
      );
    }
    throw new Error(`Customer ID "${id}" was not found.`);
  }

  return String(data['CUSTOMER ID']).trim();
}

/** Resolves a sales rep to their bhs_USERS.ID (supports ID or name). */
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

/** Alias — merchandisers use the same bhs_USERS lookup as sales reps. */
export const resolveMerchandiserUserId = resolveSalesRepUserId;

/** Fuzzy match for legacy free-text merchandiser names (e.g. "Anwar" → "Anwar Mohsen"). */
export function resolveMerchandiserUserIdFuzzy(
  merchandiserIdOrName: string,
  userMapById: Map<string, string>,
  userMapByName: Map<string, string>
): string {
  const resolved = resolveMerchandiserUserId(merchandiserIdOrName, userMapById, userMapByName);
  if (userMapById.has(resolved)) return resolved;

  const upper = String(merchandiserIdOrName || '').trim().toUpperCase();
  if (!upper) return '';

  for (const [name, id] of userMapByName) {
    if (name === upper) return id;
    const firstWord = name.split(/\s+/)[0];
    if (firstWord === upper) return id;
    if (name.startsWith(`${upper} `)) return id;
  }

  for (const [name, id] of userMapByName) {
    if (name.includes(upper)) return id;
  }

  return resolved;
}

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

type MappingRow = {
  ID: string;
  'CUSTOMER ID': string;
  SALES_REP?: string;
  AREA?: string;
  MARKET?: string;
  MERCHANDISER?: string;
};

function pickKeeperRow(group: MappingRow[]): MappingRow {
  const nonLegacy = group.find((r) => !isLegacyMappingRowId(String(r.ID || '')));
  if (nonLegacy) return nonLegacy;
  return [...group].sort((a, b) => String(a.ID).localeCompare(String(b.ID)))[0];
}

function mergeMappingFields(target: MappingRow, source: MappingRow): MappingRow {
  return {
    ...target,
    SALES_REP: target.SALES_REP || source.SALES_REP || '',
    AREA: target.AREA || source.AREA || '',
    MARKET: target.MARKET || source.MARKET || '',
    MERCHANDISER: target.MERCHANDISER || source.MERCHANDISER || '',
  };
}

/** Converts legacy mapping row IDs (R-XXXX) to CUSTOMER ID as primary key. */
export async function migrateLegacyMappingRowIds(): Promise<number> {
  const { data: rows, error } = await bhs_supabas
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .select('ID, "CUSTOMER ID", SALES_REP, AREA, MARKET, MERCHANDISER');

  if (error) throw error;
  if (!rows?.length) return 0;

  let changed = 0;
  const byCustomer = new Map<string, MappingRow[]>();

  for (const row of rows as MappingRow[]) {
    const customerId = String(row['CUSTOMER ID'] || '').trim();
    if (!customerId) continue;
    const group = byCustomer.get(customerId) || [];
    group.push(row);
    byCustomer.set(customerId, group);
  }

  for (const [customerId, group] of byCustomer) {
    if (group.length > 1) {
      let keeper = pickKeeperRow(group);
      for (const row of group) {
        if (row.ID === keeper.ID) continue;
        keeper = mergeMappingFields(keeper, row);
      }

      for (const row of group) {
        if (row.ID === keeper.ID) continue;
        const { error: deleteError } = await bhs_supabas
          .from('web_Sales_DB_CUSTOMERSMAPPING')
          .delete()
          .eq('ID', row.ID);
        if (deleteError) throw deleteError;
        changed += 1;
      }

      const { error: mergeError } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .update({
          SALES_REP: keeper.SALES_REP || '',
          AREA: keeper.AREA || '',
          MARKET: keeper.MARKET || '',
          MERCHANDISER: keeper.MERCHANDISER || '',
        })
        .eq('ID', keeper.ID);
      if (mergeError) throw mergeError;
    }

    const { data: current, error: fetchError } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .select('ID')
      .eq('CUSTOMER ID', customerId)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!current) continue;

    if (isLegacyMappingRowId(String(current.ID || '')) && current.ID !== customerId) {
      const { error: updateError } = await bhs_supabas
        .from('web_Sales_DB_CUSTOMERSMAPPING')
        .update({ ID: customerId })
        .eq('ID', current.ID);
      if (updateError) throw updateError;
      changed += 1;
    }
  }

  if (changed > 0) {
    invalidateMappingCache();
  }

  return changed;
}

/** Converts legacy free-text MERCHANDISER values to bhs_USERS.ID. */
export async function migrateLegacyMerchandiserNames(): Promise<number> {
  const { userMapById, userMapByName } = await loadUserMaps();
  const { data: rows, error } = await bhs_supabas
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .select('ID, MERCHANDISER')
    .not('MERCHANDISER', 'is', null);

  if (error) throw error;
  if (!rows?.length) return 0;

  let updated = 0;
  for (const row of rows) {
    const raw = String(row.MERCHANDISER || '').trim();
    if (!raw || userMapById.has(raw)) continue;

    const userId = resolveMerchandiserUserIdFuzzy(raw, userMapById, userMapByName);
    if (!userMapById.has(userId) || userId === raw) continue;

    const { error: updateError } = await bhs_supabas
      .from('web_Sales_DB_CUSTOMERSMAPPING')
      .update({ MERCHANDISER: userId })
      .eq('ID', row.ID);

    if (updateError) throw updateError;
    updated += 1;
  }

  if (updated > 0) {
    invalidateMappingCache();
  }

  return updated;
}
