'use server';
import { requireSession } from '@/lib/session';

import { bhs_supabas } from '@/lib/supabase';

// ==========================================
// Types
// ==========================================

export interface ScrapEntry {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT BARCODE': string;
  'PRODUCT NAME': string;
  QTY: number;
  REASON: 'EXPIRED' | 'DAMAGED';
  CREATED_AT: string;
  SESSION_ID: string;
  REPORT_ID?: string | null;
}

export interface Product {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT NAME': string;
  'PRODUCT BARCODE': string;
  'ITEM CODE'?: number | null;
}

type ProductLookup = {
  'PRODUCT ID': string;
  'PRODUCT BARCODE': string;
  'PRODUCT NAME': string;
  'PRODUCT COST'?: number | null;
};

const REPORT_TABLE = 'web_INVENTORY_SCRAB_REPORT';

/** Reads every row (Supabase returns max 1000 per request) with a fixed order. */
async function fetchAllRows<T = any>(table: string, select: string, orderBy: string): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await bhs_supabas
      .from(table)
      .select(select)
      .order(orderBy, { ascending: true })
      .range(from, from + size - 1);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

const rowNum = (id: unknown) => {
  const m = String(id ?? '').match(/^R-(\d+)$/i);
  return m ? parseInt(m[1], 10) : 0;
};

