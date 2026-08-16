'use server';

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
// Session Actions
// ==========================================

export async function fetchActiveScrapSession(): Promise<string> {
  try {
    const { data, error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB_LIVE_SESSION_ID')
      .select('VALUE')
      .eq('KEY', 'active_scrap_session')
      .single();

    if (error) {
      // If no active session, create one
      const { error: insertErr } = await bhs_supabas
        .from('web_INVENTORY_SCRAB_LIVE_SESSION_ID')
        .insert({ KEY: 'active_scrap_session', VALUE: 'S-0001' });
      if (insertErr) throw insertErr;
      return 'S-0001';
    }

    return data.VALUE || 'S-0001';
  } catch (error: any) {
    console.error('Error fetching active scrap session:', error);
    throw new Error(error.message || 'Failed to fetch active session');
  }
}

export async function upsertActiveScrapSession(nextSession: string) {
  try {
    const { error } = await bhs_supabas
      .from('web_INVENTORY_SCRAB_LIVE_SESSION_ID')
      .upsert({ KEY: 'active_scrap_session', VALUE: nextSession });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error upserting active scrap session:', error);
    throw new Error(error.message || 'Failed to upsert active session');
  }
}

// ==========================================
// Products Actions
// ==========================================

export async function fetchAllProductsForScrap(): Promise<Product[]> {
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

// ==========================================
// Report Actions
// ==========================================

export async function fetchSavedScrapReports() {
  try {
    const { data: scrapData, error: scrapError } = await bhs_supabas
      .from('web_INVENTORY_SCRAB_REPORT')
      .select('*')
      .order('ID', { ascending: false });

    if (scrapError) throw scrapError;

    if (!scrapData || scrapData.length === 0) {
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

/**
 * Convert selected scrap sessions into one Saved Report (SCR-YYYY-####),
 * then lock those sessions by setting REPORT_ID on their scrap rows.
 */
export async function convertSessionsToScrapReport(sessionIds: string[]): Promise<{ reportId: string }> {
  const uniqueSessionIds = [...new Set(sessionIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueSessionIds.length === 0) {
    throw new Error('Select at least one session to convert.');
  }

  try {
    const { data: scrapRows, error: scrapError } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .select('*')
      .in('SESSION_ID', uniqueSessionIds);

    if (scrapError) throw scrapError;
    if (!scrapRows || scrapRows.length === 0) {
      throw new Error('No scrap entries found for the selected sessions.');
    }

    const alreadyReported = scrapRows.filter((row: any) => {
      const rid = row.REPORT_ID;
      return rid != null && String(rid).trim() !== '';
    });
    if (alreadyReported.length > 0) {
      const lockedSessions = [
        ...new Set(alreadyReported.map((row: any) => String(row.SESSION_ID || ''))),
      ].filter(Boolean);
      throw new Error(
        `These sessions were already converted to a report: ${lockedSessions.join(', ')}`,
      );
    }

    const foundSessions = new Set(scrapRows.map((row: any) => String(row.SESSION_ID || '')));
    const missing = uniqueSessionIds.filter((id) => !foundSessions.has(id));
    if (missing.length > 0) {
      throw new Error(`No scrap entries found for session(s): ${missing.join(', ')}`);
    }

    type Agg = { productId: string; qty: number; reason: string; unit: string };
    const aggregatedMap = new Map<string, Agg>();

    scrapRows.forEach((row: any) => {
      const productId = String(row['PRODUCT ID'] || '').trim();
      const reason = String(row.REASON || 'UNSPECIFIED');
      const key = `${productId}_${reason}`;
      const existing = aggregatedMap.get(key);
      const qty = Number(row.QTY) || 0;
      if (!existing) {
        aggregatedMap.set(key, {
          productId,
          qty,
          reason,
          unit: 'PCS',
        });
      } else {
        existing.qty += qty;
      }
    });

    const aggregated = [...aggregatedMap.values()].sort((a, b) => b.qty - a.qty);
    if (aggregated.length === 0) {
      throw new Error('Nothing to convert for the selected sessions.');
    }

    const currentYear = new Date().getFullYear();
    const [maxIdData, maxReportData] = await Promise.all([
      fetchMaxScrapReportRowId(),
      fetchMaxScrapReportId(),
    ]);

    let maxIdNum = 0;
    if (maxIdData?.ID) {
      const match = String(maxIdData.ID).match(/^R-(\d+)$/);
      if (match) maxIdNum = parseInt(match[1], 10);
    }

    let maxReportNum = 0;
    if (maxReportData && maxReportData.length > 0) {
      for (const row of maxReportData) {
        const reportId = String(row.REPORT_ID || '');
        const match = reportId.match(new RegExp(`^SCR-${currentYear}-(\\d+)$`));
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxReportNum) maxReportNum = num;
        }
      }
    }

    const nextReportId = `SCR-${currentYear}-${String(maxReportNum + 1).padStart(4, '0')}`;

    const insertPayload = aggregated.map((item, index) => {
      const rowId = `R-${String(maxIdNum + 1 + index).padStart(4, '0')}`;
      return {
        ID: rowId,
        REPORT_ID: nextReportId,
        PRODUCT_ID: item.productId,
        UNIT: item.unit,
        QTY: item.qty,
        REASON: item.reason,
      };
    });

    await insertScrapReport(insertPayload);

    const { error: lockError } = await bhs_supabas
      .from('web_INVENTORY_SCRAB')
      .update({ REPORT_ID: nextReportId })
      .in('SESSION_ID', uniqueSessionIds);

    if (lockError) throw lockError;

    return { reportId: nextReportId };
  } catch (error: any) {
    console.error('Error converting sessions to scrap report:', error);
    throw new Error(error.message || 'Failed to convert sessions to report');
  }
}

export async function fetchMaxScrapReportId() {
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
