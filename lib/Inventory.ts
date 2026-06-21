import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Sheets/Core';
import { bhs_supabase } from '@/lib/supabase';
import { formatInventoryRecordId, parseRecordNum } from '@/app/DataBase/Utils/InventoryRecordIds';

type InventoryMoveRow = {
  DATE: string | null;
  'LOCATION FROM': string | null;
  'LOCATION TO': string | null;
  'PRODUCT ID': string | null;
  QTY: number | null;
};

const INVENTORY_MOVE_SELECT = 'DATE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';

type InventoryProductRow = {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT BARCODE': string | null;
  'PRODUCT NAME': string;
  TAGS: string | null;
  'MIN Q BY CTN': number | null;
  'MAX Q BY CTN': number | null;
  QINC: number | null;
  QTY: number | null;
};

function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function fetchAllInventoryRows<T>(
  table: 'web_INVENTORY_PRODUCTS' | 'web_INVENTORY_MOVES' | 'web_INVENTORY_ITEM_CODE',
  select: string,
  options?: {
    order?: { column: string; ascending?: boolean };
    productId?: string;
  }
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const allRows: T[] = [];

  while (true) {
    let query = bhs_supabase.from(table).select(select);

    if (options?.productId) {
      query = query.eq('PRODUCT ID', options.productId.trim());
    }

    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending ?? true });
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

async function fetchInventoryProducts(): Promise<InventoryProductRow[]> {
  return fetchAllInventoryRows<InventoryProductRow>('web_INVENTORY_PRODUCTS', '*');
}

async function fetchInventoryMoves(): Promise<InventoryMoveRow[]> {
  return fetchAllInventoryRows<InventoryMoveRow>('web_INVENTORY_MOVES', INVENTORY_MOVE_SELECT, {
    order: { column: 'DATE', ascending: true },
  });
}

async function fetchInventoryMovesForProduct(productId: string): Promise<InventoryMoveRow[]> {
  return fetchAllInventoryRows<InventoryMoveRow>('web_INVENTORY_MOVES', INVENTORY_MOVE_SELECT, {
    order: { column: 'DATE', ascending: true },
    productId,
  });
}

function buildSalesMaps(moveRows: InventoryMoveRow[]) {
  const now = new Date();
  const getMonthStart = (monthsAgo: number) => new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const months = [3, 2, 1, 0].map((i) => getMonthStart(i));
  const monthKeys = months.map((d) => `${d.getFullYear()}-${d.getMonth()}`);
  const monthLabels = months.map((d) => {
    const mon = d.toLocaleString('en-US', { month: 'short' });
    const yy = d.getFullYear().toString().slice(-2);
    return `${mon} ${yy}`;
  });

  const salesBreakdownMap = new Map<string, number[]>();
  const salesMap = new Map<string, number>();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(now.getDate() - 120);
  ninetyDaysAgo.setHours(0, 0, 0, 0);

  moveRows.forEach((row) => {
    const dateStr = row.DATE;
    const locationTo = row['LOCATION TO']?.toString().trim();
    if (!dateStr || locationTo !== 'Partners/Customers') return;

    const moveDate = new Date(dateStr);
    if (isNaN(moveDate.getTime())) return;

    const productId = row['PRODUCT ID']?.toString().trim();
    const qty = parseNum(row.QTY);
    if (!productId || qty === 0) return;

    if (moveDate >= ninetyDaysAgo) {
      salesMap.set(productId, (salesMap.get(productId) || 0) + qty);
    }

    const key = `${moveDate.getFullYear()}-${moveDate.getMonth()}`;
    const monthIndex = monthKeys.findIndex((k) => k === key);
    if (monthIndex !== -1) {
      const breakdown = salesBreakdownMap.get(productId) || new Array(months.length).fill(0);
      breakdown[monthIndex] += qty;
      salesBreakdownMap.set(productId, breakdown);
    }
  });

  return { salesMap, salesBreakdownMap, monthLabels, months };
}