/** Full product catalog keyed by PRODUCT ID (paginated — Supabase caps at 1000/page). */
async function fetchProductLookupMap(): Promise<Map<string, ProductLookup>> {
  const productMap = new Map<string, ProductLookup>();
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const start = page * pageSize;
    const end = start + pageSize - 1;
    const { data, error } = await bhs_supabas
      .from('bhs_PRODUCTS')
      .select('"PRODUCT ID", "PRODUCT BARCODE", "PRODUCT NAME", "PRODUCT COST"')
      .range(start, end);

    if (error) throw error;

    if (data && data.length > 0) {
      data.forEach((p: ProductLookup) => {
        const id = p['PRODUCT ID'];
        if (id == null || id === '') return;
        productMap.set(String(id).trim(), p);
      });
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  return productMap;
}

/**
 * Resolve catalog product for a scrap/report PRODUCT_ID.
 * Supports current numeric IDs and legacy Odoo external IDs:
 * `__export__.product_product_10070_c5fd6181` → `10070`
 */
function resolveProduct(
  productId: unknown,
  productMap: Map<string, ProductLookup>,
): ProductLookup | undefined {
  if (productId == null || productId === '') return undefined;
  const key = String(productId).trim();
  const direct = productMap.get(key);
  if (direct) return direct;

  const odooMatch = key.match(/product_product_(\d+)/i);
  if (odooMatch) return productMap.get(odooMatch[1]);

  return undefined;
}

function enrichScrapWithProduct(
  entry: any,
  productId: unknown,
  productMap: Map<string, ProductLookup>,
) {
  const p = resolveProduct(productId, productMap);
  return {
    ...entry,
    'PRODUCT BARCODE': p?.['PRODUCT BARCODE'] || '',
    'PRODUCT NAME': p?.['PRODUCT NAME'] || 'Unknown Product',
    'PRODUCT COST': Number(p?.['PRODUCT COST'] || 0),
  };
}

// ==========================================
// Scrap Entries Actions
// ==========================================

export async function fetchAllScrapEntries(): Promise<ScrapEntry[]> {
  await requireSession();
  try {
    const { data: scrapData, error: scrapError } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .select('*')
      .order('CREATED_AT', { ascending: false });

    if (scrapError) throw scrapError;

    if (!scrapData || scrapData.length === 0) {
      return [];
    }

    const productMap = await fetchProductLookupMap();

    return scrapData.map((entry: any) =>
      enrichScrapWithProduct(entry, entry['PRODUCT ID'], productMap) as ScrapEntry
    );
  } catch (error: any) {
    console.error('Error fetching scrap entries:', error);
    throw new Error(error.message || 'Failed to fetch scrap entries');
  }
}

export async function fetchScrapEntriesByDateRange(fromDate: string, toDate: string): Promise<ScrapEntry[]> {
  await requireSession();
  try {
    const { data: scrapData, error: scrapError } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .select('*')
      .gte('CREATED_AT', `${fromDate}T00:00:00`)
      .lte('CREATED_AT', `${toDate}T23:59:59`)
      .order('CREATED_AT', { ascending: false });

    if (scrapError) throw scrapError;

    if (!scrapData || scrapData.length === 0) {
      return [];
    }

    const productMap = await fetchProductLookupMap();

    return scrapData.map((entry: any) =>
      enrichScrapWithProduct(entry, entry['PRODUCT ID'], productMap) as ScrapEntry
    );
  } catch (error: any) {
    console.error('Error fetching scrap entries by date:', error);
    throw new Error(error.message || 'Failed to fetch scrap entries by date');
  }
}

export async function insertScrapEntry(entryData: Partial<ScrapEntry>) {
  await requireSession();
  try {
    const { error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .insert(entryData);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error inserting scrap entry:', error);
    throw new Error(error.message || 'Failed to insert scrap entry');
  }
}

export async function deleteScrapEntry(id: string) {
  await requireSession();
  try {
    const { data: existing, error: fetchError } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .select('REPORT_ID')
      .eq('ID', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    const reportId = existing?.REPORT_ID != null ? String(existing.REPORT_ID).trim() : '';
    if (reportId) {
      throw new Error(`Cannot delete entry included in report ${reportId}.`);
    }

    const { error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .delete()
      .eq('ID', id);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting scrap entry:', error);
    throw new Error(error.message || 'Failed to delete scrap entry');
  }
}



// ==========================================
// Products Actions
// ==========================================

export async function fetchAllProductsForScrap(): Promise<Product[]> {
  await requireSession();
  try {
    let allProducts: Product[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const start = page * pageSize;
      const end = start + pageSize - 1;
      const { data, error } = await bhs_supabas
        .from('bhs_PRODUCTS')
        .select('*')
        .order('PRODUCT NAME')
        .range(start, end);

      if (error) throw error;

      if (data && data.length > 0) {
        allProducts = [...allProducts, ...data];
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }

    return allProducts;
  } catch (error: any) {
    console.error('Error fetching products for scrap:', error);
    throw new Error(error.message || 'Failed to fetch products');
  }
}

export async function updateProductCosts(costs: { productId: string; cost: number }[]) {
  await requireSession();
  try {
    for (const item of costs) {
      const { error } = await bhs_supabas
        .from('bhs_PRODUCTS')
        .update({ 'PRODUCT COST': item.cost })
        .eq('PRODUCT ID', item.productId);

      if (error) {
        console.error(`Error updating cost for ${item.productId}:`, error);
        throw error;
      }
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error updating product costs:', error);
    throw new Error(error.message || 'Failed to update product costs');
  }
}

// ==========================================
// Report Actions
// ==========================================

export async function fetchSavedScrapReports() {
  await requireSession();
  try {
    // All report lines (no 1000-row cap), newest first by the real row number
    const scrapData = (await fetchAllRows<any>(REPORT_TABLE, '*', 'ID'))
      .sort((a, b) => rowNum(b.ID) - rowNum(a.ID));

    if (scrapData.length === 0) {
      return [];
    }

    const productMap = await fetchProductLookupMap();

    return scrapData.map((entry: any) =>
      enrichScrapWithProduct(entry, entry.PRODUCT_ID, productMap)
    );
  } catch (error: any) {
    console.error('Error fetching saved reports:', error);
    throw new Error(error.message || 'Failed to fetch saved reports');
  }
}

export async function insertScrapReport(reportData: any) {
  await requireSession();
  try {
    const { error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB_REPORT')
      .insert(reportData);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error inserting scrap report:', error);
    throw new Error(error.message || 'Failed to insert scrap report');
  }
}

export async function saveDirectScrapReport(items: { productId: string; qty: number; reason: string; unit: string }[]): Promise<{ reportId: string }> {
  await requireSession();
  try {
    if (!items || items.length === 0) {
      throw new Error('No items to save.');
    }

    const currentYear = new Date().getFullYear();
    const reportPattern = new RegExp(`^SCR-${currentYear}-(\\d+)$`);

    // Numbers are worked out from every existing line (as numbers, not text).
    // If another save took the same line numbers at the same moment (duplicate ID),
    // everything is recalculated and tried again — so the report number moves on too.
    let nextReportId = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await fetchAllRows<{ ID: string; REPORT_ID: string | null }>(REPORT_TABLE, 'ID, REPORT_ID', 'ID');
      const maxIdNum = existing.reduce((max, r) => Math.max(max, rowNum(r.ID)), 0);
      const maxReportNum = existing.reduce((max, r) => {
        const m = String(r.REPORT_ID || '').match(reportPattern);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0);

      nextReportId = `SCR-${currentYear}-${String(maxReportNum + 1).padStart(4, '0')}`;

      const insertPayload = items.map((item, index) => ({
        ID: `R-${String(maxIdNum + 1 + index).padStart(4, '0')}`,
        REPORT_ID: nextReportId,
        PRODUCT_ID: item.productId,
        UNIT: item.unit,
        QTY: item.qty,
        REASON: item.reason,
      }));

      const { error } = await bhs_supabas.from(REPORT_TABLE).insert(insertPayload);
      if (error) {
        if (error.code === '23505') continue; // row number taken meanwhile
        throw error;
      }

      return { reportId: nextReportId };
    }
    throw new Error('Could not reserve a report number, please try again.');
  } catch (error: any) {
    console.error('Error saving direct scrap report:', error);
    throw new Error(error.message || 'Failed to save direct scrap report');
  }
}

export async function fetchMaxScrapReportId() {
  await requireSession();
  try {
    const { data, error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB_REPORT')
      .select('REPORT_ID')
      .order('REPORT_ID', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching max report id:', error);
    throw new Error(error.message || 'Failed to fetch max report id');
  }
}

export async function fetchMaxScrapReportRowId() {
  await requireSession();
  try {
    const { data, error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB_REPORT')
      .select('ID')
      .order('ID', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error: any) {
    console.error('Error fetching max report row id:', error);
    throw new Error(error.message || 'Failed to fetch max report row id');
  }
}

export async function deleteScrapReport(reportId: string) {
  await requireSession();
  try {
    const { error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB_REPORT')
      .delete()
      .eq('REPORT_ID', reportId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting report:', error);
    throw new Error(error.message || 'Failed to delete report from database.');
  }
}

export async function deleteScrapSession(sessionId: string) {
  await requireSession();
  try {
    const { data: rows, error: fetchError } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .select('REPORT_ID')
      .eq('SESSION_ID', sessionId)
      .limit(50);

    if (fetchError) throw fetchError;

    const reported = (rows || []).find((row: any) => {
      const rid = row.REPORT_ID;
      return rid != null && String(rid).trim() !== '';
    });
    if (reported) {
      const reportId = String(reported.REPORT_ID).trim();
      throw new Error(`Cannot delete session included in report ${reportId}.`);
    }

    const { error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .delete()
      .eq('SESSION_ID', sessionId);

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting session:', error);
    throw new Error(error.message || 'Failed to delete session from database.');
  }
}
