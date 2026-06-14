import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Core';

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
  rowIndex: number;
  salesBreakdown: { label: string; qty: number }[];
}

export async function getProductOrdersData(): Promise<ProductOrder[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const [inventoryResponse, movesResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Inventory - PRODUCTS'!A:Z`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Inventory - MOVES'!A:I`,
      })
    ]);

    const now = new Date();
    const getMonthStart = (monthsAgo: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      return d;
    };

    const months = [3, 2, 1, 0].map(i => getMonthStart(i));
    const monthKeys = months.map(d => `${d.getFullYear()}-${d.getMonth()}`);
    const monthLabels = months.map(d => {
      const mon = d.toLocaleString('en-US', { month: 'short' });
      const yy = d.getFullYear().toString().slice(-2);
      return `${mon} ${yy}`;
    });

    const salesBreakdownMap = new Map<string, number[]>();
    const salesMap = new Map<string, number>();

    const moveRows = movesResponse.data.values || [];

    let dateIndex = 0;
    let productIdIndex = 4;
    let qtyIndex = 8;
    let toIndex = 3;

    if (moveRows.length > 0) {
      const header = moveRows[0].map(h => h.toString().toLowerCase().trim());
      const foundDate = header.findIndex(h => h === 'date');
      if (foundDate !== -1) dateIndex = foundDate;
      const foundProduct = header.findIndex(h => h === 'product id');
      if (foundProduct !== -1) productIdIndex = foundProduct;
      const foundQty = header.findIndex(h => h === 'qty');
      if (foundQty !== -1) qtyIndex = foundQty;
      const foundTo = header.findIndex(h => h === 'location to');
      if (foundTo !== -1) toIndex = foundTo;
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 120);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    moveRows.slice(1).forEach(row => {
      const dateStr = row[dateIndex]?.toString().trim();
      const locationTo = row[toIndex]?.toString().trim();
      if (!dateStr || locationTo !== 'Partners/Customers') return;

      const moveDate = new Date(dateStr);
      if (isNaN(moveDate.getTime())) return;

      const productId = row[productIdIndex]?.toString().trim();
      const qtyStr = row[qtyIndex]?.toString().replace(/,/g, '') || '0';
      const qty = parseFloat(qtyStr);

      if (!productId || isNaN(qty)) return;

      if (moveDate >= ninetyDaysAgo) {
        salesMap.set(productId, (salesMap.get(productId) || 0) + qty);
      }

      const key = `${moveDate.getFullYear()}-${moveDate.getMonth()}`;
      const monthIndex = monthKeys.findIndex(k => k === key);

      if (monthIndex !== -1) {
        const breakdown = salesBreakdownMap.get(productId) || new Array(months.length).fill(0);
        breakdown[monthIndex] += qty;
        salesBreakdownMap.set(productId, breakdown);
      }
    });

    const rows = inventoryResponse.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const invHeader = rows[0].map((h: string) => h.toString().toLowerCase().trim());
    const idx = {
      id: invHeader.findIndex((h: string) => h === 'product id' || h.includes('id') || h.includes('code')),
      barcode: invHeader.findIndex((h: string) => h === 'product barcode' || h.includes('barcode')),
      name: invHeader.findIndex((h: string) => h === 'product name' || ((h.includes('name') || h.includes('product') || h.includes('item')) && !h.includes('id') && !h.includes('code'))),
      minQ: invHeader.findIndex((h: string) => h === 'min q by ctn' || h.includes('min q') || h.includes('min')),
      maxQ: invHeader.findIndex((h: string) => h === 'max q by ctn' || h.includes('max q') || h.includes('max')),
      qinc: invHeader.findIndex((h: string) => h === 'qinc'),
      tags: invHeader.findIndex((h: string) => h === 'tags' || h.includes('tag')),
      onHand: invHeader.findIndex((h: string) => h === 'qty' || h.includes('on hand') || h.includes('stock')),
      free: invHeader.findIndex((h: string) => h === 'qty' || h.includes('free') || h.includes('avail'))
    };

    if (idx.id === -1) idx.id = 0;
    if (idx.barcode === -1) idx.barcode = 1;
    if (idx.name === -1) idx.name = 2;
    if (idx.tags === -1) idx.tags = 3;
    if (idx.minQ === -1) idx.minQ = 4;
    if (idx.maxQ === -1) idx.maxQ = 5;
    if (idx.qinc === -1) idx.qinc = 6;
    if (idx.onHand === -1) idx.onHand = 7;
    if (idx.free === -1) idx.free = 7;

    const data = rows.slice(1).map((row, index) => {
      let productId = row[idx.id]?.toString().trim() || '';
      const barcode = row[idx.barcode]?.toString().trim() || '';
      const productName = row[idx.name]?.toString().trim() || '';

      if (!productId) {
        if (barcode) productId = `BAR-${barcode}`;
        else if (productName) productId = `NAME-${productName.replace(/\s+/g, '_')}`;
        else productId = `ROW-${index}`;
      }

      const breakdownQtys = salesBreakdownMap.get(productId) || new Array(months.length).fill(0);
      const salesBreakdown = breakdownQtys.map((qty, idx) => ({
        label: monthLabels[idx],
        qty: qty
      }));

      return {
        productId,
        barcode,
        productName,
        minQ: parseFloat(row[idx.minQ]?.toString().replace(/,/g, '') || '0'),
        maxQ: parseFloat(row[idx.maxQ]?.toString().replace(/,/g, '') || '0'),
        qinc: parseFloat(row[idx.qinc]?.toString().replace(/,/g, '') || '0'),
        tags: row[idx.tags]?.toString().trim() || '',
        qtyOnHand: parseFloat(row[idx.onHand]?.toString().replace(/,/g, '') || '0'),
        qtyFreeToUse: parseFloat(row[idx.free]?.toString().replace(/,/g, '') || '0'),
        salesQty: salesMap.get(productId) || 0,
        rowIndex: index + 2,
        salesBreakdown
      };
    }).filter(row => row.productName);

    return data;
  } catch (error) {
    console.error('Error fetching product orders data:', error);
    throw error;
  }
}

export async function updateProductColumn(rowIndex: number, columnName: string, value: any): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Inventory - PRODUCTS'!1:1`,
    });
    const header = (headerRes.data.values?.[0] || []).map((h: string) => h.toLowerCase().trim());

    let colIndex = -1;
    if (columnName === 'qinc') colIndex = header.findIndex((h: string) => h === 'qinc');
    else if (columnName === 'minQ') colIndex = header.findIndex((h: string) => h.includes('min q') || h.includes('min'));
    else if (columnName === 'maxQ') colIndex = header.findIndex((h: string) => h.includes('max q') || h.includes('max'));

    if (colIndex === -1) {
      if (columnName === 'minQ') colIndex = 4;
      else if (columnName === 'maxQ') colIndex = 5;
      else if (columnName === 'qinc') colIndex = 6;
    }

    if (colIndex === -1) throw new Error(`Column for ${columnName} not found`);

    const getColLetter = (index: number) => {
      let letter = '';
      while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    };

    const colLetter = getColLetter(colIndex);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Inventory - PRODUCTS'!${colLetter}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[value]],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating product column:', error);
    throw error;
  }
}

