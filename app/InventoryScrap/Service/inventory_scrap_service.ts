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
}

export interface Product {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT NAME': string;
  'PRODUCT BARCODE': string;
  'ITEM CODE'?: number | null;
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

    const { data: productsData, error: productsError } = await bhs_supabas
      .from('bhs_PRODUCTS')
      .select('PRODUCT ID, PRODUCT BARCODE, PRODUCT NAME');

    if (productsError) throw productsError;

    const productMap = new Map();
    productsData.forEach(p => {
      productMap.set(p['PRODUCT ID'], p);
    });

    const enrichedData = scrapData.map(entry => {
      const p = productMap.get(entry['PRODUCT ID']);
      return {
        ...entry,
        'PRODUCT BARCODE': p?.['PRODUCT BARCODE'] || '',
        'PRODUCT NAME': p?.['PRODUCT NAME'] || 'Unknown Product'
      };
    });

    return enrichedData;
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

    const { data: productsData, error: productsError } = await bhs_supabas
      .from('bhs_PRODUCTS')
      .select('PRODUCT ID, PRODUCT BARCODE, PRODUCT NAME');

    if (productsError) throw productsError;

    const productMap = new Map();
    productsData.forEach(p => {
      productMap.set(p['PRODUCT ID'], p);
    });

    const enrichedData = scrapData.map(entry => {
      const p = productMap.get(entry['PRODUCT ID']);
      return {
        ...entry,
        'PRODUCT BARCODE': p?.['PRODUCT BARCODE'] || '',
        'PRODUCT NAME': p?.['PRODUCT NAME'] || 'Unknown Product'
      };
    });

    return enrichedData;
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

    const { data: productsData, error: productsError } = await bhs_supabas
      .from('bhs_PRODUCTS')
      .select('PRODUCT ID, PRODUCT BARCODE, PRODUCT NAME');

    if (productsError) throw productsError;

    const productMap = new Map();
    productsData.forEach(p => {
      productMap.set(p['PRODUCT ID'], p);
    });

    const enrichedData = scrapData.map(entry => {
      const p = productMap.get(entry.PRODUCT_ID);
      return {
        ...entry,
        'PRODUCT BARCODE': p?.['PRODUCT BARCODE'] || '',
        'PRODUCT NAME': p?.['PRODUCT NAME'] || 'Unknown Product'
      };
    });

    return enrichedData;
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
