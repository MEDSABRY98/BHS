'use server';

import { bhs_supabas, bhs_supabase } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  clearSession,
  createSession,
  getSessionUser,
  hashPassword,
  requireAdmin,
  requireSession,
  toSessionUser,
  verifyPassword,
} from '@/lib/session';
import { buildAndSaveCache, invalidateMemoryCache } from '@/app/Sales/Cache/SalesCache';
import { invalidateMappingCache } from '@/app/Sales/Cache/SalesMappingCache';

// ------------------------------------------------------------------------------------------------
// CUSTOMER MERGE ACTIONS
// ------------------------------------------------------------------------------------------------

const CUSTOMER_ID_TABLES = [
  { table: 'web_Sales_DB', column: 'CUSTOMER ID' },
  { table: 'web_Sales_DB_INACTIVECUSTOMERS', column: 'CUSTOMER ID' },
  { table: 'mix_DEBIT', column: 'CUSTOMER ID' },
  { table: 'debit_EMILS', column: 'CUSTOMER ID' },
  { table: 'debit_EMILS_LULU', column: 'CUSTOMER ID' },
  { table: 'debit_NOTES', column: 'CUSTOMER ID' },
  { table: 'app_lpos_ORDERS', column: 'CUSTOMER_ID' },
] as const;

type MergeCustomerBody = {
  survivorCustomerId?: string;
  sourceCustomerIds?: string[];
  targetMainName?: string;
  targetSubName?: string;
  targetCity?: string;
};

type CustomerRow = {
  ID: string;
  'CUSTOMER ID': string;
};

