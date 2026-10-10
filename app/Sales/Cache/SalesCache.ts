import { bhs_supabas } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const STORAGE_BUCKET = 'sales-cache';
const STORAGE_FILE = 'sales_cache.json';

// ─────────────────────────────────────────────────────────────
//  MEMORY LAYER (warm Vercel instances)
//  Each warm instance keeps its own copy. To stop instances from serving
//  old data after a Refresh on another instance, the storage file's
//  last-modified time is re-checked at most once a minute, in the
//  background (the request is never delayed by the check).
// ─────────────────────────────────────────────────────────────
let memoryCache: any[] | null = null;
let memoryVersion: string | null = null;   // storage file updated_at the memory copy came from
let lastVersionCheckAt = 0;
let versionCheckInFlight: Promise<void> | null = null;
const VERSION_CHECK_INTERVAL_MS = 60_000;

async function getStorageFileVersion(): Promise<string | null> {
  try {
    const { data, error } = await bhs_supabas
      .storage
      .from(STORAGE_BUCKET)
      .list('', { search: STORAGE_FILE, limit: 100 });
    if (error || !data) return null;
    const file = data.find((f: any) => f.name === STORAGE_FILE);
    return file ? String(file.updated_at || file.created_at || '') || null : null;
  } catch {
    return null;
  }
}

async function downloadStorageCache(): Promise<any[] | null> {
  const { data: fileData, error } = await bhs_supabas
    .storage
    .from(STORAGE_BUCKET)
    .download(STORAGE_FILE);
  if (error || !fileData) return null;
  const parsed = JSON.parse(await fileData.text());
  return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
}