export async function updateProductOrderQinc(rowIndex: number, qinc: number): Promise<{ success: boolean }> {
  return updateProductColumn(rowIndex, 'qinc', qinc);
}

export async function updateProductOrderLimit(rowIndex: number, field: 'minQ' | 'maxQ', value: number): Promise<{ success: boolean }> {
  return updateProductColumn(rowIndex, field, value);
}

// ============================================================
// PRODUCT MOVEMENTS
// ============================================================

export async function getProductMovementsData() {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Inventory - MOVES'!A:I`,
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return {};

    const header = rows[0].map((h: string) => h.toLowerCase().trim());
    const idx = {
      from: header.indexOf('location from'),
      to: header.indexOf('location to'),
      productId: header.indexOf('product id'),
      qty: header.indexOf('qty')
    };

    if (idx.from === -1) idx.from = 2;
    if (idx.to === -1) idx.to = 3;
    if (idx.productId === -1) idx.productId = 4;
    if (idx.qty === -1) idx.qty = 8;

    const movements: Record<string, { sales: number; returns: number; netPurchases: number }> = {};

    rows.slice(1).forEach(row => {
      const from = row[idx.from]?.toString().trim();
      const to = row[idx.to]?.toString().trim();
      const productId = row[idx.productId]?.toString().trim();
      const qtyStr = row[idx.qty]?.toString().replace(/,/g, '') || '0';
      const qty = parseFloat(qtyStr);

      if (!productId || isNaN(qty)) return;

      if (!movements[productId]) {
        movements[productId] = { sales: 0, returns: 0, netPurchases: 0 };
      }

      if (to === 'Partners/Customers') movements[productId].sales += qty;
      if (from === 'Partners/Customers') movements[productId].returns += qty;
      if (from === 'Partners/Vendors') movements[productId].netPurchases += qty;
      if (to === 'Partners/Vendors') movements[productId].netPurchases -= qty;
    });

    return movements;
  } catch (error) {
    console.error('Error fetching movements data:', error);
    throw error;
  }
}

