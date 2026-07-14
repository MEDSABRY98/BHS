'use server';

import { bhs_supabase } from '@/lib/supabase';
import {
  classifyMovement,
  getNetQtyEffect,
} from '../Components/locationTypes';

// Shared Types
type InventoryMoveRow = {
  ID?: string;
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
  'PRODUCT CATEGORY': string | null;
  'AVAILABLE QTY'?: number | null;
};

interface MoveMonthSummary {
  year: number;
  month: number;
  count: number;
}

export interface MoveDaySummary {
  date: string;
  day: number;
  count: number;
}

const INVENTORY_MOVE_SELECT = 'DATE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';

// Shared Helpers
function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

async function fetchAllInventoryRows<T>(
  table: string,
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
  return fetchAllInventoryRows<InventoryProductRow>('bhs_PRODUCTS', '*');
}

async function fetchInventoryMoves(): Promise<InventoryMoveRow[]> {
  return fetchAllInventoryRows<InventoryMoveRow>('web_INVENTORY_MOVES', INVENTORY_MOVE_SELECT, {
    order: { column: 'DATE', ascending: true },
  });
}

// ----------------------------------------------------------------------
// API: /api/Inventory
// ----------------------------------------------------------------------

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
  const hasMovesSet = new Set<string>();

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

    hasMovesSet.add(productId);

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

  return { salesMap, salesBreakdownMap, monthLabels, months, hasMovesSet };
}

export async function getProductOrdersData() {
  try {
    const [products, moveRows] = await Promise.all([
      fetchInventoryProducts(),
      fetchInventoryMoves(),
    ]);

    const { salesMap, salesBreakdownMap, monthLabels, months, hasMovesSet } = buildSalesMaps(moveRows);

    const data = products
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
          tags: row['PRODUCT CATEGORY']?.toString().trim() || '',
          qty: parseNum((row as any)['AVAILABLE QTY']),
          salesQty: salesMap.get(productId) || 0,
          salesBreakdown,
        };
      })
      .filter((row) => row.productName && hasMovesSet.has(row.productId));

    return { success: true, data };
  } catch (error: any) {
    console.error('Service Error getProductOrdersData:', error);
    return { success: false, error: 'Failed to fetch inventory data', details: error.message };
  }
}

export async function updateProductColumn(productId: string, columnName: string, value: unknown) {
  try {
    throw new Error(`Updating deprecated column: ${columnName}`);
  } catch (error: any) {
    console.error('Update Error:', error);
    return { success: false, error: 'Failed to update inventory', details: error.message };
  }
}

// ----------------------------------------------------------------------
// API: /api/Inventory/Movements
// ----------------------------------------------------------------------

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

export async function getProductMovementsData() {
  try {
    const { data, error } = await bhs_supabase.rpc('get_inventory_movements_summary');
    
    if (error) {
      console.warn('RPC failed or not found, falling back to manual fetch', error);
      const moveRows = await fetchInventoryMoves();
      const aggregated = aggregateMovements(moveRows);
      return { success: true, data: aggregated };
    }

    const movements: Record<string, { sales: number; returns: number; netPurchases: number }> = {};
    if (data) {
      data.forEach((row: any) => {
        if (row.product_id) {
          movements[row.product_id] = {
            sales: Number(row.sales) || 0,
            returns: Number(row.returns) || 0,
            netPurchases: Number(row.net_purchases) || 0
          };
        }
      });
    }

    return { success: true, data: movements };
  } catch (error: any) {
    console.error('API Error:', error);
    return { success: false, error: 'Failed to fetch movements data', details: error.message };
  }
}

// ----------------------------------------------------------------------
// API: /api/Inventory/ItemCodes
// ----------------------------------------------------------------------

export async function getItemCodesData() {
  try {
    const data = await fetchAllInventoryRows<{
      TAGS: string | null;
      'ITEM CODE': string | null;
      BARCODE: string | null;
    }>('web_INVENTORY_ITEM_CODE', 'TAGS,"ITEM CODE",BARCODE');

    const mapped = data
      .map((row) => ({
        tags: row.TAGS?.toString().trim() || '',
        itemCode: row['ITEM CODE']?.toString().trim() || '',
        barcode: row.BARCODE?.toString().trim() || '',
      }))
      .filter((entry) => entry.itemCode || entry.barcode);

    return { success: true, data: mapped };
  } catch (error: any) {
    console.error('Error fetching Item Codes:', error);
    return { success: false, error: 'Failed to fetch item codes', details: error.message };
  }
}

// ----------------------------------------------------------------------
// API: /api/Inventory/Details
// ----------------------------------------------------------------------

