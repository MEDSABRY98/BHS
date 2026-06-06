import { bhs_supabas } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────
//  Mapping Cache — per userId, memory-level, 1-hour TTL
//  Eliminates the per-request DB hit for customer mapping
//  across ALL Sales API routes (Overview, Products, Customers…)
// ─────────────────────────────────────────────────────────────

// { userId → { map: Map<customerId, mapping> } }
const cache = new Map<string, { map: Map<string, any> }>();

/**
 * Returns the customer mapping Map for a given userId.
 * First call fetches from DB; subsequent calls return from memory indefinitely until invalidated.
 */
export async function getMappingServer(userId: string): Promise<Map<string, any>> {
  const cached = cache.get(userId);

  if (cached) {
    return cached.map;
  }

  // Fetch from DB
  const { data, error } = await bhs_supabas
    .from('web_Sales_DB_CUSTOMERSMAPPING')
    .select('*')
    .eq('USER_ID', userId);

  const mappingMap = new Map<string, any>();
  if (!error && data) {
    data.forEach((m: any) => mappingMap.set(m['CUSTOMER ID'], m));
  }

  cache.set(userId, { map: mappingMap });
  console.log(`🗺️ Mapping cached for "${userId}": ${mappingMap.size} entries`);

  return mappingMap;
}

/**
 * Invalidates the mapping cache for a user.
 * Call this after uploading a new mapping file.
 */
export function invalidateMappingCache(userId: string) {
  cache.delete(userId);
  console.log(`🗑️ Mapping cache cleared for "${userId}"`);
}

/**
 * Helper: Apply mapping Map to a single sales item
 */
export function applyMapping(item: any, mappingMap: Map<string, any>): any {
  if (mappingMap.size === 0) return item;
  const mapping = mappingMap.get(item.customerId);
  if (!mapping) return item;
  return {
    ...item,
    customerMainName: mapping['CUSTOMER MAIN NAME'] || item.customerMainName,
    customerName:     mapping['CUSTOMER SUB NAME']  || item.customerName,
    area:             mapping['AREA']               || item.area,
    market:           mapping['MARKET']             || item.market,
    merchandiser:     mapping['MERCHANDISER']        || item.merchandiser,
    salesRep:         mapping['SALES_REP']           || item.salesRep,
  };
}
