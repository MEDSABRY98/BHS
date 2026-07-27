'use server';

import { bhs_supabase } from '@/lib/supabase';
import {
  getNetQtyEffect,
  INTERNAL_WAREHOUSES_SET,
  isInternalTransfer,
  WA_WH_WATER,
  formatProductCategory,
} from '../Components/locationTypes';

// Shared Types
type InventoryMoveRow = {
  ID?: string;
  DATE: string | null;
  REFERENCE?: string | null;
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

/**
 * Fetches ALL inventory move rows using cursor-based pagination (stable).
 * Uses ID as the cursor so that sorting is fully deterministic even on 90k+ rows.
 * Offset pagination is NOT used here because DATE has many ties, causing rows
 * to be skipped or duplicated at page boundaries with large datasets.
 */
async function fetchAllInventoryMovesStable(): Promise<InventoryMoveRow[]> {
  const pageSize = 1000;
  const allRows: InventoryMoveRow[] = [];
  let lastId: string | null = null;

  const SELECT = 'ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';

  while (true) {
    let query = bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select(SELECT)
      .order('ID', { ascending: true })
      .limit(pageSize);

    if (lastId !== null) {
      query = query.gt('ID', lastId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...(data as InventoryMoveRow[]));
    lastId = String((data[data.length - 1] as any).ID ?? '');
    if (data.length < pageSize) break;
  }

  return allRows;
}


async function fetchInventoryProducts(): Promise<InventoryProductRow[]> {
  return fetchAllInventoryRows<InventoryProductRow>('bhs_PRODUCTS', '*');
}

export async function getProductNamesByIds(productIds: string[]) {
  try {
    const uniqueIds = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
    if (uniqueIds.length === 0) {
      return { success: true as const, data: {} as Record<string, string> };
    }

    const nameMap: Record<string, string> = {};
    const chunkSize = 200;

    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
      const chunk = uniqueIds.slice(i, i + chunkSize);
      const { data, error } = await bhs_supabase
        .from('bhs_PRODUCTS')
        .select('"PRODUCT ID","PRODUCT NAME"')
        .in('PRODUCT ID', chunk);

      if (error) throw error;

      (data || []).forEach((row: { 'PRODUCT ID'?: string | null; 'PRODUCT NAME'?: string | null }) => {
        const productId = row['PRODUCT ID']?.toString().trim();
        if (!productId) return;
        nameMap[productId] = row['PRODUCT NAME']?.toString().trim() || '';
      });
    }

    return { success: true as const, data: nameMap };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch product names';
    console.error('Service Error getProductNamesByIds:', error);
    return { success: false as const, error: message };
  }
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
    // Try RPC first (fast — computed in PostgreSQL)
    const { data: rpcData, error: rpcError } = await bhs_supabase.rpc('get_inventory_product_orders');

    if (!rpcError && rpcData && rpcData.success) {
      if (Array.isArray(rpcData.data)) {
        return {
          ...rpcData,
          data: rpcData.data.map((row: { tags?: string }) => ({
            ...row,
            tags: formatProductCategory(row.tags || ''),
          })),
        };
      }
      return rpcData;
    }

    console.warn('RPC get_inventory_product_orders failed, falling back to JS:', rpcError?.message);

    // Fallback: fetch all data and compute in JS
    const [products, moveRows] = await Promise.all([
      fetchInventoryProducts(),
      fetchInventoryMoves(),
    ]);

    const { salesMap, salesBreakdownMap, monthLabels, months, hasMovesSet } = buildSalesMaps(moveRows);
    const stockMap = new Map<string, number>();
    for (const move of moveRows) {
      const productId = (move['PRODUCT ID'] || '').trim();
      if (!productId) continue;
      const effect = getNetQtyEffect(
        (move['LOCATION FROM'] || '').trim(),
        (move['LOCATION TO'] || '').trim(),
        parseNum(move.QTY),
      );
      if (effect !== 0) {
        stockMap.set(productId, (stockMap.get(productId) || 0) + effect);
      }
    }

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
          tags: formatProductCategory(row['PRODUCT CATEGORY']?.toString().trim() || ''),
          qty: stockMap.get(productId) || 0,
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
    // Try RPC first (fast — computed in PostgreSQL)
    const { data: rpcData, error: rpcError } = await bhs_supabase.rpc('get_inventory_product_analysis', {
      p_product_id: productId,
      p_year: filters?.year ? parseInt(filters.year) : null,
      p_month: filters?.month ? parseInt(filters.month) : null,
      p_date_from: filters?.from || null,
      p_date_to: filters?.to || null,
      p_preset: filters?.preset || 'all',
    });

    if (!rpcError && rpcData && rpcData.success) {
      return rpcData;
    }

    console.warn('RPC get_inventory_product_analysis failed, falling back to JS:', rpcError?.message);

    // Fallback: fetch all data and compute in JS
    const [moveRows, products] = await Promise.all([
      fetchInventoryMovesForProduct(productId),
      fetchInventoryProducts(),
    ]);

    const productRow = products.find((p) => p['PRODUCT ID']?.toString().trim() === productId.trim());
    if (!productRow) return { success: false, error: 'Product not found' };

    let endingBalance = 0;
    moveRows.forEach((row) => {
      const from = row['LOCATION FROM']?.toString().trim() || '';
      const to = row['LOCATION TO']?.toString().trim() || '';
      const qty = parseNum(row.QTY);
      endingBalance += getNetQtyEffect(from, to, qty);
    });

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
      summary: {
        sales: totalSales,
        returns: totalReturns,
        returnsRate: returnsRate.toFixed(2),
        netPurchases,
        netFlow,
        currentStock: endingBalance,
        endingBalance,
      },
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

    console.warn('RPC get_inventory_moves_months_summary failed, falling back to JS:', error?.message);

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

    console.warn('RPC get_inventory_moves_days_summary failed, falling back to JS:', error?.message);

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

export interface PeriodMovement {
  moveId?: string;
  date: string;
  reference: string;
  locationFrom: string;
  locationTo: string;
  qty: number;
  type: string;
}

export interface ProductBalanceRow {
  productId: string;
  barcode: string;
  productName: string;
  category: string;
  openingStock: number;
  netVendors: number;
  netCustomers: number;
  netProduction: number;
  netAdjustment: number;
  endingStock: number;
  periodMovements?: PeriodMovement[];
}

function classifyPeriodMovement(
  locFrom: string,
  locTo: string,
  qty: number,
  fromInternal: boolean,
  toInternal: boolean,
): { type: string; netVendors: number; netCustomers: number; netProduction: number; netAdjustment: number } | null {
  if (isInternalTransfer(locFrom, locTo)) {
    return { type: 'transfer', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
  }

  if (fromInternal && toInternal) {
    if (locFrom === WA_WH_WATER) {
      return { type: 'production_out', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
    }
    if (locTo === WA_WH_WATER) {
      return { type: 'production_in', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
    }
  }

  const isIn = toInternal;
  const isOut = fromInternal;
  if (!isIn && !isOut) return null;

  const otherLocation = isIn ? locFrom : locTo;
  if (isIn) {
    if (otherLocation === 'Partners/Vendors') return { type: 'vendor_in', netVendors: qty, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
    if (otherLocation === 'Partners/Customers') return { type: 'customer_return', netVendors: 0, netCustomers: qty, netProduction: 0, netAdjustment: 0 };
    if (otherLocation === 'Physical Locations/Subcontracting Location') return { type: 'subcontracting_in', netVendors: 0, netCustomers: 0, netProduction: qty, netAdjustment: 0 };
    if (otherLocation === 'Virtual Locations/Inventory adjustment') return { type: 'adjustment_in', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: qty };
    if (otherLocation === 'Virtual Locations/Production') return { type: 'production_in', netVendors: 0, netCustomers: 0, netProduction: qty, netAdjustment: 0 };
    return { type: 'production_in', netVendors: 0, netCustomers: 0, netProduction: qty, netAdjustment: 0 };
  }

  if (otherLocation === 'Partners/Customers') return { type: 'customer_sale', netVendors: 0, netCustomers: -qty, netProduction: 0, netAdjustment: 0 };
  if (otherLocation === 'Partners/Vendors') return { type: 'vendor_return', netVendors: -qty, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
  if (otherLocation === 'Physical Locations/Subcontracting Location') return { type: 'subcontracting_out', netVendors: 0, netCustomers: 0, netProduction: -qty, netAdjustment: 0 };
  if (otherLocation === 'Virtual Locations/Inventory adjustment') return { type: 'adjustment_out', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: -qty };
  if (otherLocation === 'Virtual Locations/Production') return { type: 'production_out', netVendors: 0, netCustomers: 0, netProduction: -qty, netAdjustment: 0 };
  return { type: 'production_out', netVendors: 0, netCustomers: 0, netProduction: -qty, netAdjustment: 0 };
}

async function fetchProductInventoryMoves(productId: string): Promise<InventoryMoveRow[]> {
  const pageSize = 1000;
  const allRows: InventoryMoveRow[] = [];
  let lastId: string | null = null;
  const SELECT = 'ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';

  while (true) {
    let query = bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select(SELECT)
      .eq('PRODUCT ID', productId.trim())
      .order('ID', { ascending: true })
      .limit(pageSize);

    if (lastId !== null) {
      query = query.gt('ID', lastId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...(data as InventoryMoveRow[]));
    lastId = String((data[data.length - 1] as any).ID ?? '');
    if (data.length < pageSize) break;
  }

  return allRows;
}

export async function getProductsBalanceReportData(filters?: { dateFrom?: string; dateTo?: string }) {
  try {
    // Compute in JS so warehouse rules in locationTypes.ts (incl. WA/WH/Water) stay authoritative.
    const [products, moveRows] = await Promise.all([
      fetchInventoryProducts(),
      fetchAllInventoryMovesStable(),
    ]);

    const dateFromStr = filters?.dateFrom ? filters.dateFrom.trim() : null;
    const dateToStr = filters?.dateTo ? filters.dateTo.trim() : null;

    const fromDate = dateFromStr ? new Date(`${dateFromStr}T00:00:00.000Z`) : null;
    const toDate = dateToStr ? new Date(`${dateToStr}T23:59:59.999Z`) : null;

    const productDataMap = new Map<string, {
      openingStock: number;
      netVendors: number;
      netCustomers: number;
      netProduction: number;
      netAdjustment: number;
    }>();

    moveRows.forEach((row: any) => {
      const productId = row['PRODUCT ID']?.toString().trim();
      if (!productId) return;

      const dateStr = row.DATE ? String(row.DATE) : '';
      const moveDate = dateStr ? new Date(dateStr) : null;
      const qty = parseNum(row.QTY);
      const locFrom = row['LOCATION FROM']?.toString().trim() || '';
      const locTo = row['LOCATION TO']?.toString().trim() || '';

      if (!productDataMap.has(productId)) {
        productDataMap.set(productId, {
          openingStock: 0,
          netVendors: 0,
          netCustomers: 0,
          netProduction: 0,
          netAdjustment: 0,
        });
      }

      const entry = productDataMap.get(productId)!;

      const fromInternal = INTERNAL_WAREHOUSES_SET.has(locFrom);
      const toInternal = INTERNAL_WAREHOUSES_SET.has(locTo);
      const effect = getNetQtyEffect(locFrom, locTo, qty);
      const classified = classifyPeriodMovement(locFrom, locTo, qty, fromInternal, toInternal);

      if (fromDate && moveDate && moveDate < fromDate) {
        entry.openingStock += effect;
        return;
      }

      if (toDate && moveDate && moveDate > toDate) {
        return;
      }

      if (!classified) return;

      entry.netVendors += classified.netVendors;
      entry.netCustomers += classified.netCustomers;
      entry.netProduction += classified.netProduction;
      entry.netAdjustment += classified.netAdjustment;
    });

    const result = products.map((row) => {
      const productId = row['PRODUCT ID']?.toString().trim() || '';
      const barcode = row['PRODUCT BARCODE']?.toString().trim() || '';
      const productName = row['PRODUCT NAME']?.toString().trim() || '';
      const category = formatProductCategory(row['PRODUCT CATEGORY']?.toString().trim() || '') || 'Uncategorized';

      const calcData = productDataMap.get(productId) || {
        openingStock: 0,
        netVendors: 0,
        netCustomers: 0,
        netProduction: 0,
        netAdjustment: 0,
      };

      const endingStock = calcData.openingStock + calcData.netVendors + calcData.netCustomers + calcData.netProduction + calcData.netAdjustment;

      return {
        productId,
        barcode,
        productName,
        category,
        openingStock: calcData.openingStock,
        netVendors: calcData.netVendors,
        netCustomers: calcData.netCustomers,
        netProduction: calcData.netProduction,
        netAdjustment: calcData.netAdjustment,
        endingStock,
      };
    }).filter(p => p.productName && (productDataMap.has(p.productId) || p.endingStock !== 0 || p.openingStock !== 0));

    return { success: true, data: result };
  } catch (error: any) {
    console.error('Service Error getProductsBalanceReportData:', error);
    return { success: false, error: 'Failed to fetch products balance data', details: error.message };
  }
}

export async function getProductPeriodMovements(
  productId: string,
  filters?: { dateFrom?: string; dateTo?: string },
) {
  try {
    const trimmedId = productId?.trim();
    if (!trimmedId) {
      return { success: false, error: 'Product ID is required' };
    }

    const dateFromStr = filters?.dateFrom ? filters.dateFrom.trim() : null;
    const dateToStr = filters?.dateTo ? filters.dateTo.trim() : null;
    const fromDate = dateFromStr ? new Date(`${dateFromStr}T00:00:00.000Z`) : null;
    const toDate = dateToStr ? new Date(`${dateToStr}T23:59:59.999Z`) : null;

    const moveRows = await fetchProductInventoryMoves(trimmedId);
    const movements: PeriodMovement[] = [];

    moveRows.forEach((row: any) => {
      const dateStr = row.DATE ? String(row.DATE) : '';
      const moveDate = dateStr ? new Date(dateStr) : null;
      const qty = parseNum(row.QTY);
      const locFrom = row['LOCATION FROM']?.toString().trim() || '';
      const locTo = row['LOCATION TO']?.toString().trim() || '';
      const ref = row.REFERENCE?.toString().trim() || '-';

      if (fromDate && moveDate && moveDate < fromDate) return;
      if (toDate && moveDate && moveDate > toDate) return;

      const fromInternal = INTERNAL_WAREHOUSES_SET.has(locFrom);
      const toInternal = INTERNAL_WAREHOUSES_SET.has(locTo);
      const classified = classifyPeriodMovement(locFrom, locTo, qty, fromInternal, toInternal);
      if (!classified) return;

      movements.push({
        moveId: String(row.ID ?? ''),
        date: dateStr,
        reference: ref,
        locationFrom: locFrom,
        locationTo: locTo,
        qty,
        type: classified.type,
      });
    });

    movements.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      if (timeA !== timeB) return timeA - timeB;
      return (a.moveId || '').localeCompare(b.moveId || '');
    });

    return { success: true, data: movements };
  } catch (error: any) {
    console.error('Service Error getProductPeriodMovements:', error);
    return { success: false, error: 'Failed to fetch product period movements', details: error.message };
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