async function fetchInventoryMovesForProduct(productId: string): Promise<InventoryMoveRow[]> {
  return fetchAllInventoryRows<InventoryMoveRow>('web_INVENTORY_MOVES', INVENTORY_MOVE_SELECT, {
    order: { column: 'DATE', ascending: true },
    productId,
  });
}

export async function getSingleProductAnalysis(
  productId: string,
  filters?: { year?: string; month?: string; from?: string; to?: string; preset?: string }
) {
  try {
    const [moveRows, products] = await Promise.all([
      fetchInventoryMovesForProduct(productId),
      fetchInventoryProducts(),
    ]);

    const productRow = products.find((p) => p['PRODUCT ID']?.toString().trim() === productId.trim());
    if (!productRow) return { success: false, error: 'Product not found' };

    const currentStock = parseNum(productRow['AVAILABLE QTY']);

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
    const allPeriods: { key: string; label: string; sales: number; returns: number; purchases: number }[] = [];

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

    const data = {
      summary: { sales: totalSales, returns: totalReturns, returnsRate: returnsRate.toFixed(2), netPurchases, netFlow, currentStock },
      monthlyData: [...allPeriods].reverse(),
      granularity
    };
    return { success: true, data };
  } catch (error: any) {
    console.error('API Error:', error);
    return { success: false, error: 'Failed to fetch product analysis', details: error.message };
  }
}

// ----------------------------------------------------------------------
// API: /api/Inventory/MovesDb
// ----------------------------------------------------------------------