export async function getSingleProductAnalysis(productId: string, filters?: { year?: string, month?: string, from?: string, to?: string, preset?: string }) {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const [movesResponse, productsResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Inventory - MOVES'!A:I`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Inventory - PRODUCTS'!A:Z`,
      })
    ]);

    const rows = movesResponse.data.values || [];
    if (rows.length === 0) return null;

    const prodRows = productsResponse.data.values || [];
    let currentStock = 0;
    let minQ = 0;

    if (prodRows.length > 0) {
      const pHeader = prodRows[0].map(h => h.toString().toLowerCase().trim());
      const pIdx = {
        id: pHeader.findIndex(h => h === 'product id' || h.includes('id') || h.includes('code')),
        stock: pHeader.findIndex(h => h === 'qty'),
        min: pHeader.findIndex(h => h === 'min q' || h.includes('min'))
      };

      if (pIdx.stock === -1) {
        pIdx.stock = pHeader.findIndex(h => h.includes('on hand') || h.includes('stock'));
      }

      const productRow = prodRows.slice(1).find(r => r[pIdx.id]?.toString().trim() === productId);
      if (productRow) {
        currentStock = parseFloat(productRow[pIdx.stock]?.toString().replace(/,/g, '') || '0');
        minQ = parseFloat(productRow[pIdx.min]?.toString().replace(/,/g, '') || '0');
      }
    }

    const header = rows[0].map((h: string) => h.toLowerCase().trim());
    const idx = {
      date: header.indexOf('date'),
      from: header.indexOf('location from'),
      to: header.indexOf('location to'),
      productId: header.indexOf('product id'),
      qty: header.indexOf('qty')
    };

    if (idx.date === -1) idx.date = 0;
    if (idx.from === -1) idx.from = 2;
    if (idx.to === -1) idx.to = 3;
    if (idx.productId === -1) idx.productId = 4;
    if (idx.qty === -1) idx.qty = 8;

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
      rows.slice(1).forEach(row => {
        const pid = row[idx.productId]?.toString().trim();
        if (pid !== productId) return;
        const dateStr = row[idx.date]?.toString().trim();
        const d = new Date(dateStr);
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

    rows.slice(1).forEach(row => {
      const pid = row[idx.productId]?.toString().trim();
      if (pid !== productId) return;

      const dateStr = row[idx.date]?.toString().trim();
      const from = row[idx.from]?.toString().trim();
      const to = row[idx.to]?.toString().trim();
      const qty = parseFloat(row[idx.qty]?.toString().replace(/,/g, '') || '0');
      if (isNaN(qty)) return;

      const moveDate = new Date(dateStr);
      if (isNaN(moveDate.getTime())) return;

      if (filterStart && moveDate < filterStart) return;
      if (filterEnd && moveDate > filterEnd) return;

      let key: string;
      if (isDaily) key = moveDate.toISOString().split('T')[0];
      else key = `${moveDate.getFullYear()}-${moveDate.getMonth() + 1}`;

      if (to === 'Partners/Customers') {
        totalSales += qty;
        const pData = allPeriods.find(p => p.key === key);
        if (pData) pData.sales += qty;
      }
      if (from === 'Partners/Customers') {
        totalReturns += qty;
        const pData = allPeriods.find(p => p.key === key);
        if (pData) pData.returns += qty;
      }
      if (from === 'Partners/Vendors') {
        totalPurchases += qty;
        const pData = allPeriods.find(p => p.key === key);
        if (pData) pData.purchases += qty;
      }
      if (to === 'Partners/Vendors') {
        totalPurchaseReturns += qty;
        const pData = allPeriods.find(p => p.key === key);
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

