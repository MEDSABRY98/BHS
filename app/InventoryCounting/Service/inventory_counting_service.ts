'use server';

import { bhs_supabase } from '@/lib/supabase';
import { getLiveAvailableQuantitiesFromMoves } from '@/app/InventoryAnalysis/Service/inventory_service';

export type CountType = 'Normal' | 'DamageExpire';

export interface ICItem {
  productId: string;
  barcodeName: string;
  productName: string;
  availableQty: number;
  qtyInBox: number;
  countedQty: number;
}

export interface ICRecord {
  rowId: string;
  date: string;
  user: string;
  warehouse: string;
  productId: string;
  barcodeName: string;
  productName: string;
  qtyInBox: number;
  countDetails: string;
  countedQty: number;
  countType: CountType;
}

export interface ICTotalCountItem {
  productId: string;
  barcodeName: string;
  productName: string;
  availableQty: number;
  qtyInBox: number;
  totalCountedQty: number;
  normalQty: number;
  damageQty: number;
  difference: number;
}

export interface ICUserComparisonRow {
  productId: string;
  barcodeName: string;
  productName: string;
  availableQty: number;
  grandTotal: number;
  userQtys: Record<string, number>;
}

type MixCountProductRow = {
  ID?: string;
  'PRODUCT ID': string;
  'PRODUCT BARCODE': string | null;
  'PRODUCT NAME': string;
  'QTY IN BOX': number | null;
};

type MixCountTable =
  | 'bhs_PRODUCTS'
  | 'mix_INVENTORY_COUNT_DETAILS'
  | 'mix_INVENTORY_COUNT_TOTALS';

type MixCountDetailRow = {
  ID: string;
  DATE: string | null;
  USER: string | null;
  WAREHOUSE: string | null;
  'PRODUCT ID': string;
  'QTY IN BOX': number | null;
  'COUNT DETAILS': string | null;
  'COUNTED QTY': number | null;
};

type MixCountDetailRowWithType = MixCountDetailRow & { COUNT_TYPE: string };

type ArchiveTable =
  | 'mix_INVENTORY_COUNT_DETAILS_ARCHIVE'
  | 'mix_INVENTORY_COUNT_TOTALS_ARCHIVE';

export interface ICArchiveHeader {
  archiveId: string;
  countDate: string | null;
  label: string | null;
  detailRowCount: number;
  totalRowCount: number;
  resetLive: boolean;
  closedAt: string;
}

const PRODUCT_SELECT = '"PRODUCT ID","PRODUCT BARCODE","PRODUCT NAME","QTY IN BOX"';
const DETAIL_SELECT =
  'ID,DATE,USER,WAREHOUSE,"PRODUCT ID","QTY IN BOX","COUNT DETAILS","COUNTED QTY"';
const DETAIL_SELECT_WITH_TYPE = `${DETAIL_SELECT},COUNT_TYPE`;
const TOTAL_SELECT = 'ID,"PRODUCT ID",COUNT_TYPE,"COUNTED QTY"';

function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function formatICDateTime(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';

  // Use wall-clock parts from ISO string — DB stores local time without offset correction.
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) {
    const [, year, month, day, hour, minute] = isoMatch;
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const fmt = (n: number) => String(n).padStart(2, '0');
  return `${fmt(d.getUTCDate())}/${fmt(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${fmt(d.getUTCHours())}:${fmt(d.getUTCMinutes())}`;
}