async function fetchAllMoveDates(options?: {
  dateStart?: string;
  dateEnd?: string;
}): Promise<{ DATE: string | null }[]> {
  const pageSize = 1000;
  let from = 0;
  const allRows: { DATE: string | null }[] = [];

  while (true) {
    let query = bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select('DATE')
      .order('DATE', { ascending: true });

    if (options?.dateStart) {
      query = query.gte('DATE', options.dateStart);
    }
    if (options?.dateEnd) {
      query = query.lt('DATE', options.dateEnd);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function deleteMatchingMoves(options: {
  dateStart: string;
  dateEnd: string;
}): Promise<void> {
  const pageSize = 1000;

  while (true) {
    const { data, error } = await bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select('ID')
      .gte('DATE', options.dateStart)
      .lt('DATE', options.dateEnd)
      .limit(pageSize);

    if (error) throw error;
    if (!data || data.length === 0) break;

    const ids = data.map((row) => row.ID).filter(Boolean);
    if (ids.length === 0) break;

    const { error: deleteError } = await bhs_supabase
      .from('web_INVENTORY_MOVES')
      .delete()
      .in('ID', ids);
    if (deleteError) throw deleteError;

    if (data.length < pageSize) break;
  }
}

function aggregateMonthsFromDates(rows: { DATE: string | null }[]): MoveMonthSummary[] {
  const counts = new Map<string, MoveMonthSummary>();

  for (const row of rows) {
    if (!row.DATE) continue;
    const d = new Date(row.DATE);
    if (Number.isNaN(d.getTime())) continue;

    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { year, month, count: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

function aggregateDaysFromDates(rows: { DATE: string | null }[]): MoveDaySummary[] {
  const counts = new Map<string, MoveDaySummary>();

  for (const row of rows) {
    if (!row.DATE) continue;
    const d = new Date(row.DATE);
    if (Number.isNaN(d.getTime())) continue;

    const date = d.toISOString().split('T')[0];
    const existing = counts.get(date);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(date, { date, day: d.getUTCDate(), count: 1 });
    }
  }

  return Array.from(counts.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export async function fetchMoveMonthsSummary() {
  try {
    const { data, error } = await bhs_supabase.rpc('get_inventory_moves_months_summary');
    if (!error && Array.isArray(data)) {
      const mapped = data.map((row: { year: number; month: number; count: number }) => ({
        year: Number(row.year),
        month: Number(row.month),
        count: Number(row.count),
      }));
      return { success: true, data: mapped };
    }

    const rows = await fetchAllMoveDates();
    return { success: true, data: aggregateMonthsFromDates(rows) };
  } catch (error: any) {
    console.error('Inventory moves months API error:', error);
    return { success: false, error: 'Failed to fetch inventory move summary', details: error.message };
  }
}

export async function fetchMoveDaysSummary(year: number, month: number) {
  try {
    if (!year || !month || month < 1 || month > 12) {
      return { success: false, error: 'Invalid year or month' };
    }
    const { data, error } = await bhs_supabase.rpc('get_inventory_moves_days_summary', {
      p_year: year,
      p_month: month,
    });

    if (!error && Array.isArray(data)) {
      const mapped = data.map((row: { date: string; day: number; count: number }) => ({
        date: String(row.date),
        day: Number(row.day),
        count: Number(row.count),
      }));
      return { success: true, data: mapped };
    }

    const { start, end } = monthDateRange(year, month);
    const rows = await fetchAllMoveDates({ dateStart: start, dateEnd: end });
    return { success: true, data: aggregateDaysFromDates(rows) };
  } catch (error: any) {
    console.error('Inventory moves days API error:', error);
    return { success: false, error: 'Failed to fetch inventory move days', details: error.message };
  }
}

function dayDateRange(dateKey: string) {
  const start = `${dateKey}T00:00:00.000Z`;
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const end = `${d.toISOString().split('T')[0]}T00:00:00.000Z`;
  return { start, end };
}

function monthDateRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`;
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = `${nextMonth.year}-${String(nextMonth.month).padStart(2, '0')}-01T00:00:00.000Z`;
  return { start, end };
}

export async function deleteMovesDb(date?: string | null, year?: number, month?: number) {
  try {
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { success: false, error: 'Invalid date' };
      }
      const { start, end } = dayDateRange(date);
      await deleteMatchingMoves({ dateStart: start, dateEnd: end });
      return { success: true };
    }

    if (!year || !month || month < 1 || month > 12) {
      return { success: false, error: 'Invalid year or month' };
    }

    const { start, end } = monthDateRange(year, month);
    await deleteMatchingMoves({ dateStart: start, dateEnd: end });

    return { success: true };
  } catch (error: any) {
    console.error('Inventory moves month delete API error:', error);
    return { success: false, error: 'Failed to delete inventory moves for month', details: error.message };
  }
}

export async function deleteAllInventoryMovesDb(): Promise<{ success: boolean; error?: string }> {
  try {
    const pageSize = 1000;
    while (true) {
      const { data, error } = await bhs_supabase
        .from('web_INVENTORY_MOVES')
        .select('ID')
        .limit(pageSize);

      if (error) throw error;
      if (!data || data.length === 0) break;

      const ids = data.map((row) => row.ID).filter(Boolean);
      if (ids.length === 0) break;

      const { error: deleteError } = await bhs_supabase
        .from('web_INVENTORY_MOVES')
        .delete()
        .in('ID', ids);
      if (deleteError) throw deleteError;

      if (data.length < pageSize) break;
    }
    return { success: true };
  } catch (error: any) {
    console.error('Inventory moves delete all API error:', error);
    return { success: false, error: error.message || 'Failed to delete all inventory moves' };
  }
}

// ----------------------------------------------------------------------
// Products Balance & Period Movement Calculation
// ----------------------------------------------------------------------

const formatCategory = (tag: string) => {
  if (!tag || tag === 'All' || tag === 'Uncategorized') return tag;
  const parts = tag.split('/');
  return parts[parts.length - 1].trim();
};

export interface ProductBalanceRow {
  productId: string;
  barcode: string;
  productName: string;
  category: string;
  openingStock: number;
  netVendors: number;
  netCustomers: number;
  netProduction: number;
  netSubcontracting: number;
  endingStock: number;
  periodMovements: Array<{
    date: string;
    reference: string;
    locationFrom: string;
    locationTo: string;
    qty: number;
    type: string;
  }>;
}

export async function getProductsBalanceReportData(filters?: { dateFrom?: string; dateTo?: string }) {
  try {
    const [products, moveRows] = await Promise.all([
      fetchInventoryProducts(),
      fetchAllInventoryRows<InventoryMoveRow>('web_INVENTORY_MOVES', 'ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY', {
        order: { column: 'DATE', ascending: true },
      }),
    ]);

    const dateFromStr = filters?.dateFrom ? filters.dateFrom.trim() : null;
    const dateToStr = filters?.dateTo ? filters.dateTo.trim() : null;

    const fromDate = dateFromStr ? new Date(`${dateFromStr}T00:00:00.000Z`) : null;
    const toDate = dateToStr ? new Date(`${dateToStr}T23:59:59.999Z`) : null;

    // Aggregate period movements & period opening stock strictly from web_INVENTORY_MOVES
    const productDataMap = new Map<string, {
      openingStock: number;
      netVendors: number;
      netCustomers: number;
      netProduction: number;
      netSubcontracting: number;
      periodMovements: Array<{
        date: string;
        reference: string;
        locationFrom: string;
        locationTo: string;
        qty: number;
        type: string;
      }>;
    }>();

    moveRows.forEach((row: any) => {
      const productId = row['PRODUCT ID']?.toString().trim();
      if (!productId) return;

      const dateStr = row.DATE ? String(row.DATE) : '';
      const moveDate = dateStr ? new Date(dateStr) : null;
      const qty = parseNum(row.QTY);
      const locFrom = row['LOCATION FROM']?.toString().trim() || '';
      const locTo = row['LOCATION TO']?.toString().trim() || '';
      const ref = row.REFERENCE?.toString().trim() || '-';

      if (!productDataMap.has(productId)) {
        productDataMap.set(productId, {
          openingStock: 0,
          netVendors: 0,
          netCustomers: 0,
          netProduction: 0,
          netSubcontracting: 0,
          periodMovements: [],
        });
      }

      const entry = productDataMap.get(productId)!;

      // Use centralized classifier from locationTypes.ts
      const type = classifyMovement(locFrom, locTo);

      // 1. If movement is BEFORE dateFrom -> Add to openingStock (purely from web_INVENTORY_MOVES)
      if (fromDate && moveDate && moveDate < fromDate) {
        entry.openingStock += getNetQtyEffect(locFrom, locTo, qty);
        return;
      }

      // 2. If movement is AFTER dateTo -> Ignore for current period
      if (toDate && moveDate && moveDate > toDate) {
        return;
      }

      // 3. Movement is WITHIN period [dateFrom, dateTo]
      if (type === 'purchase') entry.netVendors += qty;
      else if (type === 'vendor_return') entry.netVendors -= qty;
      else if (type === 'sale') entry.netCustomers -= qty;
      else if (type === 'customer_return') entry.netCustomers += qty;
      else if (type === 'production_in') entry.netProduction += qty;
      else if (type === 'production_out') entry.netProduction -= qty;
      else if (type === 'subcontracting_in') entry.netSubcontracting += qty;
      else if (type === 'subcontracting_out') entry.netSubcontracting -= qty;

      entry.periodMovements.push({
        date: dateStr,
        reference: ref,
        locationFrom: locFrom,
        locationTo: locTo,
        qty,
        type,
      });
    });

    const result = products.map((row) => {
      const productId = row['PRODUCT ID']?.toString().trim() || '';
      const barcode = row['PRODUCT BARCODE']?.toString().trim() || '';
      const productName = row['PRODUCT NAME']?.toString().trim() || '';
      const category = formatCategory(row['PRODUCT CATEGORY']?.toString().trim() || '');

      const calcData = productDataMap.get(productId) || {
        openingStock: 0,
        netVendors: 0,
        netCustomers: 0,
        netProduction: 0,
        netSubcontracting: 0,
        periodMovements: [],
      };

      const endingStock = calcData.openingStock + calcData.netVendors + calcData.netCustomers + calcData.netProduction + calcData.netSubcontracting;

      return {
        productId,
        barcode,
        productName,
        category,
        openingStock: calcData.openingStock,
        netVendors: calcData.netVendors,
        netCustomers: calcData.netCustomers,
        netProduction: calcData.netProduction,
        netSubcontracting: calcData.netSubcontracting,
        endingStock,
        periodMovements: calcData.periodMovements,
      };
    }).filter(p => p.productName && (productDataMap.has(p.productId) || p.endingStock !== 0 || p.openingStock !== 0));

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Service Error getProductsBalanceReportData:', error);
    return { success: false, error: 'Failed to fetch products balance data', details: error.message };
  }
}

/**
 * Calculates current available stock for all products strictly from web_INVENTORY_MOVES.
 * Internal Warehouses: defined in locationTypes.ts (INTERNAL_WAREHOUSES)
 * Returns a Map<productId, currentAvailableQty>
 */
export async function getLiveAvailableQuantitiesFromMoves(): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();

  const moves = await fetchAllInventoryRows<InventoryMoveRow>(
    'web_INVENTORY_MOVES',
    'ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY'
  );

  for (const move of moves) {
    const productId = (move['PRODUCT ID'] || '').trim();
    if (!productId) continue;

    const qty = move.QTY || 0;
    const fromLoc = (move['LOCATION FROM'] || '').trim();
    const toLoc = (move['LOCATION TO'] || '').trim();

    const effect = getNetQtyEffect(fromLoc, toLoc, qty);
    if (effect !== 0) {
      stockMap.set(productId, (stockMap.get(productId) || 0) + effect);
    }
  }

  return stockMap;
}

/**
 * Calculates live current available stock for a single product strictly from web_INVENTORY_MOVES.
 */
export async function getProductAvailableQtyFromMoves(productId: string): Promise<number> {
  if (!productId) return 0;
  const map = await getLiveAvailableQuantitiesFromMoves();
  return map.get(productId.trim()) || 0;
}
