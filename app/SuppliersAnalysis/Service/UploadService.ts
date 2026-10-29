'use server';
import { requireSession } from '@/lib/session';

import { bhs_supabase } from '@/lib/supabase';

export async function deleteSuppliersTransactionsData() {
  await requireSession();
  try {
    const { error } = await bhs_supabase.from('web_SUPPLIERS_ANALYSIS').delete().neq('ID', 0);
    if (error) throw error;
    
    return { success: true, message: 'All data deleted successfully.' };
  } catch (error: any) {
    console.error('Delete Error:', error);
    return { success: false, error: error.message };
  }
}

export async function uploadSuppliersTransactionsData(payload: any[] | string) {
  await requireSession();
  try {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!data || !Array.isArray(data)) {
      throw new Error('Invalid data format');
    }

    const pageSize = 1000;
    let from = 0;
    const suppliersData: { 'SUPPLIER ID': string, 'SUPPLIER NAME': string }[] = [];

    while (true) {
      const { data: sData, error } = await bhs_supabase
        .from('bhs_SUPPLIERS')
        .select('"SUPPLIER ID", "SUPPLIER NAME"')
        .range(from, from + pageSize - 1);
        
      if (error) {
        throw new Error('Failed to fetch suppliers for validation: ' + error.message);
      }
      
      if (!sData || sData.length === 0) break;
      suppliersData.push(...sData);
      if (sData.length < pageSize) break;
      from += pageSize;
    }

    const validSupplierIdsMap = new Map<string, string>();
    const nameToIdMap = new Map<string, string>();
    suppliersData.forEach((s: any) => {
        const id = s['SUPPLIER ID']?.toString().trim();
        const name = s['SUPPLIER NAME']?.toString().trim();
        if (id) {
            validSupplierIdsMap.set(id.toLowerCase(), id);
            if (name) {
                nameToIdMap.set(name.toLowerCase(), id);
            }
        }
    });

    const invalidEntries = new Set<string>();

    data.forEach((row: any) => {
      const suppId = row['SUPPLIER ID']?.toString().trim();
      const suppName = row['SUPPLIER NAME']?.toString().trim();

      if (suppName) {
          const lowerSuppName = suppName.toLowerCase();
          if (validSupplierIdsMap.has(lowerSuppName)) {
              row['SUPPLIER ID'] = validSupplierIdsMap.get(lowerSuppName);
              delete row['SUPPLIER NAME'];
          } else {
              const matchedId = nameToIdMap.get(lowerSuppName);
              if (matchedId) {
                  row['SUPPLIER ID'] = matchedId;
                  delete row['SUPPLIER NAME'];
              } else {
                  invalidEntries.add(suppName);
              }
          }
      } else if (suppId) {
          const lowerSuppId = suppId.toLowerCase();
          if (validSupplierIdsMap.has(lowerSuppId)) {
              row['SUPPLIER ID'] = validSupplierIdsMap.get(lowerSuppId);
          } else if (nameToIdMap.has(lowerSuppId)) {
              row['SUPPLIER ID'] = nameToIdMap.get(lowerSuppId);
          } else {
              invalidEntries.add(suppId);
          }
      }
    });

    if (invalidEntries.size > 0) {
      const invalidList = Array.from(invalidEntries).join('\n');
      return { 
        success: false, 
        error: 'Upload stopped! Some Supplier Names/IDs do not exist in the Suppliers database.', 
        details: `Invalid Entries:\n${invalidList}` 
      };
    }

    const chunkSize = 1000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize).map((row: any) => {
        const { ID, id, ...rest } = row;
        return rest;
      });
      const { error } = await bhs_supabase.from('web_SUPPLIERS_ANALYSIS').insert(chunk);
      if (error) throw error;
    }

    return { success: true, message: `${data.length} rows inserted successfully.` };
  } catch (error: any) {
    console.error('Insert Error:', error);
    return { success: false, error: error.message };
  }
}


// ------------------------------------------------------------------------------------------------
// UPLOAD IN BATCHES (browser validates the file, then sends small batches — a single big request
// fails with "An unexpected response was received from the server" on large files)
// ------------------------------------------------------------------------------------------------

export async function getSuppliersUploadContext() {
  await requireSession();
  try {
    const pageSize = 1000;
    const suppliers: { id: string; name: string }[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await bhs_supabase
        .from('bhs_SUPPLIERS')
        .select('"SUPPLIER ID", "SUPPLIER NAME"')
        .order('SUPPLIER ID')
        .range(from, from + pageSize - 1);
      if (error) throw new Error('Failed to fetch suppliers for validation: ' + error.message);
      if (!data || data.length === 0) break;
      for (const s of data as any[]) {
        suppliers.push({ id: String(s['SUPPLIER ID'] ?? ''), name: String(s['SUPPLIER NAME'] ?? '') });
      }
      if (data.length < pageSize) break;
    }
    return { success: true as const, suppliers };
  } catch (error: any) {
    console.error('Upload context error:', error);
    return { success: false as const, error: error.message as string };
  }
}

/** Inserts one batch and returns the new row IDs (so a failed upload can be rolled back). */
export async function insertSuppliersChunk(payload: string) {
  await requireSession();
  try {
    const rows = JSON.parse(payload);
    if (!Array.isArray(rows)) throw new Error('Invalid data format');
    const chunk = rows.map((row: any) => {
      const { ID, id, ...rest } = row;
      return rest;
    });
    const { data, error } = await bhs_supabase.from('web_SUPPLIERS_ANALYSIS').insert(chunk).select('ID');
    if (error) throw error;
    const ids = ((data as any[]) || []).map((r) => r.ID);
    return { success: true as const, inserted: chunk.length, ids };
  } catch (error: any) {
    console.error('Insert chunk error:', error);
    return { success: false as const, error: (error?.message as string) || 'Insert failed' };
  }
}

export async function rollbackSuppliersUpload(ids: (string | number)[]) {
  await requireSession();
  try {
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await bhs_supabase.from('web_SUPPLIERS_ANALYSIS').delete().in('ID', ids.slice(i, i + 200));
      if (error) throw error;
    }
    return { success: true as const };
  } catch (error: any) {
    console.error('Rollback error:', error);
    return { success: false as const, error: (error?.message as string) || 'Rollback failed' };
  }
}
