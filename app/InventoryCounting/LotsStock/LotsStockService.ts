'use server';
import { requireSession } from '@/lib/session';

import { bhs_supabase } from '@/lib/supabase';

// Stock per lot used by the mobile Inventory Counting (expected qty when a count session opens).
const LOTS_TABLE = 'app_INVENTORY_COUNT_LOTS';
const SESSION_STOCK_TABLE = 'app_INVENTORY_COUNT_SESSION_STOCK';
const ENTRIES_TABLE = 'app_INVENTORY_COUNT_ENTRIES';
const PAGE_SIZE = 1000;
const CHUNK_SIZE = 500;

export interface LotStockSummary {
  lots: number;
  products: number;
  totalQty: number;
}

export interface LotStockTemplateRow {
  productId: string;
  barcode: string;
  productName: string;
  lotNumber: string;
  expiryDate: string;
  qty: number | null;
}

export interface LotStockUploadRow {
  rowNumber: number;
  productId: string;
  barcode: string;
  lotNumber: string;
  expiryDate: string | null; // yyyy-mm-dd
  qty: number;
}

export interface LotStockUploadResult {
  ok: boolean;
  saved: number;
  errors: string[];
}

export interface LotStockClearResult {
  deleted: number;
  zeroed: number;
}

interface LotRow {
  ID: number;
  PRODUCT_ID: string;
  LOT_NUMBER: string;
  EXPIRY_DATE: string | null;
  QTY: number | string | null;
}

interface ProductRow {
  'PRODUCT ID': string | number | null;
  'PRODUCT BARCODE': string | number | null;
  'PRODUCT NAME': string | null;
}

/** Reads every row page by page with a stable order. */
async function fetchAll<T>(table: string, select: string, orderColumns: string[], countableOnly = false): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    let query = bhs_supabase.from(table).select(select);
    if (countableOnly) query = query.eq('IS_COUNTABLE', true);
    for (const column of orderColumns) query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

const text = (v: unknown) => String(v ?? '').trim();
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function loadLots() {
  return fetchAll<LotRow>(LOTS_TABLE, 'ID,PRODUCT_ID,LOT_NUMBER,EXPIRY_DATE,QTY', ['ID']);
}

function loadProducts(countableOnly: boolean) {
  return fetchAll<ProductRow>(
    'bhs_PRODUCTS',
    '"PRODUCT ID","PRODUCT BARCODE","PRODUCT NAME"',
    ['PRODUCT ID'],
    countableOnly,
  );
}

export async function fetchLotStockSummary(): Promise<LotStockSummary> {
  await requireSession();
  const lots = await loadLots();
  return {
    lots: lots.length,
    products: new Set(lots.map((l) => l.PRODUCT_ID)).size,
    totalQty: lots.reduce((sum, l) => sum + num(l.QTY), 0),
  };
}

/** Template = every countable product; products that already have lots get one row per lot. */
export async function fetchLotStockTemplateRows(): Promise<LotStockTemplateRow[]> {
  await requireSession();
  const [products, lots] = await Promise.all([loadProducts(true), loadLots()]);

  const lotsByProduct = new Map<string, LotRow[]>();
  for (const lot of lots) {
    const list = lotsByProduct.get(lot.PRODUCT_ID) ?? [];
    list.push(lot);
    lotsByProduct.set(lot.PRODUCT_ID, list);
  }

  const rows: LotStockTemplateRow[] = [];
  const sorted = [...products].sort((a, b) => text(a['PRODUCT NAME']).localeCompare(text(b['PRODUCT NAME'])));
  for (const p of sorted) {
    const productId = text(p['PRODUCT ID']);
    if (!productId) continue;
    const base = { productId, barcode: text(p['PRODUCT BARCODE']), productName: text(p['PRODUCT NAME']) };
    const productLots = lotsByProduct.get(productId) ?? [];
    if (productLots.length === 0) {
      rows.push({ ...base, lotNumber: '', expiryDate: '', qty: null });
      continue;
    }
    productLots
      .sort((a, b) => text(a.EXPIRY_DATE).localeCompare(text(b.EXPIRY_DATE)) || a.LOT_NUMBER.localeCompare(b.LOT_NUMBER))
      .forEach((lot) =>
        rows.push({ ...base, lotNumber: lot.LOT_NUMBER, expiryDate: text(lot.EXPIRY_DATE).slice(0, 10), qty: num(lot.QTY) }),
      );
  }
  return rows;
}