// Background: reload memory if the storage file changed since we loaded it
function scheduleVersionCheck() {
  if (versionCheckInFlight) return;
  if (Date.now() - lastVersionCheckAt < VERSION_CHECK_INTERVAL_MS) return;
  lastVersionCheckAt = Date.now();

  versionCheckInFlight = (async () => {
    try {
      const version = await getStorageFileVersion();
      if (!version || version === memoryVersion) return;
      const fresh = await downloadStorageCache();
      if (fresh) {
        memoryCache = fresh;          // new array -> per-user caches rebuild automatically
        memoryVersion = version;
        console.log(`🔄 Storage cache changed, reloaded: ${fresh.length} rows`);
      }
    } catch (e) {
      console.warn('⚠️ Cache version check failed:', e);
    } finally {
      versionCheckInFlight = null;
    }
  })();
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: Read cache (used by every API route)
//  Priority: Memory → Storage JSON → DB fallback
// ─────────────────────────────────────────────────────────────
export async function getSalesDataServer(): Promise<any[]> {
  // 1. Memory hit (fastest). Freshness is checked in the background.
  if (memoryCache) {
    scheduleVersionCheck();
    return memoryCache;
  }

  // 2. Supabase Storage hit (fast — single HTTP request, CDN cached)
  try {
    const [version, parsed] = await Promise.all([getStorageFileVersion(), downloadStorageCache()]);
    if (parsed) {
      memoryCache = parsed;
      memoryVersion = version;
      lastVersionCheckAt = Date.now();
      console.log(`📦 Storage cache hit: ${parsed.length} rows`);
      return memoryCache;
    }
  } catch (e) {
    console.warn('⚠️ Storage cache miss, falling back to DB:', e);
  }

  // 3. DB fallback (slow — only on very first build or after cache cleared)
  console.log('🔄 DB fallback: building cache from scratch...');
  const built = await buildFromDB();
  memoryCache = built;
  memoryVersion = await getStorageFileVersion();
  lastVersionCheckAt = Date.now();
  return memoryCache;
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: Build cache from DB and save to Storage
//  Called by: Build API (triggered by Refresh button or Mapping upload)
// ─────────────────────────────────────────────────────────────
export async function buildAndSaveCache(): Promise<{ rows: number }> {
  const data = await buildFromDB();

  // Save to Supabase Storage as JSON
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });

  const { error } = await bhs_supabas
    .storage
    .from(STORAGE_BUCKET)
    .upload(STORAGE_FILE, blob, { upsert: true, contentType: 'application/json' });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  // Update memory immediately (and remember which file version it matches)
  memoryCache = data;
  memoryVersion = await getStorageFileVersion();
  lastVersionCheckAt = Date.now();

  console.log(`✅ Cache built & saved: ${data.length} rows → ${STORAGE_BUCKET}/${STORAGE_FILE}`);
  return { rows: data.length };
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: Invalidate memory (called after mapping upload)
// ─────────────────────────────────────────────────────────────
export function invalidateMemoryCache() {
  memoryCache = null;
  memoryVersion = null;
}

// ─────────────────────────────────────────────────────────────
//  PRIVATE: Pull everything from DB and merge
// ─────────────────────────────────────────────────────────────
async function buildFromDB(): Promise<any[]> {
  // orderBy: a unique column, so the parallel pages never overlap or skip rows
  const fetchAllFromTable = async (table: string, selectFields: string, orderBy: string) => {
    const { count, error: countErr } = await bhs_supabas
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;
    if (!count) return [];

    const step = 1000;
    const ranges: { from: number; to: number }[] = [];
    for (let i = 0; i < count; i += step) {
      ranges.push({ from: i, to: i + step - 1 });
    }

    const batchSize = 3;
    const allResults: any[] = [];

    for (let i = 0; i < ranges.length; i += batchSize) {
      const batch = ranges.slice(i, i + batchSize);
      const responses = await Promise.all(
        batch.map(r =>
          bhs_supabas
            .from(table)
            .select(selectFields)
            .order(orderBy, { ascending: true })
            .range(r.from, r.to)
        )
      );
      responses.forEach(res => {
        if (res.error) throw res.error;
        if (res.data) allResults.push(...res.data);
      });
    }

    return allResults;
  };

  const [salesData, customersData, productsData] = await Promise.all([
    fetchAllFromTable('web_Sales_DB', 'ID, "INVOICE DATE", "INVOICE NUMBER", "CUSTOMER ID", "PRODUCT ID", "PRODUCT PRICE", AMOUNT, QTY, "PRODUCT COST"', 'ID'),
    fetchAllFromTable('bhs_CUSTOMERS', '"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME", "CUSTOMER TAG", "CUSTOMER CLASS"', 'CUSTOMER ID'),
    fetchAllFromTable('bhs_PRODUCTS', '"PRODUCT ID", "PRODUCT NAME", "PRODUCT BARCODE", "PRODUCT CATEGORY", "PRODUCT COST"', 'PRODUCT ID'),
  ]);

  const norm = (v: any) => (v ? String(v).trim().toUpperCase() : '');

  const custMap = new Map<string, any>();
  (customersData || []).forEach((c: any) => {
    const id = norm(c['CUSTOMER ID']);
    if (id) custMap.set(id, c);
  });

  const prodMap = new Map<string, any>();
  (productsData || []).forEach((p: any) => {
    const pId = norm(p['PRODUCT ID']);
    const pBarcode = norm(p['PRODUCT BARCODE']);
    if (pId) prodMap.set(pId, p);
    if (pBarcode && pBarcode !== pId) prodMap.set(pBarcode, p);
  });

  return (salesData || []).map((s: any) => {
    const c = custMap.get(norm(s['CUSTOMER ID'])) || {};
    const p = prodMap.get(norm(s['PRODUCT ID'])) || {};
    return {
      id: s['ID'],
      invoiceDate: s['INVOICE DATE'],
      invoiceNumber: s['INVOICE NUMBER'],
      customerId: s['CUSTOMER ID'],
      productId: p['PRODUCT ID'] || s['PRODUCT ID'],
      productTag: p['PRODUCT CATEGORY'] || 'Uncategorized',
      customerTag: c['CUSTOMER TAG'] || '',
      customerClass: c['CUSTOMER CLASS'] || '',
      productCost: (s['PRODUCT COST'] !== undefined && s['PRODUCT COST'] !== null) ? s['PRODUCT COST'] : (p['PRODUCT COST'] || 0),
      productPrice: s['PRODUCT PRICE'],
      amount: s['AMOUNT'],
      qty: s['QTY'],
      customerName: c['CUSTOMER SUB NAME'],
      customerMainName: c['CUSTOMER MAIN NAME'],
      product: p['PRODUCT NAME'],
      barcode: p['PRODUCT BARCODE'],
    };
  });
}


// ─────────────────────────────────────────────────────────────
//  DELTA SYNC: Watermark and Delta fetching
// ─────────────────────────────────────────────────────────────
export async function getSalesWatermark(): Promise<string | null> {
  const { data, error } = await bhs_supabas
    .from('web_Sales_DB')
    .select('CREATED_AT')
    .order('CREATED_AT', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.CREATED_AT;
}

export async function getSalesDelta(watermark: string): Promise<any[]> {
  const fetchDeltaFromSales = async () => {
    const { count, error: countErr } = await bhs_supabas
      .from('web_Sales_DB')
      .select('*', { count: 'exact', head: true })
      .gt('CREATED_AT', watermark);

    if (countErr) throw countErr;
    if (!count) return [];

    const step = 1000;
    const ranges: { from: number; to: number }[] = [];
    for (let i = 0; i < count; i += step) {
      ranges.push({ from: i, to: i + step - 1 });
    }

    const batchSize = 3;
    const allResults: any[] = [];

    for (let i = 0; i < ranges.length; i += batchSize) {
      const batch = ranges.slice(i, i + batchSize);
      const responses = await Promise.all(
        batch.map(r =>
          bhs_supabas
            .from('web_Sales_DB')
            .select('ID, "INVOICE DATE", "INVOICE NUMBER", "CUSTOMER ID", "PRODUCT ID", "PRODUCT PRICE", AMOUNT, QTY, "PRODUCT COST"')
            .gt('CREATED_AT', watermark)
            .order('ID', { ascending: true })
            .range(r.from, r.to)
        )
      );
      responses.forEach(res => {
        if (res.error) throw res.error;
        if (res.data) allResults.push(...res.data);
      });
    }

    return allResults;
  };

  const fetchAllFromTable = async (table: string, selectFields: string) => {
    const { data, error } = await bhs_supabas.from(table).select(selectFields);
    if (error) throw error;
    return data || [];
  };

  const [salesData, customersData, productsData] = await Promise.all([
    fetchDeltaFromSales(),
    fetchAllFromTable('bhs_CUSTOMERS', '"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME", "CUSTOMER TAG", "CUSTOMER CLASS"'),
    fetchAllFromTable('bhs_PRODUCTS', '"PRODUCT ID", "PRODUCT NAME", "PRODUCT BARCODE", "PRODUCT CATEGORY", "PRODUCT COST"'),
  ]);

  if (salesData.length === 0) return [];

  const norm = (v: any) => (v ? String(v).trim().toUpperCase() : '');

  const custMap = new Map<string, any>();
  (customersData || []).forEach((c: any) => {
    const id = norm(c['CUSTOMER ID']);
    if (id) custMap.set(id, c);
  });

  const prodMap = new Map<string, any>();
  (productsData || []).forEach((p: any) => {
    const pId = norm(p['PRODUCT ID']);
    const pBarcode = norm(p['PRODUCT BARCODE']);
    if (pId) prodMap.set(pId, p);
    if (pBarcode && pBarcode !== pId) prodMap.set(pBarcode, p);
  });

  return (salesData || []).map((s: any) => {
    const c = custMap.get(norm(s['CUSTOMER ID'])) || {};
    const p = prodMap.get(norm(s['PRODUCT ID'])) || {};
    return {
      id: s['ID'],
      invoiceDate: s['INVOICE DATE'],
      invoiceNumber: s['INVOICE NUMBER'],
      customerId: s['CUSTOMER ID'],
      productId: p['PRODUCT ID'] || s['PRODUCT ID'],
      productTag: p['PRODUCT CATEGORY'] || 'Uncategorized',
      customerTag: c['CUSTOMER TAG'] || '',
      customerClass: c['CUSTOMER CLASS'] || '',
      productCost: (s['PRODUCT COST'] !== undefined && s['PRODUCT COST'] !== null) ? s['PRODUCT COST'] : (p['PRODUCT COST'] || 0),
      productPrice: s['PRODUCT PRICE'],
      amount: s['AMOUNT'],
      qty: s['QTY'],
      customerName: c['CUSTOMER SUB NAME'],
      customerMainName: c['CUSTOMER MAIN NAME'],
      product: p['PRODUCT NAME'],
      barcode: p['PRODUCT BARCODE'],
    };
  });
}