async function fetchAllMixCountRows<T>(
  table: MixCountTable,
  select: string,
  filter?: { column: string; value: string }
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const allRows: T[] = [];

  while (true) {
    let query = bhs_supabase.from(table).select(select);
    if (filter) query = query.eq(filter.column, filter.value);

    if (table === 'bhs_PRODUCTS') {
      query = query.eq('IS_COUNTABLE', true);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function fetchAllArchiveRows<T>(
  table: ArchiveTable,
  archiveId: string,
  select: string,
  filter?: { column: string; value: string }
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const allRows: T[] = [];

  while (true) {
    let query = bhs_supabase.from(table).select(select).eq('ARCHIVE_ID', archiveId.trim());
    if (filter) query = query.eq(filter.column, filter.value);

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function bulkInsertChunks(
  table: string,
  rows: Record<string, unknown>[],
  chunkSize = 500
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await bhs_supabase.from(table).insert(chunk);
    if (error) throw error;
  }
}

async function deleteArchiveSession(archiveId: string): Promise<void> {
  await bhs_supabase
    .from('mix_INVENTORY_COUNT_DETAILS_ARCHIVE')
    .delete()
    .eq('ARCHIVE_ID', archiveId);
  await bhs_supabase
    .from('mix_INVENTORY_COUNT_TOTALS_ARCHIVE')
    .delete()
    .eq('ARCHIVE_ID', archiveId);
  await bhs_supabase.from('mix_INVENTORY_COUNT_ARCHIVE').delete().eq('ARCHIVE_ID', archiveId);
}

async function deleteAllLiveICRows(): Promise<void> {
  for (const table of ['mix_INVENTORY_COUNT_DETAILS', 'mix_INVENTORY_COUNT_TOTALS'] as const) {
    while (true) {
      const { data, error } = await bhs_supabase.from(table).select('ID').limit(500);
      if (error) throw error;
      if (!data || data.length === 0) break;

      const ids = data.map((row) => String((row as { ID: string }).ID));
      const { error: deleteError } = await bhs_supabase.from(table).delete().in('ID', ids);
      if (deleteError) throw deleteError;
      if (data.length < 500) break;
    }
  }
}

function mapArchiveHeader(row: Record<string, unknown>): ICArchiveHeader {
  const countDateRaw = row['COUNT_DATE'];
  return {
    archiveId: String(row['ARCHIVE_ID'] || '').trim(),
    countDate: countDateRaw ? String(countDateRaw).split('T')[0] : null,
    label: row['LABEL'] ? String(row['LABEL']) : null,
    detailRowCount: parseNum(row['DETAIL_ROW_COUNT']),
    totalRowCount: parseNum(row['TOTAL_ROW_COUNT']),
    resetLive: Boolean(row['RESET_LIVE']),
    closedAt: String(row['CLOSED_AT'] || ''),
  };
}

function buildProductMap(products: MixCountProductRow[]): Map<string, MixCountProductRow> {
  return new Map(products.map((p) => [p['PRODUCT ID']?.toString().trim(), p]));
}

async function loadAvailableQtyMap(): Promise<Map<string, number>> {
  try {
    const { data, error } = await bhs_supabase.rpc('get_live_available_quantities');
    if (!error && Array.isArray(data)) {
      const map = new Map<string, number>();
      for (const row of data) {
        const record = row as Record<string, unknown>;
        const productId = String(record.product_id ?? record.productId ?? '').trim();
        if (!productId) continue;
        map.set(productId, parseNum(record.available_qty ?? record.availableQty));
      }
      if (map.size > 0) return map;
    }
    if (error) console.warn('RPC get_live_available_quantities failed:', error.message);
  } catch (err) {
    console.warn('RPC get_live_available_quantities error:', err);
  }

  return getLiveAvailableQuantitiesFromMoves();
}

function buildICTotalItems(
  products: MixCountProductRow[],
  totals: { 'PRODUCT ID': string; 'COUNTED QTY': number | null }[],
  liveStockMap: Map<string, number>
): ICItem[] {
  const totalMap = new Map(
    totals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
  );

  return products
    .map((p) => {
      const pid = p['PRODUCT ID']?.toString().trim() || '';
      return {
        productId: pid,
        barcodeName: p['PRODUCT BARCODE']?.toString().trim() || '',
        productName: p['PRODUCT NAME']?.toString().trim() || '',
        availableQty: liveStockMap.get(pid) || 0,
        qtyInBox: parseNum(p['QTY IN BOX']),
        countedQty: totalMap.get(pid) || 0,
      };
    })
    .filter((item) => item.productName)
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

function buildICRecords(
  details: MixCountDetailRow[],
  productMap: Map<string, MixCountProductRow>,
  countType: CountType
): ICRecord[] {
  return details
    .map((row) => {
      const productId = row['PRODUCT ID']?.toString().trim() || '';
      const product = productMap.get(productId);
      return {
        rowId: row.ID || '',
        date: formatICDateTime(row.DATE),
        user: row.USER?.toString().trim() || '',
        warehouse: row.WAREHOUSE?.toString().trim() || '',
        productId,
        barcodeName: product?.['PRODUCT BARCODE']?.toString().trim() || '',
        productName: product?.['PRODUCT NAME']?.toString().trim() || '',
        qtyInBox: parseNum(row['QTY IN BOX'] ?? product?.['QTY IN BOX']),
        countDetails: row['COUNT DETAILS']?.toString() || '',
        countedQty: parseNum(row['COUNTED QTY']),
        countType,
      };
    })
    .filter((record) => record.productId);
}

async function generateNextRowId(table: 'mix_INVENTORY_COUNT_TOTALS'): Promise<string> {
  const rows = await fetchAllMixCountRows<{ ID: string }>(table, 'ID');
  let maxNum = 0;
  for (const row of rows) {
    const id = row.ID?.toString().trim() || '';
    if (id.startsWith('R-')) {
      const numPart = parseInt(id.substring(2), 10);
      if (Number.isFinite(numPart) && numPart > maxNum) maxNum = numPart;
    }
  }
  return `R-${String(maxNum + 1).padStart(4, '0')}`;
}

async function recalcICTotalForProduct(productId: string, countType: CountType): Promise<void> {
  const { data: details, error: detailsError } = await bhs_supabase
    .from('mix_INVENTORY_COUNT_DETAILS')
    .select('"COUNTED QTY"')
    .eq('PRODUCT ID', productId.trim())
    .eq('COUNT_TYPE', countType);

  if (detailsError) throw detailsError;

  const sum = (details || []).reduce(
    (acc, row) => acc + parseNum((row as Record<string, unknown>)['COUNTED QTY']),
    0
  );

  const { data: existing, error: existingError } = await bhs_supabase
    .from('mix_INVENTORY_COUNT_TOTALS')
    .select('ID')
    .eq('PRODUCT ID', productId.trim())
    .eq('COUNT_TYPE', countType)
    .limit(1);

  if (existingError) throw existingError;

  if (existing && existing.length > 0) {
    const { error } = await bhs_supabase
      .from('mix_INVENTORY_COUNT_TOTALS')
      .update({ 'COUNTED QTY': sum })
      .eq('ID', existing[0].ID);
    if (error) throw error;
  } else if (sum > 0) {
    const nextId = await generateNextRowId('mix_INVENTORY_COUNT_TOTALS');
    const { error } = await bhs_supabase.from('mix_INVENTORY_COUNT_TOTALS').insert({
      ID: nextId,
      'PRODUCT ID': productId.trim(),
      COUNT_TYPE: countType,
      'COUNTED QTY': sum,
    });
    if (error) throw error;
  }
}

/** Combined Normal + Damage totals with live available stock. */
export async function fetchICTotalCountData() {
  try {
    const [products, normalTotals, damageTotals, liveStockMap] = await Promise.all([
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
      fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS',
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: 'Normal' }
      ),
      fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS',
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: 'DamageExpire' }
      ),
      loadAvailableQtyMap(),
    ]);

    const normalMap = new Map(
      normalTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );
    const damageMap = new Map(
      damageTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );

    const data: ICTotalCountItem[] = products
      .map((p) => {
        const pid = p['PRODUCT ID']?.toString().trim() || '';
        const normalQty = normalMap.get(pid) || 0;
        const damageQty = damageMap.get(pid) || 0;
        const totalCountedQty = normalQty + damageQty;
        const availableQty = liveStockMap.get(pid) || 0;
        return {
          productId: pid,
          barcodeName: p['PRODUCT BARCODE']?.toString().trim() || '',
          productName: p['PRODUCT NAME']?.toString().trim() || '',
          availableQty,
          qtyInBox: parseNum(p['QTY IN BOX']),
          totalCountedQty,
          normalQty,
          damageQty,
          difference: totalCountedQty - availableQty,
        };
      })
      .filter((item) => item.productName)
      .sort((a, b) => a.productName.localeCompare(b.productName));

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in fetchICTotalCountData:', error);
    return { success: false, error: 'Failed to fetch total count data', details: error.message };
  }
}

/** Per-user comparison — official grand total + detail sums by USER (Normal + Damage). */
export async function fetchICUserComparisonData() {
  try {
    const [products, normalTotals, damageTotals, normalDetails, damageDetails, liveStockMap] =
      await Promise.all([
        fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
        fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
          'mix_INVENTORY_COUNT_TOTALS',
          '"PRODUCT ID","COUNTED QTY"',
          { column: 'COUNT_TYPE', value: 'Normal' }
        ),
        fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
          'mix_INVENTORY_COUNT_TOTALS',
          '"PRODUCT ID","COUNTED QTY"',
          { column: 'COUNT_TYPE', value: 'DamageExpire' }
        ),
        fetchAllMixCountRows<MixCountDetailRow>(
          'mix_INVENTORY_COUNT_DETAILS',
          DETAIL_SELECT,
          { column: 'COUNT_TYPE', value: 'Normal' }
        ),
        fetchAllMixCountRows<MixCountDetailRow>(
          'mix_INVENTORY_COUNT_DETAILS',
          DETAIL_SELECT,
          { column: 'COUNT_TYPE', value: 'DamageExpire' }
        ),
        loadAvailableQtyMap(),
      ]);

    const productMap = buildProductMap(products);
    const normalMap = new Map(
      normalTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );
    const damageMap = new Map(
      damageTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );

    const normalRecords = buildICRecords(normalDetails, productMap, 'Normal');
    const damageRecords = buildICRecords(damageDetails, productMap, 'DamageExpire');
    const allRecords = [...normalRecords, ...damageRecords];

    const userSet = new Set<string>();
    allRecords.forEach((r) => {
      if (r.user) userSet.add(r.user);
    });
    const users = Array.from(userSet).sort((a, b) => a.localeCompare(b));

    const userQtyByProduct = new Map<string, Record<string, number>>();
    allRecords.forEach((record) => {
      if (!record.productId || !record.user) return;
      const byUser = userQtyByProduct.get(record.productId) || {};
      byUser[record.user] = (byUser[record.user] || 0) + record.countedQty;
      userQtyByProduct.set(record.productId, byUser);
    });

    const data: ICUserComparisonRow[] = products
      .map((p) => {
        const pid = p['PRODUCT ID']?.toString().trim() || '';
        const grandTotal = (normalMap.get(pid) || 0) + (damageMap.get(pid) || 0);
        return {
          productId: pid,
          barcodeName: p['PRODUCT BARCODE']?.toString().trim() || '',
          productName: p['PRODUCT NAME']?.toString().trim() || '',
          availableQty: liveStockMap.get(pid) || 0,
          grandTotal,
          userQtys: userQtyByProduct.get(pid) || {},
        };
      })
      .filter((item) => item.productName)
      .sort((a, b) => a.productName.localeCompare(b.productName));

    return { success: true, data, users, normalRecords, damageRecords };
  } catch (error: any) {
    console.error('Error in fetchICUserComparisonData:', error);
    return {
      success: false,
      error: 'Failed to fetch user comparison data',
      details: error.message,
    };
  }
}