/**
 * Adds / updates lots from the uploaded sheet (key = product + lot number).
 * Nothing is saved when any row has an error. Lots that are not in the file are left as they are.
 */
export async function uploadLotStock(rows: LotStockUploadRow[]): Promise<LotStockUploadResult> {
  await requireSession();
  if (!rows.length) return { ok: false, saved: 0, errors: ['The file has no lot rows.'] };

  const products = await loadProducts(false);
  const byId = new Set<string>();
  const byBarcode = new Map<string, string>();
  for (const p of products) {
    const id = text(p['PRODUCT ID']);
    if (!id) continue;
    byId.add(id);
    const barcode = text(p['PRODUCT BARCODE']);
    if (barcode) byBarcode.set(barcode, id);
  }

  const errors: string[] = [];
  const seen = new Map<string, number>();
  const payload: { PRODUCT_ID: string; LOT_NUMBER: string; EXPIRY_DATE: string | null; QTY: number }[] = [];

  for (const r of rows) {
    const label = `Row ${r.rowNumber}`;
    const id = text(r.productId);
    const barcode = text(r.barcode);
    const productId = id && byId.has(id) ? id : byBarcode.get(barcode);
    const lotNumber = text(r.lotNumber);

    if (!productId) {
      errors.push(`${label}: product not found (ID "${id}", barcode "${barcode}")`);
      continue;
    }
    if (!lotNumber) {
      errors.push(`${label}: lot number is empty`);
      continue;
    }
    if (!Number.isFinite(r.qty) || r.qty < 0) {
      errors.push(`${label}: quantity must be 0 or more`);
      continue;
    }
    if (r.expiryDate && !/^\d{4}-\d{2}-\d{2}$/.test(r.expiryDate)) {
      errors.push(`${label}: expiry date is not valid`);
      continue;
    }
    const key = `${productId}|${lotNumber}`;
    const firstRow = seen.get(key);
    if (firstRow !== undefined) {
      errors.push(`${label}: lot "${lotNumber}" of product ${productId} is repeated (first on row ${firstRow})`);
      continue;
    }
    seen.set(key, r.rowNumber);
    payload.push({ PRODUCT_ID: productId, LOT_NUMBER: lotNumber, EXPIRY_DATE: r.expiryDate || null, QTY: r.qty });
  }

  if (errors.length) return { ok: false, saved: 0, errors };

  for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
    const chunk = payload.slice(i, i + CHUNK_SIZE);
    const { error } = await bhs_supabase.from(LOTS_TABLE).upsert(chunk, { onConflict: 'PRODUCT_ID,LOT_NUMBER' });
    if (error) {
      return {
        ok: false,
        saved: i,
        errors: [`Saving stopped after ${i} rows: ${error.message}`],
      };
    }
  }
  return { ok: true, saved: payload.length, errors: [] };
}

/**
 * Clears the lots stock. Lots that were never used in a count are deleted;
 * lots used by count sessions are kept (their history needs them) with QTY set to 0.
 */
export async function clearLotStock(): Promise<LotStockClearResult> {
  await requireSession();
  const [lots, sessionStock, entries] = await Promise.all([
    loadLots(),
    fetchAll<{ LOT_ID: number }>(SESSION_STOCK_TABLE, 'LOT_ID', ['SESSION_ID', 'LOT_ID']),
    fetchAll<{ LOT_ID: number }>(ENTRIES_TABLE, 'LOT_ID', ['ID']),
  ]);

  const used = new Set<number>([...sessionStock, ...entries].map((r) => Number(r.LOT_ID)));
  const toDelete = lots.filter((l) => !used.has(Number(l.ID))).map((l) => l.ID);
  const toZero = lots.filter((l) => used.has(Number(l.ID)) && num(l.QTY) !== 0).map((l) => l.ID);

  for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
    const { error } = await bhs_supabase.from(LOTS_TABLE).delete().in('ID', toDelete.slice(i, i + CHUNK_SIZE));
    if (error) throw new Error(`${LOTS_TABLE}: ${error.message}`);
  }
  for (let i = 0; i < toZero.length; i += CHUNK_SIZE) {
    const { error } = await bhs_supabase.from(LOTS_TABLE).update({ QTY: 0 }).in('ID', toZero.slice(i, i + CHUNK_SIZE));
    if (error) throw new Error(`${LOTS_TABLE}: ${error.message}`);
  }
  return { deleted: toDelete.length, zeroed: toZero.length };
}
