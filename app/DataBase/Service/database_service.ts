'use server';

import { bhs_supabas, bhs_supabase } from '@/lib/supabase';
import { buildAndSaveCache, invalidateMemoryCache } from '@/app/Sales/Utils/SalesCache';
import { invalidateMappingCache } from '@/app/Sales/Utils/SalesMappingCache';

// ------------------------------------------------------------------------------------------------
// PERSONNEL ACTIONS
// ------------------------------------------------------------------------------------------------

export async function fetchPersonnel() {
  try {
    const { data, error } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .select('*')
      .order('ID', { ascending: true });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Error fetching personnel:', error);
    return { success: false, error: error.message };
  }
}

export async function addPersonnel(name: string, roleType: string, isActive: boolean, supervisorId?: string) {
  try {
    if (!name || !roleType) {
      throw new Error('Name and Role Type are required');
    }

    const { data: lastRecord, error: maxError } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError) throw maxError;

    let newId = 'R-0001';
    if (lastRecord && lastRecord.ID) {
      const match = lastRecord.ID.match(/^R-(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        newId = `R-${nextNum.toString().padStart(4, '0')}`;
      }
    }

    const { error: insertError } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .insert({
        ID: newId,
        NAME: name,
        ROLE_TYPE: roleType,
        IS_ACTIVE: isActive !== undefined ? isActive : true,
        SUPERVISOR_ID: roleType === 'merchandiser' ? (supervisorId || null) : null
      });

    if (insertError) throw insertError;

    return { success: true, message: 'Personnel added successfully', newId };
  } catch (error: any) {
    console.error('Error adding personnel:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePersonnel(id: string, name: string, roleType: string, isActive: boolean, supervisorId?: string) {
  try {
    if (!id || !name || !roleType) {
      throw new Error('ID, Name, and Role Type are required');
    }

    const { error } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .update({
        NAME: name,
        ROLE_TYPE: roleType,
        IS_ACTIVE: isActive,
        SUPERVISOR_ID: roleType === 'merchandiser' ? (supervisorId || null) : null
      })
      .eq('ID', id);

    if (error) throw error;

    return { success: true, message: 'Personnel updated successfully' };
  } catch (error: any) {
    console.error('Error updating personnel:', error);
    return { success: false, error: error.message };
  }
}

export async function deletePersonnel(id: string) {
  try {
    if (!id) throw new Error('ID is required');

    const { error } = await bhs_supabas
      .from('web_Sales_DB_PERSONNEL')
      .delete()
      .eq('ID', id);

    if (error) throw error;

    return { success: true, message: 'Personnel deleted successfully' };
  } catch (error: any) {
    console.error('Error deleting personnel:', error);
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------------------------------------------
// CUSTOMER MERGE ACTIONS
// ------------------------------------------------------------------------------------------------

const CUSTOMER_ID_TABLES = [
  { table: 'web_Sales_DB', column: 'CUSTOMER ID' },
  { table: 'web_Sales_DB_INACTIVECUSTOMERS', column: 'CUSTOMER ID' },
  { table: 'web_Sales_DB_CUSTOMERSMAPPING', column: 'CUSTOMER ID' },
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
  { table: 'web_INVENTORY_MOVES', column: 'PRODUCT ID' },
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
  try {
    const survivorProductId = normalizeId(body.survivorProductId);
    const sourceProductIds = (body.sourceProductIds || []).map(normalizeId).filter(Boolean);
    const targetName = String(body.targetName ?? '').trim();
    const targetBarcode = String(body.targetBarcode ?? '').trim();
    const targetCategory = String(body.targetCategory ?? '').trim();
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

// ------------------------------------------------------------------------------------------------
// EMAILS ACTIONS (debit_EMILS)
// ------------------------------------------------------------------------------------------------

export async function fetchNormalEmails() {
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
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format');
    }

    // Validation: Ensure all CUSTOMER IDs exist in bhs_CUSTOMERS
    const { data: customersData, error: customersError } = await bhs_supabase.from('bhs_CUSTOMERS').select('"CUSTOMER ID"');
    if (customersError) {
      throw new Error('Failed to fetch customers for validation: ' + customersError.message);
    }

    const validCustomerIds = new Set(customersData.map((c: any) => c['CUSTOMER ID']?.toString().trim()));
    const invalidIds = new Set<string>();

    data.forEach((row: any) => {
      const custId = row['CUSTOMER ID']?.toString().trim();
      if (custId && !validCustomerIds.has(custId)) {
        invalidIds.add(custId);
      }
    });

    if (invalidIds.size > 0) {
      const invalidList = Array.from(invalidIds).join(', ');
      return { 
        success: false, 
        error: 'Upload stopped! Some Customer IDs do not exist in the Customers database.', 
        details: `Invalid IDs: ${invalidList}` 
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
          ID: newId
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

export async function fetchUsersList() {
  try {
    const { data: dbUsers, error } = await bhs_supabase
      .from('bhs_USERS')
      .select('ID, NAME, ROLE, AUTHORITY, IS_SALESMANAGER')
      .order('NAME');

    if (error) throw error;

    const parseBool = (val: any) => val === true || val === 'TRUE' || val === 'true' || val === 1;

    const userNames = dbUsers.map((u: any) => ({
      id: u.ID,
      name: u.NAME,
      role: u.AUTHORITY || '',
      userAdmin: u.ROLE,
      isSalesManager: parseBool(u.IS_SALESMANAGER)
    }));

    return { success: true, users: userNames };
  } catch (error: any) {
    console.error('Service Error:', error);
    return { success: false, error: 'Failed to fetch users' };
  }
}

export async function updateUserRole(name: string, role: string) {
  try {
    if (!name || role === undefined) {
      return { success: false, error: 'Name and role are required' };
    }

    const { error } = await bhs_supabase
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

export async function verifyUserCredentials(name: string, password?: string) {
  try {
    if (!name || !password) {
      return { success: false, error: 'Name and password are required' };
    }

    const { data: user, error } = await bhs_supabase
      .from('bhs_USERS')
      .select('ID, NAME, ROLE, AUTHORITY, IS_SALESMANAGER')
      .eq('NAME', name)
      .eq('PASSWORD', password)
      .maybeSingle();

    if (error) throw error;

    const parseBool = (val: any) => val === true || val === 'TRUE' || val === 'true' || val === 1;

    if (user) {
      return {
        success: true,
        user: {
          id: user.ID,
          name: user.NAME,
          role: user.AUTHORITY || '',
          userAdmin: user.ROLE,
          isSalesManager: parseBool(user.IS_SALESMANAGER)
        }
      };
    } else {
      return { success: false, error: 'Invalid credentials' };
    }
  } catch (error: any) {
    console.error('Service Error:', error);
    return { success: false, error: 'Internal server error' };
  }
}

