import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Core';
import { bhs_supabase } from '@/lib/supabase';

type InventoryMoveRow = {
  DATE: string | null;
  'LOCATION FROM': string | null;
  'LOCATION TO': string | null;
  'PRODUCT ID': string | null;
  QTY: number | null;
};

type InventoryProductRow = {
  ID: string;
  'PRODUCT ID': string;
  'PRODUCT BARCODE': string | null;
  'PRODUCT NAME': string;
  TAGS: string | null;
  'MIN Q BY CTN': number | null;
  'MAX Q BY CTN': number | null;
  QINC: number | null;
  'QTY ON HAND': number | null;
  'QTY FREE TO USE': number | null;
};

function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function fetchInventoryProducts(): Promise<InventoryProductRow[]> {
  const { data, error } = await bhs_supabase
    .from('web_INVENTORY_PRODUCTS')
    .select('*');

  if (error) throw error;
  return (data || []) as InventoryProductRow[];
}

async function fetchInventoryMoves(): Promise<InventoryMoveRow[]> {
  const { data, error } = await bhs_supabase
    .from('web_INVENTORY_MOVES')
    .select('*');

  if (error) throw error;
  return (data || []) as InventoryMoveRow[];
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
// INVENTORY
// ============================================================

export async function getInventoryData() {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Inventory!A:H`, // BARCODE, ITEM CODE, PRODUCT NAME, TAGS, TYPE, QTY IN BOX, WEIGHT, SIZE
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const data = rows.slice(1).map((row, index) => {
      return {
        rowIndex: index + 2,
        barcode: row[0] || '',
        itemCode: row[1] || '',
        productName: row[2] || '',
        tags: row[3] || '',
        type: row[4] || '',
        qtyInBox: row[5] ? parseInt(row[5]) : 0,
        weight: row[6] || '',
        size: row[7] || '',
      };
    }).filter(row => row.productName);

    return data;
  } catch (error) {
    console.error('Error fetching inventory data:', error);
    throw error;
  }
}

export async function updateInventoryItem(rowIndex: number, data: {
  barcode: string;
  itemCode: string;
  productName: string;
  tags: string;
  type: string;
  qtyInBox: number;
  weight: string;
  size: string;
}) {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const values = [[
      data.barcode,
      data.itemCode,
      data.productName,
      data.tags,
      data.type,
      data.qtyInBox,
      data.weight,
      data.size
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Inventory!A${rowIndex}:H${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
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
  qtyOnHand: number;
  qtyFreeToUse: number;
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
          qtyOnHand: parseNum(row['QTY ON HAND']),
          qtyFreeToUse: parseNum(row['QTY FREE TO USE']),
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

export async function updateProductOrderQinc(productId: string, qinc: number): Promise<{ success: boolean }> {
  return updateProductColumn(productId, 'qinc', qinc);
}

export async function updateProductOrderLimit(productId: string, field: 'minQ' | 'maxQ', value: number): Promise<{ success: boolean }> {
  return updateProductColumn(productId, field, value);
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
    const { data, error } = await bhs_supabase
      .from('web_INVENTORY_ITEM_CODE')
      .select('*');

    if (error) throw error;

    return (data || [])
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
      fetchInventoryMoves(),
      fetchInventoryProducts(),
    ]);

    if (moveRows.length === 0) return null;

    const productRow = products.find((p) => p['PRODUCT ID']?.toString().trim() === productId);
    const currentStock = parseNum(productRow?.['QTY ON HAND']);
    const minQ = parseNum(productRow?.['MIN Q BY CTN']);

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
// INVENTORY COUNT (IC)
// ============================================================

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

async function fetchICItems(sheetName: string): Promise<ICItem[]> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:F`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      productId: row[0] || '',
      barcodeName: row[1] || '',
      productName: row[2] || '',
      availableQty: parseFloat(row[3]?.toString().replace(/,/g, '') || '0'),
      qtyInBox: parseFloat(row[4]?.toString().replace(/,/g, '') || '0'),
      countedQty: parseFloat(row[5]?.toString().replace(/,/g, '') || '0'),
    })).filter(item => item.productName);
  } catch (error) {
    console.error(`Error fetching ${sheetName}:`, error);
    return [];
  }
}

async function fetchICRecords(sheetName: string): Promise<ICRecord[]> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:J`,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      rowId: row[0] || '',
      date: row[1] || '',
      user: row[2] || '',
      warehouse: row[3] || '',
      productId: row[4] || '',
      barcodeName: row[5] || '',
      productName: row[6] || '',
      qtyInBox: parseFloat(row[7]?.toString().replace(/,/g, '') || '0'),
      countDetails: row[8] || '',
      countedQty: parseFloat(row[9]?.toString().replace(/,/g, '') || '0'),
    })).filter(record => record.productName);
  } catch (error) {
    console.error(`Error fetching ${sheetName}:`, error);
    return [];
  }
}

export async function getNormalICTotal(): Promise<ICItem[]> {
  return fetchICItems('IC Total');
}

export async function getDamageICTotal(): Promise<ICItem[]> {
  return fetchICItems('IC Total - D & E');
}

export async function getNormalICRecord(): Promise<ICRecord[]> {
  return fetchICRecords('IC Record');
}

export async function getDamageICRecord(): Promise<ICRecord[]> {
  return fetchICRecords('IC Record - D & E');
}

export async function updateICItem(
  sheetName: string,
  productId: string,
  newValues: { barcodeName: string; productName: string; availableQty: number; qtyInBox: number }
): Promise<boolean> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Find row by product ID (Column A)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!A:A`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return false;

    const rowIndex = rows.findIndex(row => row[0]?.toString().trim() === productId);
    if (rowIndex === -1) return false;

    // Row index in sheet is 1-based, array index is 0-based
    const sheetRowIndex = rowIndex + 1;

    // Update Columns B, C, D, E
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${sheetName}'!B${sheetRowIndex}:E${sheetRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          newValues.barcodeName,
          newValues.productName,
          newValues.availableQty,
          newValues.qtyInBox
        ]],
      },
    });

    return true;
  } catch (error) {
    console.error(`Error updating IC item in ${sheetName}:`, error);
    throw error;
  }
}