/** Single fetch for Count tabs — products loaded once, parallel DB reads. */
export async function fetchICCountTabData(countType: CountType) {
  try {
    const [products, totals, details, liveStockMap] = await Promise.all([
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
      fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS',
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: countType }
      ),
      fetchAllMixCountRows<MixCountDetailRow>(
        'mix_INVENTORY_COUNT_DETAILS',
        DETAIL_SELECT,
        { column: 'COUNT_TYPE', value: countType }
      ),
      loadAvailableQtyMap(),
    ]);

    const productMap = buildProductMap(products);

    return {
      success: true,
      data: buildICTotalItems(products, totals, liveStockMap),
      records: buildICRecords(details, productMap, countType),
    };
  } catch (error: any) {
    console.error('Error in fetchICCountTabData:', error);
    return { success: false, error: 'Failed to fetch IC count data', details: error.message };
  }
}

export async function fetchICTotal(countType: CountType) {
  try {
    const [products, totals, liveStockMap] = await Promise.all([
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
      fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS',
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: countType }
      ),
      loadAvailableQtyMap(),
    ]);

    return { success: true, data: buildICTotalItems(products, totals, liveStockMap) };
  } catch (error: any) {
    console.error('Error in fetchICTotal:', error);
    return { success: false, error: 'Failed to fetch IC total', details: error.message };
  }
}

