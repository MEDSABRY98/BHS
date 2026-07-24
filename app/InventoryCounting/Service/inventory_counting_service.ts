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

const PRODUCT_SELECT = '"PRODUCT ID","PRODUCT BARCODE","PRODUCT NAME","QTY IN BOX"';
const DETAIL_SELECT =
  'ID,DATE,USER,WAREHOUSE,"PRODUCT ID","QTY IN BOX","COUNT DETAILS","COUNTED QTY"';

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
