import { bhs_supabas } from '@/lib/Supabase';

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const STORAGE_BUCKET = 'sales-cache';
const STORAGE_FILE = 'sales_cache.json';

// ─────────────────────────────────────────────────────────────
//  MEMORY LAYER (warm Vercel instances)
// ─────────────────────────────────────────────────────────────
let memoryCache: any[] | null = null;

// ─────────────────────────────────────────────────────────────
//  PUBLIC: Read cache (used by every API route)
//  Priority: Memory → Storage JSON → DB fallback
// ─────────────────────────────────────────────────────────────
export async function getSalesDataServer(): Promise<any[]> {
  // 1. Memory hit (fastest — same warm Vercel instance, kept indefinitely)
  if (memoryCache) {
    return memoryCache;
  }

  // 2. Supabase Storage hit (fast — single HTTP request, CDN cached)
  try {
    const { data: fileData, error } = await bhs_supabas
      .storage
      .from(STORAGE_BUCKET)
      .download(STORAGE_FILE);

    if (!error && fileData) {
      const text = await fileData.text();
      const parsed = JSON.parse(text) as any[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Warm memory for next requests in this instance
        memoryCache = parsed;
        console.log(`📦 Storage cache hit: ${parsed.length} rows`);
        return memoryCache;
      }
    }
  } catch (e) {
    console.warn('⚠️ Storage cache miss, falling back to DB:', e);
  }

  // 3. DB fallback (slow — only on very first build or after cache cleared)
  console.log('🔄 DB fallback: building cache from scratch...');
  const built = await buildFromDB();
  memoryCache = built;
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

  // Update memory immediately
  memoryCache = data;

  console.log(`✅ Cache built & saved: ${data.length} rows → ${STORAGE_BUCKET}/${STORAGE_FILE}`);
  return { rows: data.length };
}

// ─────────────────────────────────────────────────────────────
//  PUBLIC: Invalidate memory (called after mapping upload)
// ─────────────────────────────────────────────────────────────
export function invalidateMemoryCache() {
  memoryCache = null;
}

// ─────────────────────────────────────────────────────────────
//  PRIVATE: Pull everything from DB and merge
// ─────────────────────────────────────────────────────────────
async function buildFromDB(): Promise<any[]> {
  const fetchAllFromTable = async (table: string, selectFields: string) => {
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
    fetchAllFromTable('web_Sales_DB', 'ID, "INVOICE DATE", "INVOICE NUMBER", "CUSTOMER ID", "PRODUCT ID", "PRODUCT COST", "PRODUCT PRICE", AMOUNT, QTY'),
    fetchAllFromTable('bhs_CUSTOMERS', '"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"'),
    fetchAllFromTable('bhs_PRODUCTS', '"PRODUCT ID", "PRODUCT NAME", "PRODUCT BARCODE", "PRODUCT CATEGORY"'),
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
      productId: s['PRODUCT ID'],
      productTag: p['PRODUCT CATEGORY'] || 'Uncategorized',
      productCost: s['PRODUCT COST'],
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