export async function fetchAllICDetails() {
  try {
    const [normalDetails, damageDetails, products] = await Promise.all([
      fetchAllMixCountRows<MixCountDetailRow>(
        'mix_INVENTORY_COUNT_DETAILS',
        DETAIL_SELECT,
        { column: 'COUNT_TYPE', value: 'Normal' }
      ),
      fetchAllMixCountRows<MixCountDetailRow>(
        'mix_INVENTORY_COUNT_DETAILS',
        DETAIL_SELECT,
        { column: 'COUNT_TYPE', value: 'DamageExpire' }
      ),
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
    ]);

    const productMap = buildProductMap(products);
    const taggedDetails: Array<{ row: MixCountDetailRow; countType: CountType }> = [
      ...normalDetails.map((row) => ({ row, countType: 'Normal' as CountType })),
      ...damageDetails.map((row) => ({ row, countType: 'DamageExpire' as CountType })),
    ];

    taggedDetails.sort((a, b) => {
      const dateA = new Date(String(a.row.DATE || '')).getTime();
      const dateB = new Date(String(b.row.DATE || '')).getTime();
      return dateB - dateA;
    });

    const data: ICRecord[] = taggedDetails.flatMap(({ row, countType }) =>
      buildICRecords([row], productMap, countType)
    );

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in fetchAllICDetails:', error);
    return { success: false, error: 'Failed to fetch IC details', details: error.message };
  }
}