function normalizeId(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

async function updateCustomerIdReferences(
  entry: (typeof CUSTOMER_ID_TABLES)[number],
  survivorCustomerId: string,
  sourceCustomerId: string
): Promise<number> {
  const { data, error } = await bhs_supabase
    .from(entry.table)
    .update({ [entry.column]: survivorCustomerId })
    .eq(entry.column, sourceCustomerId)
    .select('ID');

  if (error) throw new Error(`${entry.table}: ${error.message}`);
  return data?.length ?? 0;
}

export async function mergeCustomersAction(body: MergeCustomerBody) {
  await requireSession();
  try {
    const survivorCustomerId = normalizeId(body.survivorCustomerId);
    const sourceCustomerIds = (body.sourceCustomerIds || [])
      .map(normalizeId)
      .filter(Boolean);
    const targetMainName = String(body.targetMainName ?? '').trim();
    const targetSubName = String(body.targetSubName ?? '').trim();
    const targetCity = String(body.targetCity ?? '').trim();

    if (!survivorCustomerId) {
      throw new Error('survivorCustomerId is required');
    }
    if (sourceCustomerIds.length < 1) {
      throw new Error('At least one source customer ID is required');
    }
    if (!targetSubName) {
      throw new Error('targetSubName is required');
    }
    if (sourceCustomerIds.includes(survivorCustomerId)) {
      throw new Error('Source IDs must not include the survivor ID');
    }

    const allCustomerIds = [survivorCustomerId, ...sourceCustomerIds];
    const { data: customerRows, error: fetchError } = await bhs_supabase
      .from('bhs_CUSTOMERS')
      .select('ID, "CUSTOMER ID"')
      .in('CUSTOMER ID', allCustomerIds);

    if (fetchError) throw fetchError;

    const byCustomerId = new Map<string, CustomerRow>();
    (customerRows || []).forEach((row) => {
      const id = normalizeId(row['CUSTOMER ID']);
      if (id) byCustomerId.set(id, row as CustomerRow);
    });

    if (!byCustomerId.has(survivorCustomerId)) {
      throw new Error('Survivor customer not found');
    }

    const missingSources = sourceCustomerIds.filter((id) => !byCustomerId.has(id));
    if (missingSources.length > 0) {
      throw new Error(`Source customer(s) not found: ${missingSources.join(', ')}`);
    }

    const updateSummary: Record<string, number> = {};

    for (const sourceCustomerId of sourceCustomerIds) {
      for (const entry of CUSTOMER_ID_TABLES) {
        const count = await updateCustomerIdReferences(entry, survivorCustomerId, sourceCustomerId);
        updateSummary[entry.table] = (updateSummary[entry.table] || 0) + count;
      }
    }

    const { error: survivorUpdateError } = await bhs_supabase
      .from('bhs_CUSTOMERS')
      .update({
        'CUSTOMER MAIN NAME': targetMainName,
        'CUSTOMER SUB NAME': targetSubName,
        'CUSTOMER CITY': targetCity,
      })
      .eq('CUSTOMER ID', survivorCustomerId);

    if (survivorUpdateError) throw survivorUpdateError;

    const sourceInternalIds = sourceCustomerIds.map((id) => byCustomerId.get(id)!.ID);
    const { error: deleteError } = await bhs_supabase
      .from('bhs_CUSTOMERS')
      .delete()
      .in('ID', sourceInternalIds);

    if (deleteError) throw deleteError;

    invalidateMemoryCache();
    invalidateMappingCache();
    try {
      await buildAndSaveCache();
    } catch (cacheError) {
      console.error('Merge succeeded but sales cache rebuild failed:', cacheError);
    }

    return {
      success: true,
      survivorCustomerId,
      mergedCount: sourceCustomerIds.length,
      updateSummary,
    };
  } catch (error: any) {
    console.error('mergeCustomersAction error:', error);
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------------------------------------------
// PRODUCT MERGE ACTIONS
// ------------------------------------------------------------------------------------------------

const PRODUCT_ID_TABLES = [
  { table: 'web_Sales_DB', column: 'PRODUCT ID' },
  { table: 'web_INVENTORY_SCRAB', column: 'PRODUCT ID' },
  { table: 'mix_INVENTORY_COUNT_DETAILS', column: 'PRODUCT ID' },
  { table: 'mix_INVENTORY_COUNT_TOTALS', column: 'PRODUCT ID' },
  { table: 'web_INVENTORY_SCRAB_REPORT', column: 'PRODUCT_ID' },
] as const;

const REGISTRY_TABLES: string[] = [];

type MergeProductBody = {
  survivorProductId?: string;
  sourceProductIds?: string[];
  targetName?: string;
  targetBarcode?: string;
  targetCategory?: string;
  targetItemCode?: string | number | null;
  targetUnit?: string;
};

type ProductRow = {
  ID: string;
  'PRODUCT ID': string;
};

async function updateProductIdReferences(
  entry: (typeof PRODUCT_ID_TABLES)[number],
  survivorProductId: string,
  sourceProductId: string
): Promise<number> {
  const { data, error } = await bhs_supabase
    .from(entry.table)
    .update({ [entry.column]: survivorProductId })
    .eq(entry.column, sourceProductId)
    .select('ID');

  if (error) throw new Error(`${entry.table}: ${error.message}`);
  return data?.length ?? 0;
}

async function reconcileRegistryTable(
  table: (typeof REGISTRY_TABLES)[number],
  survivorProductId: string,
  sourceProductId: string
): Promise<number> {
  const { data: survivorRow, error: survivorError } = await bhs_supabase
    .from(table)
    .select('ID')
    .eq('PRODUCT ID', survivorProductId)
    .maybeSingle();

  if (survivorError) throw new Error(`${table}: ${survivorError.message}`);

  if (survivorRow) {
    const { data, error } = await bhs_supabase
      .from(table)
      .delete()
      .eq('PRODUCT ID', sourceProductId)
      .select('ID');

    if (error) throw new Error(`${table}: ${error.message}`);
    return data?.length ?? 0;
  }

  const { data, error } = await bhs_supabase
    .from(table)
    .update({ 'PRODUCT ID': survivorProductId })
    .eq('PRODUCT ID', sourceProductId)
    .select('ID');

  if (error) throw new Error(`${table}: ${error.message}`);
  return data?.length ?? 0;
}

export async function mergeProductsAction(body: MergeProductBody) {
  await requireSession();
  try {
    const survivorProductId = normalizeId(body.survivorProductId);
    const sourceProductIds = (body.sourceProductIds || []).map(normalizeId).filter(Boolean);
    const targetName = String(body.targetName ?? '').trim();
    const targetBarcode = String(body.targetBarcode ?? '').trim();
    const targetCategory = String(body.targetCategory ?? '').trim();
    const targetUnit = String(body.targetUnit ?? '').trim();
    const targetItemCodeRaw = body.targetItemCode;
    const targetItemCode =
      targetItemCodeRaw === null || targetItemCodeRaw === undefined || targetItemCodeRaw === ''
        ? null
        : Number(targetItemCodeRaw);

    if (!survivorProductId) {
      throw new Error('survivorProductId is required');
    }
    if (sourceProductIds.length < 1) {
      throw new Error('At least one source product ID is required');
    }
    if (!targetName) {
      throw new Error('targetName is required');
    }
    if (sourceProductIds.includes(survivorProductId)) {
      throw new Error('Source IDs must not include the survivor ID');
    }
    if (targetItemCode !== null && Number.isNaN(targetItemCode)) {
      throw new Error('targetItemCode must be a valid number');
    }

    const allProductIds = [survivorProductId, ...sourceProductIds];
    const { data: productRows, error: fetchError } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .select('ID, "PRODUCT ID"')
      .in('PRODUCT ID', allProductIds);

    if (fetchError) throw fetchError;

    const byProductId = new Map<string, ProductRow>();
    (productRows || []).forEach((row) => {
      const id = normalizeId(row['PRODUCT ID']);
      if (id) byProductId.set(id, row as ProductRow);
    });

    if (!byProductId.has(survivorProductId)) {
      throw new Error('Survivor product not found');
    }

    const missingSources = sourceProductIds.filter((id) => !byProductId.has(id));
    if (missingSources.length > 0) {
      throw new Error(`Source product(s) not found: ${missingSources.join(', ')}`);
    }

    const updateSummary: Record<string, number> = {};

    for (const sourceProductId of sourceProductIds) {
      for (const entry of PRODUCT_ID_TABLES) {
        const count = await updateProductIdReferences(entry, survivorProductId, sourceProductId);
        updateSummary[entry.table] = (updateSummary[entry.table] || 0) + count;
      }

      for (const table of REGISTRY_TABLES) {
        const count = await reconcileRegistryTable(table, survivorProductId, sourceProductId);
        updateSummary[table] = (updateSummary[table] || 0) + count;
      }
    }

    const { error: survivorUpdateError } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .update({
        'PRODUCT NAME': targetName,
        'PRODUCT BARCODE': targetBarcode,
        'PRODUCT CATEGORY': targetCategory,
        'ITEM CODE': targetItemCode,
        'UNIT': targetUnit,
      })
      .eq('PRODUCT ID', survivorProductId);

    if (survivorUpdateError) throw survivorUpdateError;

    const sourceInternalIds = sourceProductIds.map((id) => byProductId.get(id)!.ID);
    const { error: deleteError } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .delete()
      .in('ID', sourceInternalIds);

    if (deleteError) throw deleteError;

    invalidateMemoryCache();
    invalidateMappingCache();
    try {
      await buildAndSaveCache();
    } catch (cacheError) {
      console.error('Product merge succeeded but sales cache rebuild failed:', cacheError);
    }

    return {
      success: true,
      survivorProductId,
      mergedCount: sourceProductIds.length,
      updateSummary,
    };
  } catch (error: any) {
    console.error('mergeProductsAction error:', error);
    return { success: false, error: error.message };
  }
}

export async function updateProductIdCascade(oldId: string, newId: string) {
  await requireSession();
  if (!oldId || !newId || oldId === newId) return { success: true };

  try {
    const oldIdNormalized = normalizeId(oldId);
    const newIdNormalized = normalizeId(newId);

    for (const entry of PRODUCT_ID_TABLES) {
      await updateProductIdReferences(entry, newIdNormalized, oldIdNormalized);
    }

    for (const table of REGISTRY_TABLES) {
      // For simple ID updates, we don't merge/reconcile, we just update.
      await bhs_supabase
        .from(table)
        .update({ 'PRODUCT ID': newIdNormalized })
        .eq('PRODUCT ID', oldIdNormalized);
    }

    invalidateMemoryCache();
    invalidateMappingCache();
    try {
      await buildAndSaveCache();
    } catch (cacheError) {
      console.error('Product ID update succeeded but sales cache rebuild failed:', cacheError);
    }

    return { success: true };
  } catch (error: any) {
    console.error('updateProductIdCascade error:', error);
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------------------------------------------
// EMAILS ACTIONS (debit_EMILS)
// ------------------------------------------------------------------------------------------------

export async function fetchNormalEmails() {
  await requireSession();
  try {
    const { data, error } = await bhs_supabase.from('debit_EMILS').select('*');
    if (error) throw error;

    const { data: customersData } = await bhs_supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID", "CUSTOMER MAIN NAME"');
    const customerMap = new Map();
    if (customersData) {
      customersData.forEach((c: any) => {
        if (c['CUSTOMER ID']) {
          customerMap.set(c['CUSTOMER ID'].toString().trim(), c['CUSTOMER MAIN NAME']);
        }
      });
    }

    const enrichedData = data.map((item: any) => {
      const cid = item['CUSTOMER ID'] ? item['CUSTOMER ID'].toString().trim() : '';
      return {
        ...item,
        'Customer Name': customerMap.get(cid) || item['CUSTOMER ID']
      };
    });

    enrichedData.sort((a, b) => {
      const nameA = (a['Customer Name'] || '').toString();
      const nameB = (b['Customer Name'] || '').toString();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return { success: true, data: enrichedData };
  } catch (error: any) {
    console.error('Error fetching emails:', error);
    return { success: false, error: error.message };
  }
}

export async function addNormalEmail(customerId: string, email: string) {
  await requireSession();
  try {
    const { data, error } = await bhs_supabase.from('debit_EMILS').insert({
      'CUSTOMER ID': customerId,
      'EMAIL_NAME': email
    }).select();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateNormalEmail(id: string, customerId: string, email: string) {
  await requireSession();
  try {
    let query = bhs_supabase.from('debit_EMILS').update({
      'CUSTOMER ID': customerId,
      'EMAIL_NAME': email
    });
    
    if (id) {
      query = query.eq('ID', id);
    } else {
      query = query.eq('CUSTOMER ID', customerId); // Fallback
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteNormalEmail(id: string | null, customerId: string | null) {
  await requireSession();
  try {
    let query = bhs_supabase.from('debit_EMILS').delete();
    if (id) {
      query = query.eq('ID', id);
    } else if (customerId) {
      query = query.eq('CUSTOMER ID', customerId);
    } else {
      throw new Error('ID or CUSTOMER ID is required to delete');
    }

    const { error } = await query;
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------------------------------------------
// LULU EMAILS ACTIONS (debit_EMILS_LULU)
// ------------------------------------------------------------------------------------------------

export async function fetchLuluEmails() {
  await requireSession();
  try {
    const { data, error } = await bhs_supabase.from('debit_EMILS_LULU').select('*');
    if (error) throw error;

    const { data: customersData } = await bhs_supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID", "CUSTOMER MAIN NAME"');
    const customerMap = new Map();
    if (customersData) {
      customersData.forEach((c: any) => {
        if (c['CUSTOMER ID']) {
          customerMap.set(c['CUSTOMER ID'].toString().trim(), c['CUSTOMER MAIN NAME']);
        }
      });
    }

    const enrichedData = data.map((item: any) => {
      const cid = item['CUSTOMER ID'] ? item['CUSTOMER ID'].toString().trim() : '';
      return {
        ...item,
        'Customer Name': customerMap.get(cid) || item['CUSTOMER ID']
      };
    });

    enrichedData.sort((a, b) => {
      const nameA = (a['Customer Name'] || '').toString();
      const nameB = (b['Customer Name'] || '').toString();
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return { success: true, data: enrichedData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addLuluEmail(customerId: string, customerCode: string, to: string, cc: string) {
  await requireSession();
  try {
    const { data, error } = await bhs_supabase.from('debit_EMILS_LULU').insert({
      'CUSTOMER ID': customerId,
      'CUSTOMER CODE': customerCode,
      'TO:': to,
      'CC:': cc
    }).select();
    
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateLuluEmail(id: string, customerId: string, customerCode: string, to: string, cc: string) {
  await requireSession();
  try {
    let query = bhs_supabase.from('debit_EMILS_LULU').update({
      'CUSTOMER ID': customerId,
      'CUSTOMER CODE': customerCode,
      'TO:': to,
      'CC:': cc
    });
    
    if (id) {
      query = query.eq('ID', id);
    } else {
      query = query.eq('CUSTOMER ID', customerId);
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteLuluEmail(id: string | null, customerId: string | null) {
  await requireSession();
  try {
    let query = bhs_supabase.from('debit_EMILS_LULU').delete();
    if (id) {
      query = query.eq('ID', id);
    } else if (customerId) {
      query = query.eq('CUSTOMER ID', customerId);
    } else {
      throw new Error('ID or CUSTOMER ID is required to delete');
    }

    const { error } = await query;
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------------------------------------------
// DEBIT DATABASE ACTIONS (mix_DEBIT bulk operations)
// ------------------------------------------------------------------------------------------------

export async function deleteDebitData() {
  await requireSession();
  try {
    const { error } = await bhs_supabase.from('mix_DEBIT').delete().neq('ID', 0); // Delete all rows
    if (error) throw error;
    
    return { success: true, message: 'All data deleted successfully.' };
  } catch (error: any) {
    console.error('Delete Error:', error);
    return { success: false, error: error.message };
  }
}

export async function uploadDebitData(payload: any[] | string) {
  await requireSession();
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format');
    }

    // Validation: Ensure all CUSTOMER IDs exist in bhs_CUSTOMERS, or map names to IDs
    const pageSize = 1000;
    let from = 0;
    const customersData: { 'CUSTOMER ID': string, 'CUSTOMER MAIN NAME': string }[] = [];

    while (true) {
      const { data, error } = await bhs_supabase
        .from('bhs_CUSTOMERS')
        .select('"CUSTOMER ID", "CUSTOMER MAIN NAME"')
        .range(from, from + pageSize - 1);
        
      if (error) {
        throw new Error('Failed to fetch customers for validation: ' + error.message);
      }
      
      if (!data || data.length === 0) break;
      customersData.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    const validCustomerIdsMap = new Map<string, string>();
    const nameToIdMap = new Map<string, string>();
    customersData.forEach((c: any) => {
        const id = c['CUSTOMER ID']?.toString().trim();
        const name = c['CUSTOMER MAIN NAME']?.toString().trim();
        if (id) {
            validCustomerIdsMap.set(id.toLowerCase(), id);
            if (name) {
                nameToIdMap.set(name.toLowerCase(), id);
            }
        }
    });

    const invalidEntries = new Set<string>();

    data.forEach((row: any) => {
      const custId = row['CUSTOMER ID']?.toString().trim();
      const custName = row['CUSTOMER NAME']?.toString().trim();

      if (custName) {
          const lowerCustName = custName.toLowerCase();
          if (validCustomerIdsMap.has(lowerCustName)) {
              row['CUSTOMER ID'] = validCustomerIdsMap.get(lowerCustName);
              delete row['CUSTOMER NAME'];
          } else {
              const matchedId = nameToIdMap.get(lowerCustName);
              if (matchedId) {
                  row['CUSTOMER ID'] = matchedId;
                  delete row['CUSTOMER NAME'];
              } else {
                  invalidEntries.add(custName);
              }
          }
      } else if (custId) {
          const lowerCustId = custId.toLowerCase();
          if (validCustomerIdsMap.has(lowerCustId)) {
              row['CUSTOMER ID'] = validCustomerIdsMap.get(lowerCustId);
          } else if (nameToIdMap.has(lowerCustId)) {
              row['CUSTOMER ID'] = nameToIdMap.get(lowerCustId);
          } else {
              invalidEntries.add(custId);
          }
      }
    });

    if (invalidEntries.size > 0) {
      const invalidList = Array.from(invalidEntries).join('\n');
      return { 
        success: false, 
        error: 'Upload stopped! Some Customer Names/IDs do not exist in the Customers database.', 
        details: `Invalid Entries:\n${invalidList}` 
      };
    }

    // Fetch all existing IDs to find the true numeric max
    const { data: allIds } = await bhs_supabase.from('mix_DEBIT').select('ID');
    let currentMaxId = 0;
    if (allIds && allIds.length > 0) {
      allIds.forEach(row => {
        const match = row.ID?.match(/R-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > currentMaxId) currentMaxId = num;
        }
      });
    }

    const uploadTimestamp = new Date().toISOString();

    // Upsert or Insert data
    const chunkSize = 1000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize).map((row: any) => {
        const { ID, id, ...rest } = row;
        currentMaxId += 1;
        // Pad with zeros to ensure 4 digits minimum (e.g., R-0001)
        const newId = `R-${currentMaxId.toString().padStart(4, '0')}`;
        return {
          ...rest,
          ID: newId,
          CREATED_AT: uploadTimestamp
        };
      });
      const { error } = await bhs_supabase.from('mix_DEBIT').insert(chunk);
      if (error) throw error;
    }

    return { success: true, message: `${data.length} rows inserted successfully.` };
  } catch (error: any) {
    console.error('Insert Error:', error);
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------------------------------------------
// USERS ACTIONS (bhs_USERS)
// ------------------------------------------------------------------------------------------------
// All user/auth actions run with the server-only key (getSupabaseAdmin) and
// identify the caller from the signed session cookie (lib/session.ts).
// Passwords are never returned to the browser.

const USER_PUBLIC_FIELDS = 'ID, NAME, ROLE, AUTHORITY, SALES_DATA_ACCESS';

function stripPassword<T extends Record<string, any>>(row: T): Omit<T, 'PASSWORD'> {
  if (!row) return row;
  const { PASSWORD: _omit, ...rest } = row as any;
  return rest;
}

export async function fetchUsersList() {
  await requireAdmin();
  try {
    const { data: dbUsers, error } = await getSupabaseAdmin()
      .from('bhs_USERS')
      .select(USER_PUBLIC_FIELDS)
      .order('NAME');

    if (error) throw error;
    return { success: true, users: (dbUsers || []).map(toSessionUser) };
  } catch (error: any) {
    console.error('Service Error:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

/**
 * Returns the logged-in user (fresh from DB). The `name` argument is kept for
 * backwards compatibility but ignored — the session decides who the user is.
 */
export async function fetchUserSession(_name?: string) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'Not logged in' };
    return { success: true, user };
  } catch (error: any) {
    console.error('Service Error:', error);
    return { success: false, error: error.message || 'Failed to fetch user session' };
  }
}

/** Current logged-in user from the session cookie, or null. */
export async function getCurrentUser() {
  try {
    return await getSessionUser();
  } catch (error) {
    console.error('Service Error:', error);
    return null;
  }
}

export async function logoutAction() {
  await clearSession();
  return { success: true };
}

export async function updateUserRole(name: string, role: string) {
  await requireAdmin();
  try {
    if (!name || role === undefined) {
      return { success: false, error: 'Name and role are required' };
    }

    const { error } = await getSupabaseAdmin()
      .from('bhs_USERS')
      .update({ AUTHORITY: role })
      .eq('NAME', name);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    console.error('Service Error:', error);
    return { success: false, error: error.message || 'Failed to update user' };
  }
}

// Passwords live in "bhs_USER_SECRETS" (ID, PASSWORD) — a table the public key
// cannot read. Until the migration SQL has run, the old bhs_USERS.PASSWORD
// column is used as a fallback and moved over on the user's next login.
const SECRETS_TABLE = 'bhs_USER_SECRETS';

// Hashing + moving passwords out of bhs_USERS is OFF by default, because other
// apps (e.g. the Flutter apps) may still check bhs_USERS.PASSWORD as plain text.
// Turn on with env PASSWORD_HASHING=on once every app logs in through this server.
const PASSWORD_HASHING_ENABLED = process.env.PASSWORD_HASHING === 'on';

async function readStoredPassword(userId: string): Promise<{ value: string | null; source: 'secrets' | 'users' | null; secretsAvailable: boolean }> {
  const db = getSupabaseAdmin();
  const { data: secret, error: secretErr } = await db.from(SECRETS_TABLE).select('PASSWORD').eq('ID', userId).maybeSingle();
  const secretsAvailable = !secretErr;
  if (secret?.PASSWORD) return { value: secret.PASSWORD, source: 'secrets', secretsAvailable };

  const { data: legacy } = await db.from('bhs_USERS').select('PASSWORD').eq('ID', userId).maybeSingle();
  if (legacy?.PASSWORD) return { value: legacy.PASSWORD, source: 'users', secretsAvailable };
  return { value: null, source: null, secretsAvailable };
}

async function writePasswordHash(userId: string, hash: string, secretsAvailable?: boolean) {
  const db = getSupabaseAdmin();
  if (!PASSWORD_HASHING_ENABLED) {
    // compatibility mode: keep the value where the other apps expect it
    const { error } = await db.from('bhs_USERS').update({ PASSWORD: hash }).eq('ID', userId);
    if (error) throw new Error(error.message);
    return;
  }
  const useSecrets = secretsAvailable ?? !(await db.from(SECRETS_TABLE).select('ID').limit(1)).error;
  if (useSecrets) {
    const { error } = await db.from(SECRETS_TABLE).upsert({ ID: userId, PASSWORD: hash, UPDATED_AT: new Date().toISOString() });
    if (error) throw new Error(error.message);
    // remove the copy from the readable users table
    await db.from('bhs_USERS').update({ PASSWORD: '' }).eq('ID', userId);
  } else {
    const { error } = await db.from('bhs_USERS').update({ PASSWORD: hash }).eq('ID', userId);
    if (error) throw new Error(error.message);
  }
}

function storableNewPassword(plain: string) {
  return PASSWORD_HASHING_ENABLED ? hashPassword(plain) : plain;
}

export async function verifyUserCredentials(name: string, password?: string) {
  try {
    if (!name || !password) {
      return { success: false, error: 'Name and password are required' };
    }

    const { data: row, error } = await getSupabaseAdmin()
      .from('bhs_USERS')
      .select(USER_PUBLIC_FIELDS)
      .eq('NAME', name)
      .maybeSingle();

    if (error) throw error;
    if (!row) return { success: false, error: 'Invalid credentials' };

    const stored = await readStoredPassword((row as any).ID);
    const check = verifyPassword(password, stored.value);
    if (!check.ok) return { success: false, error: 'Invalid credentials' };

    // Upgrade plain text -> hash, and move it out of bhs_USERS (best effort)
    if (PASSWORD_HASHING_ENABLED && (check.legacy || stored.source === 'users')) {
      try {
        await writePasswordHash((row as any).ID, check.legacy ? hashPassword(password) : String(stored.value), stored.secretsAvailable);
      } catch (e: any) {
        console.warn('Password upgrade failed:', e?.message || e);
      }
    }

    const user = toSessionUser(row);
    await createSession({ id: user.id, name: user.name });
    return { success: true, user };
  } catch (error: any) {
    console.error('Service Error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

// ------------------------------------------------------------------------------------------------
// USERS DB MANAGEMENT (admin only) — used by DataBase/Users
// ------------------------------------------------------------------------------------------------

export async function adminListUsers(search: string = '') {
  await requireAdmin();
  let query = getSupabaseAdmin().from('bhs_USERS').select('*');
  const term = String(search || '').trim().replace(/[%,()]/g, '');
  if (term) query = query.or(`NAME.ilike.%${term}%,ID.ilike.%${term}%`);
  const { data, error } = await query.order('NAME');
  if (error) throw new Error(error.message);
  return (data || []).map(stripPassword);
}

export async function adminSaveUser(
  fields: {
    NAME: string;
    ROLE: string;
    USER_TYPE: string;
    PASSWORD?: string;
    IS_IN_OFFICE: boolean;
    CANCEL_AUTHORITY: boolean;
    CITY: string;
    SALES_DATA_ACCESS: string;
  },
  editingId?: string | null
) {
  await requireAdmin();
  const db = getSupabaseAdmin();
  const { PASSWORD, ...rest } = fields;
  const payload: Record<string, any> = { ...rest };
  const newPassword = String(PASSWORD || '');

  if (editingId) {
    const { data, error } = await db.from('bhs_USERS').update(payload).eq('ID', editingId).select('*').single();
    if (error) throw new Error(error.message);
    if (newPassword) await writePasswordHash(editingId, storableNewPassword(newPassword));
    return stripPassword(data);
  }

  if (!newPassword) throw new Error('Password is required for a new user');

  const { data: maxIdData, error: maxIdError } = await db.from('bhs_USERS_MAX_ID').select('ID').single();
  if (maxIdError && maxIdError.code !== 'PGRST116') throw new Error(maxIdError.message);

  let nextNum = 1;
  const match = String(maxIdData?.ID || '').match(/^R-(\d+)$/i);
  if (match) nextNum = parseInt(match[1], 10) + 1;
  const nextId = `R-${String(nextNum).padStart(4, '0')}`;

  const { data, error } = await db.from('bhs_USERS').insert({ ID: nextId, ...payload, PASSWORD: '' }).select('*').single();
  if (error) throw new Error(error.message);
  await writePasswordHash(nextId, storableNewPassword(newPassword));
  return stripPassword(data);
}

export async function adminDeleteUser(id: string) {
  const admin = await requireAdmin();
  if (String(id) === String(admin.id)) throw new Error('You cannot delete your own account');
  const db = getSupabaseAdmin();
  const { error } = await db.from('bhs_USERS').delete().eq('ID', id);
  if (error) throw new Error(error.message);
  await db.from(SECRETS_TABLE).delete().eq('ID', id); // ignore if table not created yet
  return { success: true };
}

export async function adminGetUserSignature(id: string) {
  await requireAdmin();
  const { data, error } = await getSupabaseAdmin().from('bhs_USERS').select('SIGNATURE').eq('ID', id).single();
  if (error) throw new Error(error.message);
  return (data?.SIGNATURE as string) || null;
}

export async function adminSaveUserSignature(id: string, signatureBase64: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdmin().from('bhs_USERS').update({ SIGNATURE: signatureBase64 }).eq('ID', id);
  if (error) throw new Error(error.message);
  return { success: true };
}