function aggregateMovements(moveRows: InventoryMoveRow[]) {
  const movements: Record<string, { sales: number; returns: number; netPurchases: number }> = {};

  moveRows.forEach((row) => {
    const from = row['LOCATION FROM']?.toString().trim();
    const to = row['LOCATION TO']?.toString().trim();
    const productId = row['PRODUCT ID']?.toString().trim();
    const qty = parseNum(row.QTY);

    if (!productId || qty === 0) return;

    if (!movements[productId]) {
      movements[productId] = { sales: 0, returns: 0, netPurchases: 0 };
    }

    if (to === 'Partners/Customers') movements[productId].sales += qty;
    if (from === 'Partners/Customers') movements[productId].returns += qty;
    if (from === 'Partners/Vendors') movements[productId].netPurchases += qty;
    if (to === 'Partners/Vendors') movements[productId].netPurchases -= qty;
  });

  return movements;
}

// ============================================================
// PRODUCT ORDERS
// ============================================================

export interface ProductOrder {
  productId: string;
  barcode: string;
  productName: string;
  qinc: number;
  minQ?: number;
  maxQ?: number;
  tags: string;
  qty: number;
  salesQty: number;
  salesBreakdown: { label: string; qty: number }[];
}

export async function getProductOrdersData(): Promise<ProductOrder[]> {
  try {
    const [products, moveRows] = await Promise.all([
      fetchInventoryProducts(),
      fetchInventoryMoves(),
    ]);

    const { salesMap, salesBreakdownMap, monthLabels, months } = buildSalesMaps(moveRows);

    return products
      .map((row) => {
        const productId = row['PRODUCT ID']?.toString().trim() || '';
        const breakdownQtys = salesBreakdownMap.get(productId) || new Array(months.length).fill(0);
        const salesBreakdown = breakdownQtys.map((qty, idx) => ({
          label: monthLabels[idx],
          qty,
        }));

        return {
          productId,
          barcode: row['PRODUCT BARCODE']?.toString().trim() || '',
          productName: row['PRODUCT NAME']?.toString().trim() || '',
          minQ: parseNum(row['MIN Q BY CTN']),
          maxQ: parseNum(row['MAX Q BY CTN']),
          qinc: parseNum(row.QINC),
          tags: row.TAGS?.toString().trim() || '',
          qty: parseNum(row.QTY),
          salesQty: salesMap.get(productId) || 0,
          salesBreakdown,
        };
      })
      .filter((row) => row.productName);
  } catch (error) {
    console.error('Error fetching product orders data:', error);
    throw error;
  }
}