export async function updateICRecord(
  rowId: string,
  countType: CountType,
  productId: string,
  values: { qtyInBox: number; countedQty: number; countDetails: string }
) {
  try {
    const { error } = await bhs_supabase
      .from('mix_INVENTORY_COUNT_DETAILS')
      .update({
        'QTY IN BOX': parseNum(values.qtyInBox),
        'COUNT DETAILS': values.countDetails.trim(),
        'COUNTED QTY': parseNum(values.countedQty),
      })
      .eq('ID', rowId.trim());

    if (error) throw error;

    await recalcICTotalForProduct(productId, countType);
    return { success: true };
  } catch (error: any) {
    console.error('Error in updateICRecord:', error);
    return { success: false, error: 'Failed to update record', details: error.message };
  }
}

export async function deleteICRecord(rowId: string, countType: CountType, productId: string) {
  try {
    const { error } = await bhs_supabase
      .from('mix_INVENTORY_COUNT_DETAILS')
      .delete()
      .eq('ID', rowId.trim());

    if (error) throw error;

    await recalcICTotalForProduct(productId, countType);
    return { success: true };
  } catch (error: any) {
    console.error('Error in deleteICRecord:', error);
    return { success: false, error: 'Failed to delete record', details: error.message };
  }
}

export async function fetchICDetails(countType: CountType) {
  try {
    const [details, products] = await Promise.all([
      fetchAllMixCountRows<MixCountDetailRow>(
        'mix_INVENTORY_COUNT_DETAILS',
        DETAIL_SELECT,
        { column: 'COUNT_TYPE', value: countType }
      ),
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
    ]);

    return {
      success: true,
      data: buildICRecords(details, buildProductMap(products), countType),
    };
  } catch (error: any) {
    console.error('Error in fetchICDetails:', error);
    return { success: false, error: 'Failed to fetch IC details', details: error.message };
  }
}

export async function updateICItem(
  _sheetName: string,
  productId: string,
  newValues: { barcodeName: string; productName: string; availableQty: number; qtyInBox: number }
) {
  try {
    const { data, error } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .update({
        'PRODUCT BARCODE': newValues.barcodeName.trim(),
        'PRODUCT NAME': newValues.productName.trim(),
        'QTY IN BOX': parseNum(newValues.qtyInBox),
      })
      .eq('PRODUCT ID', productId.trim())
      .select('ID');

    if (error) throw error;

    return { success: true, data: !!(data && data.length > 0) };
  } catch (error: any) {
    console.error('Error in updateICItem:', error);
    return { success: false, error: 'Failed to update item', details: error.message };
  }
}

/** Users & warehouses for shared parent-level filters. */
export async function fetchICFilterOptions() {
  try {
    const { data: details, error } = await bhs_supabase
      .from('mix_INVENTORY_COUNT_DETAILS')
      .select('USER, WAREHOUSE');

    if (error) throw error;

    const userNames = new Set<string>();
    (details || []).forEach((row) => {
      const name = String(row.USER || '').trim();
      if (name) userNames.add(name);
    });

    const warehouseNames = new Set<string>();
    (details || []).forEach((row) => {
      const name = String(row.WAREHOUSE || '').trim();
      if (name) warehouseNames.add(name);
    });

    return {
      success: true,
      users: Array.from(userNames).sort((a, b) => a.localeCompare(b)),
      warehouses: Array.from(warehouseNames).sort((a, b) => a.localeCompare(b)),
    };
  } catch (error: any) {
    console.error('Error in fetchICFilterOptions:', error);
    return {
      success: false,
      users: [],
      warehouses: [],
      error: error.message,
    };
  }
}

export interface ICProductSearchResult {
  productId: string;
  productName: string;
  barcodeName: string;
}

/** Fetch product barcodes by ID from bhs_PRODUCTS. */
export async function getICProductBarcodesByIds(productIds: string[]) {
  try {
    const uniqueIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { success: true as const, data: {} as Record<string, string> };
    }

    const barcodeMap: Record<string, string> = {};
    const chunkSize = 200;

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const { data, error } = await bhs_supabase
        .from('bhs_PRODUCTS')
        .select('"PRODUCT ID","PRODUCT BARCODE"')
        .in('PRODUCT ID', chunk);

      if (error) throw error;

      (data || []).forEach((row: { 'PRODUCT ID'?: string | null; 'PRODUCT BARCODE'?: string | null }) => {
        const productId = row['PRODUCT ID']?.toString().trim();
        if (!productId) return;
        barcodeMap[productId] = row['PRODUCT BARCODE']?.toString().trim() || '';
      });
    }

    return { success: true as const, data: barcodeMap };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch product barcodes';
    console.error('Error in getICProductBarcodesByIds:', error);
    return { success: false as const, error: message, data: {} as Record<string, string> };
  }
}