export async function updateProductColumn(productId: string, columnName: string, value: unknown): Promise<{ success: boolean }> {
  try {
    const columnMap: Record<string, string> = {
      minQ: 'MIN Q BY CTN',
      maxQ: 'MAX Q BY CTN',
      qinc: 'QINC',
    };

    const dbColumn = columnMap[columnName];
    if (!dbColumn) throw new Error(`Column for ${columnName} not found`);

    const { error } = await bhs_supabase
      .from('web_INVENTORY_PRODUCTS')
      .update({ [dbColumn]: parseNum(value) })
      .eq('PRODUCT ID', productId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error updating product column:', error);
    throw error;
  }
}

// ============================================================
// PRODUCT MOVEMENTS
// ============================================================

export async function getProductMovementsData() {
  try {
    const moveRows = await fetchInventoryMoves();
    return aggregateMovements(moveRows);
  } catch (error) {
    console.error('Error fetching movements data:', error);
    throw error;
  }
}

export async function getItemCodesData() {
  try {
    const data = await fetchAllInventoryRows<{
      TAGS: string | null;
      'ITEM CODE': string | null;
      BARCODE: string | null;
    }>('web_INVENTORY_ITEM_CODE', 'TAGS,"ITEM CODE",BARCODE');

    return data
      .map((row) => ({
        tags: row.TAGS?.toString().trim() || '',
        itemCode: row['ITEM CODE']?.toString().trim() || '',
        barcode: row.BARCODE?.toString().trim() || '',
      }))
      .filter((entry) => entry.itemCode || entry.barcode);
  } catch (error) {
    console.error('Error fetching item codes:', error);
    throw error;
  }
}

export async function getSingleProductAnalysis(productId: string, filters?: { year?: string, month?: string, from?: string, to?: string, preset?: string }) {
  try {
    const [moveRows, products] = await Promise.all([
      fetchInventoryMovesForProduct(productId),
      fetchInventoryProducts(),
    ]);

    const productRow = products.find((p) => p['PRODUCT ID']?.toString().trim() === productId.trim());
    if (!productRow) return null;

    const currentStock = parseNum(productRow.QTY);
    const minQ = parseNum(productRow['MIN Q BY CTN']);

    let filterStart: Date | null = null;
    let filterEnd: Date | null = new Date();
    filterEnd.setHours(23, 59, 59, 999);

    if (filters?.preset && filters.preset !== 'all') {
      const now = new Date();
      if (filters.preset === '7days') filterStart = new Date(now.setDate(now.getDate() - 7));
      else if (filters.preset === '1month') filterStart = new Date(now.setMonth(now.getMonth() - 1));
      else if (filters.preset === '3months') filterStart = new Date(now.setMonth(now.getMonth() - 3));
      else if (filters.preset === '6months') filterStart = new Date(now.setMonth(now.getMonth() - 6));
      if (filterStart) filterStart.setHours(0, 0, 0, 0);
    } else if (filters?.from || filters?.to) {
      if (filters.from) filterStart = new Date(filters.from);
      if (filters.to) {
        filterEnd = new Date(filters.to);
        filterEnd.setHours(23, 59, 59, 999);
      }
    } else if (filters?.year || filters?.month) {
      const year = filters.year ? parseInt(filters.year) : new Date().getFullYear();
      if (filters.month) {
        const monthNum = parseInt(filters.month) - 1;
        filterStart = new Date(year, monthNum, 1);
        filterEnd = new Date(year, monthNum + 1, 0, 23, 59, 59, 999);
      } else {
        filterStart = new Date(year, 0, 1);
        filterEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      }
    }

    let minDate = filterStart;
    if (!minDate) {
      minDate = new Date();
      moveRows.forEach((row) => {
        const pid = row['PRODUCT ID']?.toString().trim();
        if (pid !== productId || !row.DATE) return;
        const d = new Date(row.DATE);
        if (!isNaN(d.getTime()) && d < minDate!) minDate = d;
      });
    }

    const isDaily = filters?.preset === '7days';
    const granularity = isDaily ? 'day' : 'month';

    let rangeStart: Date;
    if (isDaily) {
      rangeStart = new Date(filterStart!);
    } else {
      rangeStart = new Date(minDate!.getFullYear(), minDate!.getMonth(), 1);
    }

    const rangeEnd = filterEnd || new Date();
    const allPeriods: { key: string, label: string, sales: number, returns: number, purchases: number }[] = [];

    let tempDate = new Date(rangeStart);
    while (tempDate <= rangeEnd) {
      let key: string;
      let label: string;

      if (isDaily) {
        key = tempDate.toISOString().split('T')[0];
        label = tempDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      } else {
        key = `${tempDate.getFullYear()}-${tempDate.getMonth() + 1}`;
        label = tempDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      }

      allPeriods.push({ key, label, sales: 0, returns: 0, purchases: 0 });

      if (isDaily) tempDate.setDate(tempDate.getDate() + 1);
      else tempDate.setMonth(tempDate.getMonth() + 1);

      if (allPeriods.length > 400) break;
    }

    let totalSales = 0, totalReturns = 0, totalPurchases = 0, totalPurchaseReturns = 0;

    moveRows.forEach((row) => {
      const pid = row['PRODUCT ID']?.toString().trim();
      if (pid !== productId || !row.DATE) return;

      const from = row['LOCATION FROM']?.toString().trim();
      const to = row['LOCATION TO']?.toString().trim();
      const qty = parseNum(row.QTY);
      if (qty === 0) return;

      const moveDate = new Date(row.DATE);
      if (isNaN(moveDate.getTime())) return;

      if (filterStart && moveDate < filterStart) return;
      if (filterEnd && moveDate > filterEnd) return;

      let key: string;
      if (isDaily) key = moveDate.toISOString().split('T')[0];
      else key = `${moveDate.getFullYear()}-${moveDate.getMonth() + 1}`;

      if (to === 'Partners/Customers') {
        totalSales += qty;
        const pData = allPeriods.find((p) => p.key === key);
        if (pData) pData.sales += qty;
      }
      if (from === 'Partners/Customers') {
        totalReturns += qty;
        const pData = allPeriods.find((p) => p.key === key);
        if (pData) pData.returns += qty;
      }
      if (from === 'Partners/Vendors') {
        totalPurchases += qty;
        const pData = allPeriods.find((p) => p.key === key);
        if (pData) pData.purchases += qty;
      }
      if (to === 'Partners/Vendors') {
        totalPurchaseReturns += qty;
        const pData = allPeriods.find((p) => p.key === key);
        if (pData) pData.purchases -= qty;
      }
    });

    const netPurchases = totalPurchases - totalPurchaseReturns;
    const returnsRate = totalSales > 0 ? (totalReturns / totalSales) * 100 : 0;
    const netFlow = netPurchases - totalSales;

    return {
      summary: { sales: totalSales, returns: totalReturns, returnsRate: returnsRate.toFixed(2), netPurchases, netFlow, currentStock, minQ },
      monthlyData: [...allPeriods].reverse(),
      granularity
    };
  } catch (error) {
    console.error('Error fetching single product analysis:', error);
    throw error;
  }
}

// ============================================================
// INVENTORY COUNT (IC) — Supabase mix_* tables
// ============================================================

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
}

type MixCountProductRow = {
  ID: string;
  'PRODUCT ID': string;
  'BARCODE NAME': string | null;
  'PRODUCT NAME': string;
  'AVAILABLE QTY': number | null;
  'QTY IN BOX': number | null;
};

type MixCountTable =
  | 'mix_INVENTORY_COUNT_PRODUCTS'
  | 'mix_INVENTORY_COUNT_DETAILS'
  | 'mix_INVENTORY_COUNT_TOTALS';

function countTypeFromSheet(sheetName: string): CountType {
  return sheetName.includes('D & E') || sheetName.includes('D&E') ? 'DamageExpire' : 'Normal';
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
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function loadMixCountProductMap(): Promise<Map<string, MixCountProductRow>> {
  const products = await fetchAllMixCountRows<MixCountProductRow>('mix_INVENTORY_COUNT_PRODUCTS', '*');
  return new Map(products.map((p) => [p['PRODUCT ID']?.toString().trim(), p]));
}

async function fetchICTotal(countType: CountType): Promise<ICItem[]> {
  const [products, totals] = await Promise.all([
    fetchAllMixCountRows<MixCountProductRow>('mix_INVENTORY_COUNT_PRODUCTS', '*'),
    fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
      'mix_INVENTORY_COUNT_TOTALS',
      '"PRODUCT ID","COUNTED QTY"',
      { column: 'COUNT_TYPE', value: countType }
    ),
  ]);

  const totalMap = new Map(
    totals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
  );

  return products
    .map((p) => ({
      productId: p['PRODUCT ID']?.toString().trim() || '',
      barcodeName: p['BARCODE NAME']?.toString().trim() || '',
      productName: p['PRODUCT NAME']?.toString().trim() || '',
      availableQty: parseNum(p['AVAILABLE QTY']),
      qtyInBox: parseNum(p['QTY IN BOX']),
      countedQty: totalMap.get(p['PRODUCT ID']?.toString().trim()) || 0,
    }))
    .filter((item) => item.productName)
    .sort((a, b) => a.productName.localeCompare(b.productName));
}

async function fetchICDetails(countType: CountType): Promise<ICRecord[]> {
  const [details, productMap] = await Promise.all([
    fetchAllMixCountRows<{
      ID: string;
      DATE: string | null;
      USER: string | null;
      WAREHOUSE: string | null;
      'PRODUCT ID': string;
      'QTY IN BOX': number | null;
      'COUNT DETAILS': string | null;
      'COUNTED QTY': number | null;
    }>('mix_INVENTORY_COUNT_DETAILS', '*', { column: 'COUNT_TYPE', value: countType }),
    loadMixCountProductMap(),
  ]);

  return details
    .map((row) => {
      const productId = row['PRODUCT ID']?.toString().trim() || '';
      const product = productMap.get(productId);
      return {
        rowId: row.ID || '',
        date: row.DATE || '',
        user: row.USER?.toString().trim() || '',
        warehouse: row.WAREHOUSE?.toString().trim() || '',
        productId,
        barcodeName: product?.['BARCODE NAME']?.toString().trim() || '',
        productName: product?.['PRODUCT NAME']?.toString().trim() || '',
        qtyInBox: parseNum(row['QTY IN BOX'] ?? product?.['QTY IN BOX']),
        countDetails: row['COUNT DETAILS']?.toString() || '',
        countedQty: parseNum(row['COUNTED QTY']),
      };
    })
    .filter((record) => record.productId);
}