/** Search countable products by name, barcode, or ID. */
export async function searchICProducts(query: string, limit = 12) {
  try {
    const q = query.trim();
    if (q.length < 2) {
      return { success: true as const, data: [] as ICProductSearchResult[] };
    }

    const term = `%${q}%`;
    const { data, error } = await bhs_supabase
      .from('bhs_PRODUCTS')
      .select('"PRODUCT ID","PRODUCT BARCODE","PRODUCT NAME"')
      .eq('IS_COUNTABLE', true)
      .or(`"PRODUCT NAME".ilike.${term},"PRODUCT BARCODE".ilike.${term},"PRODUCT ID".ilike.${term}`)
      .order('PRODUCT NAME')
      .limit(limit);

    if (error) throw error;

    const results: ICProductSearchResult[] = (data || [])
      .map((row) => ({
        productId: row['PRODUCT ID']?.toString().trim() || '',
        barcodeName: row['PRODUCT BARCODE']?.toString().trim() || '',
        productName: row['PRODUCT NAME']?.toString().trim() || '',
      }))
      .filter((row) => row.productId && row.productName);

    return { success: true as const, data: results };
  } catch (error: any) {
    console.error('Error in searchICProducts:', error);
    return {
      success: false as const,
      error: 'Failed to search products',
      details: error.message,
      data: [] as ICProductSearchResult[],
    };
  }
}

// ─── Archive session ───────────────────────────────────────────────────────