export async function getNormalICTotal(): Promise<ICItem[]> {
  return fetchICTotal('Normal');
}

export async function getDamageICTotal(): Promise<ICItem[]> {
  return fetchICTotal('DamageExpire');
}

export async function getNormalICRecord(): Promise<ICRecord[]> {
  return fetchICDetails('Normal');
}

export async function getDamageICRecord(): Promise<ICRecord[]> {
  return fetchICDetails('DamageExpire');
}

export async function updateICItem(
  _sheetName: string,
  productId: string,
  newValues: { barcodeName: string; productName: string; availableQty: number; qtyInBox: number }
): Promise<boolean> {
  const { data, error } = await bhs_supabase
    .from('mix_INVENTORY_COUNT_PRODUCTS')
    .update({
      'BARCODE NAME': newValues.barcodeName.trim(),
      'PRODUCT NAME': newValues.productName.trim(),
      'AVAILABLE QTY': parseNum(newValues.availableQty),
      'QTY IN BOX': parseNum(newValues.qtyInBox),
    })
    .eq('PRODUCT ID', productId.trim())
    .select('ID');

  if (error) throw error;
  return !!(data && data.length > 0);
}

async function fetchICSheetRows(sheetName: string, range: string): Promise<string[][]> {
  const credentials = getServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!${range}`,
  });
  return (response.data.values as string[][]) || [];
}

async function buildAndUpsertICProducts(sheetNames: string[]): Promise<{
  productMap: Map<string, { barcode: string; name: string; availableQty: number; qtyInBox: number }>;
  count: number;
}> {
  const productMap = new Map<
    string,
    { barcode: string; name: string; availableQty: number; qtyInBox: number }
  >();

  for (const sheetName of sheetNames) {
    const rows = await fetchICSheetRows(sheetName, 'A2:E');
    for (const row of rows) {
      const productId = row[0]?.toString().trim();
      const name = row[2]?.toString().trim();
      if (!productId || !name) continue;
      if (!productMap.has(productId) || sheetName === 'IC Total') {
        productMap.set(productId, {
          barcode: row[1]?.toString().trim() || '',
          name,
          availableQty: parseNum(row[3]),
          qtyInBox: parseNum(row[4]),
        });
      }
    }
  }

  const existingProducts = await fetchAllMixCountRows<{ ID: string; 'PRODUCT ID': string }>(
    'mix_INVENTORY_COUNT_PRODUCTS',
    'ID,"PRODUCT ID"'
  );
  const existingIdByProductId = new Map(
    existingProducts.map((row) => [row['PRODUCT ID']?.toString().trim(), row.ID])
  );

  let productIdCounter = 0;
  existingProducts.forEach((row) => {
    const num = parseRecordNum(row.ID);
    if (num !== null && num > productIdCounter) productIdCounter = num;
  });

  const productRows = Array.from(productMap.entries()).map(([productId, info]) => {
    const existingId = existingIdByProductId.get(productId);
    if (!existingId) {
      productIdCounter += 1;
    }
    return {
      ID: existingId || formatInventoryRecordId(productIdCounter),
      'PRODUCT ID': productId,
      'BARCODE NAME': info.barcode,
      'PRODUCT NAME': info.name,
      'AVAILABLE QTY': info.availableQty,
      'QTY IN BOX': info.qtyInBox,
    };
  });

  if (productRows.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < productRows.length; i += chunkSize) {
      const chunk = productRows.slice(i, i + chunkSize);
      const { error } = await bhs_supabase.from('mix_INVENTORY_COUNT_PRODUCTS').upsert(chunk, {
        onConflict: 'PRODUCT ID',
      });
      if (error) throw error;
    }
  }

  return { productMap, count: productRows.length };
}

export async function migrateICProductsFromGoogleSheets(): Promise<{ products: number }> {
  const { count } = await buildAndUpsertICProducts(['IC Total']);
  return { products: count };
}

export async function migrateICFromGoogleSheets(): Promise<{
  products: number;
  details: number;
  totals: number;
}> {
  const { productMap, count: productsCount } = await buildAndUpsertICProducts([
    'IC Total',
    'IC Total - D & E',
  ]);

  let detailIdCounter = 0;
  const existingDetails = await fetchAllMixCountRows<{ ID: string }>('mix_INVENTORY_COUNT_DETAILS', 'ID');
  existingDetails.forEach((row) => {
    const num = parseRecordNum(row.ID);
    if (num !== null && num > detailIdCounter) detailIdCounter = num;
  });

  const detailRows: Record<string, unknown>[] = [];
  const validProductIds = new Set(productMap.keys());

  for (const sheetName of ['IC Record', 'IC Record - D & E']) {
    const countType = countTypeFromSheet(sheetName);
    const rows = await fetchICSheetRows(sheetName, 'A2:J');
    for (const row of rows) {
      const productId = row[4]?.toString().trim();
      if (!productId || !validProductIds.has(productId)) continue;
      const countedQty = parseNum(row[9]);
      if (!row[0] && countedQty === 0) continue;

      detailIdCounter += 1;
      detailRows.push({
        ID: row[0]?.toString().trim() || formatInventoryRecordId(detailIdCounter),
        COUNT_TYPE: countType,
        DATE: row[1] ? new Date(row[1]).toISOString() : null,
        USER: row[2]?.toString().trim() || '',
        WAREHOUSE: row[3]?.toString().trim() || '',
        'PRODUCT ID': productId,
        'QTY IN BOX': parseNum(row[7]),
        'COUNT DETAILS': row[8]?.toString() || '',
        'COUNTED QTY': countedQty,
      });
    }
  }

  if (detailRows.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < detailRows.length; i += chunkSize) {
      const chunk = detailRows.slice(i, i + chunkSize);
      const { error } = await bhs_supabase.from('mix_INVENTORY_COUNT_DETAILS').upsert(chunk, {
        onConflict: 'ID',
      });
      if (error) throw error;
    }
  }

  await bhs_supabase.from('mix_INVENTORY_COUNT_TOTALS').delete().neq('ID', '');

  let totalIdCounter = 0;
  for (const countType of ['Normal', 'DamageExpire'] as CountType[]) {
    const { data: sums, error } = await bhs_supabase
      .from('mix_INVENTORY_COUNT_DETAILS')
      .select('"PRODUCT ID","COUNTED QTY"')
      .eq('COUNT_TYPE', countType);
    if (error) throw error;

    const totalByProduct = new Map<string, number>();
    (sums || []).forEach((row) => {
      const pid = row['PRODUCT ID']?.toString().trim();
      if (!pid) return;
      totalByProduct.set(pid, (totalByProduct.get(pid) || 0) + parseNum(row['COUNTED QTY']));
    });

    const totalRows = Array.from(totalByProduct.entries())
      .filter(([, qty]) => qty !== 0)
      .map(([productId, qty]) => {
        totalIdCounter += 1;
        return {
          ID: formatInventoryRecordId(totalIdCounter),
          'PRODUCT ID': productId,
          COUNT_TYPE: countType,
          'COUNTED QTY': qty,
        };
      });

    if (totalRows.length > 0) {
      const { error: insertErr } = await bhs_supabase.from('mix_INVENTORY_COUNT_TOTALS').insert(totalRows);
      if (insertErr) throw insertErr;
    }
  }

  const { count: totalsCount } = await bhs_supabase
    .from('mix_INVENTORY_COUNT_TOTALS')
    .select('ID', { count: 'exact', head: true });

  return {
    products: productsCount,
    details: detailRows.length,
    totals: totalsCount || 0,
  };
}