export async function generateNextArchiveId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IC-${year}-`;

  const { data, error } = await bhs_supabase
    .from('mix_INVENTORY_COUNT_ARCHIVE')
    .select('ARCHIVE_ID')
    .like('ARCHIVE_ID', `${prefix}%`)
    .order('ARCHIVE_ID', { ascending: false })
    .limit(1);

  if (error) throw error;

  let nextNum = 1;
  const latest = data?.[0]?.ARCHIVE_ID;
  if (latest) {
    const parts = String(latest).split('-');
    const num = parseInt(parts[2] || '', 10);
    if (Number.isFinite(num)) nextNum = num + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export async function fetchInventoryCountArchives() {
  try {
    const { data, error } = await bhs_supabase
      .from('mix_INVENTORY_COUNT_ARCHIVE')
      .select(
        'ARCHIVE_ID,COUNT_DATE,LABEL,DETAIL_ROW_COUNT,TOTAL_ROW_COUNT,RESET_LIVE,CLOSED_AT'
      )
      .order('CLOSED_AT', { ascending: false });

    if (error) throw error;

    return {
      success: true as const,
      data: (data || []).map((row) => mapArchiveHeader(row as Record<string, unknown>)),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch archives';
    console.error('Error in fetchInventoryCountArchives:', error);
    return { success: false as const, error: message, data: [] as ICArchiveHeader[] };
  }
}

export async function closeInventoryCountSession(input: {
  label?: string;
  countDate?: string;
  resetLive: boolean;
}) {
  let archiveId = '';

  try {
    const [allDetails, allTotals] = await Promise.all([
      fetchAllMixCountRows<MixCountDetailRowWithType>(
        'mix_INVENTORY_COUNT_DETAILS',
        DETAIL_SELECT_WITH_TYPE
      ),
      fetchAllMixCountRows<{
        ID: string;
        'PRODUCT ID': string;
        COUNT_TYPE: string;
        'COUNTED QTY': number | null;
      }>('mix_INVENTORY_COUNT_TOTALS', TOTAL_SELECT),
    ]);

    archiveId = await generateNextArchiveId();
    const countDate = input.countDate?.trim() || new Date().toISOString().split('T')[0];
    const label = input.label?.trim() || null;

    const { error: headerError } = await bhs_supabase.from('mix_INVENTORY_COUNT_ARCHIVE').insert({
      ARCHIVE_ID: archiveId,
      COUNT_DATE: countDate,
      LABEL: label,
      DETAIL_ROW_COUNT: allDetails.length,
      TOTAL_ROW_COUNT: allTotals.length,
      RESET_LIVE: input.resetLive,
    });

    if (headerError) throw headerError;

    try {
      const detailRows = allDetails.map((row) => ({
        ARCHIVE_ID: archiveId,
        ID: row.ID,
        DATE: row.DATE,
        USER: row.USER,
        WAREHOUSE: row.WAREHOUSE,
        'PRODUCT ID': row['PRODUCT ID'],
        'QTY IN BOX': row['QTY IN BOX'],
        'COUNT DETAILS': row['COUNT DETAILS'],
        'COUNTED QTY': row['COUNTED QTY'],
        COUNT_TYPE: row.COUNT_TYPE,
      }));

      const totalRows = allTotals.map((row) => ({
        ARCHIVE_ID: archiveId,
        ID: row.ID,
        'PRODUCT ID': row['PRODUCT ID'],
        COUNT_TYPE: row.COUNT_TYPE,
        'COUNTED QTY': row['COUNTED QTY'],
      }));

      if (detailRows.length > 0) {
        await bulkInsertChunks('mix_INVENTORY_COUNT_DETAILS_ARCHIVE', detailRows);
      }
      if (totalRows.length > 0) {
        await bulkInsertChunks('mix_INVENTORY_COUNT_TOTALS_ARCHIVE', totalRows);
      }

      if (input.resetLive) {
        await deleteAllLiveICRows();
      }
    } catch (insertError) {
      await deleteArchiveSession(archiveId);
      throw insertError;
    }

    return {
      success: true as const,
      archiveId,
      detailCount: allDetails.length,
      totalCount: allTotals.length,
      resetLive: input.resetLive,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to close session';
    console.error('Error in closeInventoryCountSession:', error);
    return { success: false as const, error: message };
  }
}

export async function fetchArchivedICTotalCountData(archiveId: string) {
  try {
    const [products, normalTotals, damageTotals, liveStockMap] = await Promise.all([
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
      fetchAllArchiveRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS_ARCHIVE',
        archiveId,
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: 'Normal' }
      ),
      fetchAllArchiveRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS_ARCHIVE',
        archiveId,
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: 'DamageExpire' }
      ),
      loadAvailableQtyMap(),
    ]);

    const normalMap = new Map(
      normalTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );
    const damageMap = new Map(
      damageTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );

    const data: ICTotalCountItem[] = products
      .map((p) => {
        const pid = p['PRODUCT ID']?.toString().trim() || '';
        const normalQty = normalMap.get(pid) || 0;
        const damageQty = damageMap.get(pid) || 0;
        const totalCountedQty = normalQty + damageQty;
        const availableQty = liveStockMap.get(pid) || 0;
        return {
          productId: pid,
          barcodeName: p['PRODUCT BARCODE']?.toString().trim() || '',
          productName: p['PRODUCT NAME']?.toString().trim() || '',
          availableQty,
          qtyInBox: parseNum(p['QTY IN BOX']),
          totalCountedQty,
          normalQty,
          damageQty,
          difference: totalCountedQty - availableQty,
        };
      })
      .filter((item) => item.productName)
      .sort((a, b) => a.productName.localeCompare(b.productName));

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in fetchArchivedICTotalCountData:', error);
    return { success: false, error: 'Failed to fetch archived total count data', details: error.message };
  }
}

export async function fetchArchivedICUserComparisonData(archiveId: string) {
  try {
    const [products, normalTotals, damageTotals, normalDetails, damageDetails, liveStockMap] =
      await Promise.all([
        fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
        fetchAllArchiveRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
          'mix_INVENTORY_COUNT_TOTALS_ARCHIVE',
          archiveId,
          '"PRODUCT ID","COUNTED QTY"',
          { column: 'COUNT_TYPE', value: 'Normal' }
        ),
        fetchAllArchiveRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
          'mix_INVENTORY_COUNT_TOTALS_ARCHIVE',
          archiveId,
          '"PRODUCT ID","COUNTED QTY"',
          { column: 'COUNT_TYPE', value: 'DamageExpire' }
        ),
        fetchAllArchiveRows<MixCountDetailRow>(
          'mix_INVENTORY_COUNT_DETAILS_ARCHIVE',
          archiveId,
          DETAIL_SELECT,
          { column: 'COUNT_TYPE', value: 'Normal' }
        ),
        fetchAllArchiveRows<MixCountDetailRow>(
          'mix_INVENTORY_COUNT_DETAILS_ARCHIVE',
          archiveId,
          DETAIL_SELECT,
          { column: 'COUNT_TYPE', value: 'DamageExpire' }
        ),
        loadAvailableQtyMap(),
      ]);

    const productMap = buildProductMap(products);
    const normalMap = new Map(
      normalTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );
    const damageMap = new Map(
      damageTotals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );

    const normalRecords = buildICRecords(normalDetails, productMap, 'Normal');
    const damageRecords = buildICRecords(damageDetails, productMap, 'DamageExpire');
    const allRecords = [...normalRecords, ...damageRecords];

    const userSet = new Set<string>();
    allRecords.forEach((r) => {
      if (r.user) userSet.add(r.user);
    });
    const users = Array.from(userSet).sort((a, b) => a.localeCompare(b));

    const userQtyByProduct = new Map<string, Record<string, number>>();
    allRecords.forEach((record) => {
      if (!record.productId || !record.user) return;
      const byUser = userQtyByProduct.get(record.productId) || {};
      byUser[record.user] = (byUser[record.user] || 0) + record.countedQty;
      userQtyByProduct.set(record.productId, byUser);
    });

    const data: ICUserComparisonRow[] = products
      .map((p) => {
        const pid = p['PRODUCT ID']?.toString().trim() || '';
        const grandTotal = (normalMap.get(pid) || 0) + (damageMap.get(pid) || 0);
        return {
          productId: pid,
          barcodeName: p['PRODUCT BARCODE']?.toString().trim() || '',
          productName: p['PRODUCT NAME']?.toString().trim() || '',
          availableQty: liveStockMap.get(pid) || 0,
          grandTotal,
          userQtys: userQtyByProduct.get(pid) || {},
        };
      })
      .filter((item) => item.productName)
      .sort((a, b) => a.productName.localeCompare(b.productName));

    return { success: true, data, users, normalRecords, damageRecords };
  } catch (error: any) {
    console.error('Error in fetchArchivedICUserComparisonData:', error);
    return {
      success: false,
      error: 'Failed to fetch archived user comparison data',
      details: error.message,
    };
  }
}

export async function fetchArchivedICCountTabData(archiveId: string, countType: CountType) {
  try {
    const [products, totals, details, liveStockMap] = await Promise.all([
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
      fetchAllArchiveRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS_ARCHIVE',
        archiveId,
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: countType }
      ),
      fetchAllArchiveRows<MixCountDetailRow>(
        'mix_INVENTORY_COUNT_DETAILS_ARCHIVE',
        archiveId,
        DETAIL_SELECT,
        { column: 'COUNT_TYPE', value: countType }
      ),
      loadAvailableQtyMap(),
    ]);

    const productMap = buildProductMap(products);

    return {
      success: true,
      data: buildICTotalItems(products, totals, liveStockMap),
      records: buildICRecords(details, productMap, countType),
    };
  } catch (error: any) {
    console.error('Error in fetchArchivedICCountTabData:', error);
    return { success: false, error: 'Failed to fetch archived IC count data', details: error.message };
  }
}

export async function fetchArchivedAllICDetails(archiveId: string) {
  try {
    const [normalDetails, damageDetails, products] = await Promise.all([
      fetchAllArchiveRows<MixCountDetailRow>(
        'mix_INVENTORY_COUNT_DETAILS_ARCHIVE',
        archiveId,
        DETAIL_SELECT,
        { column: 'COUNT_TYPE', value: 'Normal' }
      ),
      fetchAllArchiveRows<MixCountDetailRow>(
        'mix_INVENTORY_COUNT_DETAILS_ARCHIVE',
        archiveId,
        DETAIL_SELECT,
        { column: 'COUNT_TYPE', value: 'DamageExpire' }
      ),
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', PRODUCT_SELECT),
    ]);

    const productMap = buildProductMap(products);
    const taggedDetails: Array<{ row: MixCountDetailRow; countType: CountType }> = [
      ...normalDetails.map((row) => ({ row, countType: 'Normal' as CountType })),
      ...damageDetails.map((row) => ({ row, countType: 'DamageExpire' as CountType })),
    ];

    taggedDetails.sort((a, b) => {
      const dateA = new Date(String(a.row.DATE || '')).getTime();
      const dateB = new Date(String(b.row.DATE || '')).getTime();
      return dateB - dateA;
    });

    const data: ICRecord[] = taggedDetails.flatMap(({ row, countType }) =>
      buildICRecords([row], productMap, countType)
    );

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in fetchArchivedAllICDetails:', error);
    return { success: false, error: 'Failed to fetch archived IC details', details: error.message };
  }
}

export async function fetchArchivedICFilterOptions(archiveId: string) {
  try {
    const details = await fetchAllArchiveRows<{
      USER: string | null;
      WAREHOUSE: string | null;
    }>('mix_INVENTORY_COUNT_DETAILS_ARCHIVE', archiveId, 'USER,WAREHOUSE');

    const userNames = new Set<string>();
    details.forEach((row) => {
      const name = String(row.USER || '').trim();
      if (name) userNames.add(name);
    });

    const warehouseNames = new Set<string>();
    details.forEach((row) => {
      const name = String(row.WAREHOUSE || '').trim();
      if (name) warehouseNames.add(name);
    });

    return {
      success: true,
      users: Array.from(userNames).sort((a, b) => a.localeCompare(b)),
      warehouses: Array.from(warehouseNames).sort((a, b) => a.localeCompare(b)),
    };
  } catch (error: any) {
    console.error('Error in fetchArchivedICFilterOptions:', error);
    return {
      success: false,
      users: [],
      warehouses: [],
      error: error.message,
    };
  }
}
