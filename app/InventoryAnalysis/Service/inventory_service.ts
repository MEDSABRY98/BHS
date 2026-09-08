// Client-side service

import { bhs_supabase } from '@/lib/supabase';

import {
  getNetQtyEffect,
  getScopedQtyEffect,
  isMoveInLocationScope,
  INTERNAL_WAREHOUSES_SET,
  INTERNAL_WAREHOUSES_SORTED,
  isInternalTransfer,
  isSameLocationMove,
  isWaterClusterTransfer,
  isWaterClusterLocation,
  normalizeLocation,
  formatProductCategory,
} from '../Utils/locationTypes';
import {
  buildLocationRegistry,
  matchesCanonicalLocation,
  resolveLocationId,
  resolveLocationName,
  type LocationRegistry,
} from '../Utils/locationRegistry';
import { fetchInventoryLocations } from './location_service';
import type {
  CustomerMoveInRange,
  InventoryReportProduct,
  LocationMovementRow,
  MoveDaySummary,
  PeriodMovement,
  ProductBalanceRow,
  VendorMoveInRange,
} from './inventory_types';

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

const INVENTORY_MOVE_SELECT = 'DATE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';
const INVENTORY_MOVE_SELECT_FULL = 'ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';



let locationRegistryCache: LocationRegistry | null = null;

async function loadLocationRegistry(): Promise<LocationRegistry> {
  if (locationRegistryCache) return locationRegistryCache;
  const { rows } = await fetchInventoryLocations();
  locationRegistryCache = buildLocationRegistry(rows);
  return locationRegistryCache;
}

function resolveMoveFrom(row: InventoryMoveRow, registry: LocationRegistry): string {
  return resolveLocationName(String(row['LOCATION FROM'] ?? ''), registry);
}

function resolveMoveTo(row: InventoryMoveRow, registry: LocationRegistry): string {
  return resolveLocationName(String(row['LOCATION TO'] ?? ''), registry);
}

function resolveScopedLocationName(raw: string | null | undefined, registry: LocationRegistry): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  return resolveLocationName(trimmed, registry);
}

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
export async function fetchAllInventoryMovesStable(): Promise<InventoryMoveRow[]> {
  // Supabase fallback: ID-cursor pagination
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
    lastId = String(data[data.length - 1].ID ?? '');
    if (data.length < pageSize) break;
  }

  return allRows;
}

async function fetchInventoryProducts(): Promise<InventoryProductRow[]> {
  return fetchAllInventoryRows<InventoryProductRow>('bhs_PRODUCTS', '*');
}



const CUSTOMERS_LOCATION = 'Partners/Customers';
const VENDORS_LOCATION = 'Partners/Vendors';

async function fetchCustomerMovesInRangeFromDb(
  dateFrom: string,
  dateTo: string,
  mode: 'sale' | 'return',
  registry: LocationRegistry,
): Promise<CustomerMoveInRange[]> {
  const pageSize = 1000;
  const results: CustomerMoveInRange[] = [];
  let lastId: string | null = null;
  const SELECT = 'ID,DATE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';
  const dateStart = `${dateFrom.trim()}T00:00:00.000Z`;
  const dateEnd = `${dateTo.trim()}T23:59:59.999Z`;

  while (true) {
    let query = bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select(SELECT)
      .gte('DATE', dateStart)
      .lte('DATE', dateEnd)
      .order('ID', { ascending: true })
      .limit(pageSize);

    if (mode === 'sale') {
      query = query.eq('LOCATION TO', registry.customersLocationId || CUSTOMERS_LOCATION);
    } else {
      query = query.eq('LOCATION FROM', registry.customersLocationId || CUSTOMERS_LOCATION);
    }

    if (lastId !== null) {
      query = query.gt('ID', lastId);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data as InventoryMoveRow[]) {
      const productId = row['PRODUCT ID']?.toString().trim() || '';
      const qty = parseNum(row.QTY);
      const dateStr = row.DATE ? String(row.DATE) : '';
      if (!productId || qty === 0 || !dateStr) continue;

      results.push({
        productId,
        date: dateStr.split('T')[0],
        qty,
        isSale: mode === 'sale',
      });
    }

    lastId = String((data[data.length - 1] as InventoryMoveRow).ID ?? '');
    if (data.length < pageSize) break;
  }

  return results;
}

export async function fetchInventoryMovesInRange(dateFrom: string, dateTo: string) {
  try {
    const fromDate = new Date(`${dateFrom.trim()}T00:00:00.000Z`);
    const toDate = new Date(`${dateTo.trim()}T23:59:59.999Z`);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return { success: false as const, error: 'Invalid date range' };
    }
    if (fromDate > toDate) {
      return { success: false as const, error: 'From date must be before or equal to To date' };
    }

    const registry = await loadLocationRegistry();
    const [sales, returns] = await Promise.all([
      fetchCustomerMovesInRangeFromDb(dateFrom, dateTo, 'sale', registry),
      fetchCustomerMovesInRangeFromDb(dateFrom, dateTo, 'return', registry),
    ]);

    return { success: true as const, data: [...sales, ...returns] };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch inventory moves';
    console.error('Service Error fetchInventoryMovesInRange:', error);
    return { success: false as const, error: message };
  }
}








// fetchInventoryMoves delegates to fetchAllInventoryMovesStable
// which uses ID-cursor pagination (not slow offset) and cache-first mode
async function fetchInventoryMoves(): Promise<InventoryMoveRow[]> {
  return fetchAllInventoryMovesStable();
}


// ----------------------------------------------------------------------
// API: /api/Inventory
// ----------------------------------------------------------------------

function buildSalesMaps(moveRows: InventoryMoveRow[], registry: LocationRegistry) {
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
    if (!dateStr || !matchesCanonicalLocation(locationTo || '', CUSTOMERS_LOCATION, registry)) return;

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
    const [products, moveRows, registry] = await Promise.all([
      fetchInventoryProducts(),
      fetchInventoryMoves(),
      loadLocationRegistry(),
    ]);

    const { salesMap, salesBreakdownMap, monthLabels, months, hasMovesSet } = buildSalesMaps(moveRows, registry);
    const stockMap = new Map<string, number>();
    for (const move of moveRows) {
      const productId = (move['PRODUCT ID'] || '').trim();
      if (!productId) continue;
      const effect = getNetQtyEffect(
        resolveMoveFrom(move, registry),
        resolveMoveTo(move, registry),
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

function aggregateMovements(moveRows: InventoryMoveRow[], registry: LocationRegistry) {
  const movements: Record<string, { sales: number; returns: number; netPurchases: number }> = {};

  moveRows.forEach((row) => {
    const fromRaw = row['LOCATION FROM']?.toString().trim() || '';
    const toRaw = row['LOCATION TO']?.toString().trim() || '';
    const productId = row['PRODUCT ID']?.toString().trim();
    const qty = parseNum(row.QTY);

    if (!productId || qty === 0) return;

    if (!movements[productId]) {
      movements[productId] = { sales: 0, returns: 0, netPurchases: 0 };
    }

    if (matchesCanonicalLocation(toRaw, CUSTOMERS_LOCATION, registry)) movements[productId].sales += qty;
    if (matchesCanonicalLocation(fromRaw, CUSTOMERS_LOCATION, registry)) movements[productId].returns += qty;
    if (matchesCanonicalLocation(fromRaw, VENDORS_LOCATION, registry)) movements[productId].netPurchases += qty;
    if (matchesCanonicalLocation(toRaw, VENDORS_LOCATION, registry)) movements[productId].netPurchases -= qty;
  });

  return movements;
}

function mapMovementsRpcRows(data: unknown): Record<string, { sales: number; returns: number; netPurchases: number }> {
  const movements: Record<string, { sales: number; returns: number; netPurchases: number }> = {};
  if (!Array.isArray(data)) return movements;

  data.forEach((row: { product_id?: string | null; sales?: unknown; returns?: unknown; net_purchases?: unknown }) => {
    const productId = row.product_id?.toString().trim();
    if (!productId) return;
    movements[productId] = {
      sales: Number(row.sales) || 0,
      returns: Number(row.returns) || 0,
      netPurchases: Number(row.net_purchases) || 0,
    };
  });

  return movements;
}

function hasUsableMovementsRpcData(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return false;
  return data.some((row: { sales?: unknown; returns?: unknown; net_purchases?: unknown }) => {
    const sales = Number(row.sales) || 0;
    const returns = Number(row.returns) || 0;
    const netPurchases = Number(row.net_purchases) || 0;
    return sales !== 0 || returns !== 0 || netPurchases !== 0;
  });
}

export async function getProductMovementsData() {
  try {
    const moveRows = await fetchInventoryMoves();
    const registry = await loadLocationRegistry();
    const aggregated = aggregateMovements(moveRows, registry);
    return { success: true, data: aggregated };
  } catch (error: any) {
    console.error('API Error:', error);
    return { success: false, error: 'Failed to fetch movements data', details: error.message };
  }
}

// ----------------------------------------------------------------------
// API: /api/Inventory/Details
// ----------------------------------------------------------------------

async function fetchInventoryMovesForProduct(productId: string): Promise<InventoryMoveRow[]> {
  const pid = productId.trim();
  // Supabase: filter server-side with ID-cursor pagination
  // Supabase: filter server-side with ID-cursor pagination
  const SELECT = 'ID,DATE,REFERENCE,"LOCATION FROM","LOCATION TO","PRODUCT ID",QTY';
  const results: InventoryMoveRow[] = [];
  let lastId: string | null = null;
  while (true) {
    let query = bhs_supabase
      .from('web_INVENTORY_MOVES')
      .select(SELECT)
      .eq('PRODUCT ID', pid)
      .order('ID', { ascending: true })
      .limit(1000);
    if (lastId !== null) query = query.gt('ID', lastId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    results.push(...(data as InventoryMoveRow[]));
    lastId = String(data[data.length - 1].ID ?? '');
    if (data.length < 1000) break;
  }
  return results;
}

function hasUsableProductAnalysisRpcData(rpcData: unknown): boolean {
  if (!rpcData || typeof rpcData !== 'object') return false;

  const wrapped = rpcData as {
    success?: boolean;
    data?: {
      summary?: { sales?: unknown; returns?: unknown; netPurchases?: unknown };
      monthlyData?: Array<{ sales?: unknown; returns?: unknown; purchases?: unknown }>;
    };
  };

  if (!wrapped.success || !wrapped.data?.summary) return false;

  const summary = wrapped.data.summary;
  const movementTotal =
    (Number(summary.sales) || 0) +
    (Number(summary.returns) || 0) +
    Math.abs(Number(summary.netPurchases) || 0);

  if (movementTotal > 0) return true;

  const monthly = wrapped.data.monthlyData;
  if (
    Array.isArray(monthly) &&
    monthly.some(
      (row) =>
        (Number(row.sales) || 0) !== 0 ||
        (Number(row.returns) || 0) !== 0 ||
        (Number(row.purchases) || 0) !== 0,
    )
  ) {
    return true;
  }

  return false;
}

export async function getSingleProductAnalysis(
  productId: string,
  filters?: { year?: string; month?: string; from?: string; to?: string; preset?: string }
) {
  try {
    // Fallback: fetch all data and compute in JS
    const [moveRows, products, registry] = await Promise.all([
      fetchInventoryMovesForProduct(productId),
      fetchInventoryProducts(),
      loadLocationRegistry(),
    ]);

    const productRow = products.find((p) => p['PRODUCT ID']?.toString().trim() === productId.trim());
    if (!productRow) return { success: false, error: 'Product not found' };

    let endingBalance = 0;
    moveRows.forEach((row) => {
      const from = resolveMoveFrom(row, registry);
      const to = resolveMoveTo(row, registry);
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

      const from = resolveMoveFrom(row, registry);
      const to = resolveMoveTo(row, registry);
      const qty = parseNum(row.QTY);
      if (qty === 0) return;

      const moveDate = new Date(row.DATE);
      if (isNaN(moveDate.getTime())) return;

      if (filterStart && moveDate < filterStart) return;
      if (filterEnd && moveDate > filterEnd) return;

      let key: string;
      if (isDaily) key = moveDate.toISOString().split('T')[0];
      else key = `${moveDate.getFullYear()}-${moveDate.getMonth() + 1}`;

      if (matchesCanonicalLocation(to, CUSTOMERS_LOCATION, registry)) {
        totalSales += qty;
        const pData = allPeriods.find((p) => p.key === key);
        if (pData) pData.sales += qty;
      }
      if (matchesCanonicalLocation(from, CUSTOMERS_LOCATION, registry)) {
        totalReturns += qty;
        const pData = allPeriods.find((p) => p.key === key);
        if (pData) pData.returns += qty;
      }
      if (matchesCanonicalLocation(from, VENDORS_LOCATION, registry)) {
        totalPurchases += qty;
        const pData = allPeriods.find((p) => p.key === key);
        if (pData) pData.purchases += qty;
      }
      if (matchesCanonicalLocation(to, VENDORS_LOCATION, registry)) {
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

function classifyPeriodMovement(
  locFrom: string,
  locTo: string,
  qty: number,
): { type: string; netVendors: number; netCustomers: number; netProduction: number; netAdjustment: number } | null {
  const from = normalizeLocation(locFrom);
  const to = normalizeLocation(locTo);

  if (isSameLocationMove(from, to)) {
    return { type: 'same_location', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
  }

  if (isWaterClusterTransfer(from, to)) {
    return { type: 'warehouse_transfer', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
  }

  if (isInternalTransfer(from, to)) {
    return { type: 'transfer', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
  }

  const fromInternal = INTERNAL_WAREHOUSES_SET.has(from);
  const toInternal = INTERNAL_WAREHOUSES_SET.has(to);

  if (fromInternal && toInternal) {
    if (isWaterClusterLocation(from) && !isWaterClusterLocation(to)) {
      return { type: 'production_out', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
    }
    if (isWaterClusterLocation(to) && !isWaterClusterLocation(from)) {
      return { type: 'production_in', netVendors: 0, netCustomers: 0, netProduction: 0, netAdjustment: 0 };
    }
  }

  const isIn = toInternal;
  const isOut = fromInternal;
  if (!isIn && !isOut) return null;

  const otherLocation = isIn ? from : to;
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

type PeriodBucketEntry = {
  netVendors: number;
  netCustomers: number;
  netProduction: number;
  netAdjustment: number;
  netWarehouseTransfer: number;
  netInternalTransfer: number;
};

/** Split period stock effect into display buckets (location-scoped uses signed effect). */
function applyPeriodMovementBuckets(
  entry: PeriodBucketEntry,
  classified: { type: string; netVendors: number; netCustomers: number; netProduction: number; netAdjustment: number },
  effect: number,
  location: string | null,
) {
  if (classified.type === 'warehouse_transfer') {
    if (location) entry.netWarehouseTransfer += effect;
    return;
  }

  if (classified.type === 'transfer') {
    if (location) entry.netInternalTransfer += effect;
    return;
  }

  if (location) {
    switch (classified.type) {
      case 'vendor_in':
      case 'vendor_return':
        entry.netVendors += effect;
        break;
      case 'customer_sale':
      case 'customer_return':
        entry.netCustomers += effect;
        break;
      case 'adjustment_in':
      case 'adjustment_out':
        entry.netAdjustment += effect;
        break;
      case 'production_in':
      case 'production_out':
      case 'subcontracting_in':
      case 'subcontracting_out':
        entry.netProduction += effect;
        break;
      default:
        if (effect !== 0) entry.netProduction += effect;
        break;
    }
    return;
  }

  entry.netVendors += classified.netVendors;
  entry.netCustomers += classified.netCustomers;
  entry.netProduction += classified.netProduction;
  entry.netAdjustment += classified.netAdjustment;
}



async function computeProductsBalanceReportDataJs(filters?: { dateFrom?: string; dateTo?: string; location?: string }) {
  const [products, moveRows, registry] = await Promise.all([
    fetchInventoryProducts(),
    fetchAllInventoryMovesStable(),
    loadLocationRegistry(),
  ]);

  const dateFromStr = filters?.dateFrom ? filters.dateFrom.trim() : null;
  const dateToStr = filters?.dateTo ? filters.dateTo.trim() : null;
  const location = resolveScopedLocationName(filters?.location, registry);

  const fromDate = dateFromStr ? new Date(`${dateFromStr}T00:00:00.000Z`) : null;
  const toDate = dateToStr ? new Date(`${dateToStr}T23:59:59.999Z`) : null;

  const productDataMap = new Map<string, {
    openingStock: number;
    periodEffect: number;
    netVendors: number;
    netCustomers: number;
    netProduction: number;
    netAdjustment: number;
    netWarehouseTransfer: number;
    netInternalTransfer: number;
  }>();

  moveRows.forEach((row: any) => {
    const productId = row['PRODUCT ID']?.toString().trim();
    if (!productId) return;

    const dateStr = row.DATE ? String(row.DATE) : '';
    const moveDate = dateStr ? new Date(dateStr) : null;
    const qty = parseNum(row.QTY);
    const locFrom = resolveMoveFrom(row, registry);
    const locTo = resolveMoveTo(row, registry);

    if (!isMoveInLocationScope(locFrom, locTo, location)) return;

    if (!productDataMap.has(productId)) {
      productDataMap.set(productId, {
        openingStock: 0,
        periodEffect: 0,
        netVendors: 0,
        netCustomers: 0,
        netProduction: 0,
        netAdjustment: 0,
        netWarehouseTransfer: 0,
        netInternalTransfer: 0,
      });
    }

    const entry = productDataMap.get(productId)!;

    const effect = getScopedQtyEffect(locFrom, locTo, qty, location);
    const classified = classifyPeriodMovement(locFrom, locTo, qty);

    if (fromDate && moveDate && moveDate < fromDate) {
      entry.openingStock += effect;
      return;
    }

    if (toDate && moveDate && moveDate > toDate) {
      return;
    }

    entry.periodEffect += effect;

    if (!classified) return;

    applyPeriodMovementBuckets(entry, classified, effect, location);
  });

  return products.map((row) => {
    const productId = row['PRODUCT ID']?.toString().trim() || '';
    const barcode = row['PRODUCT BARCODE']?.toString().trim() || '';
    const productName = row['PRODUCT NAME']?.toString().trim() || '';
    const category = formatProductCategory(row['PRODUCT CATEGORY']?.toString().trim() || '') || 'Uncategorized';

    const calcData = productDataMap.get(productId) || {
      openingStock: 0,
      periodEffect: 0,
      netVendors: 0,
      netCustomers: 0,
      netProduction: 0,
      netAdjustment: 0,
      netWarehouseTransfer: 0,
      netInternalTransfer: 0,
    };

    const endingStock = location
      ? calcData.openingStock + calcData.periodEffect
      : calcData.openingStock
        + calcData.netVendors
        + calcData.netCustomers
        + calcData.netProduction
        + calcData.netAdjustment
        + calcData.netWarehouseTransfer
        + calcData.netInternalTransfer;

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
      netWarehouseTransfer: calcData.netWarehouseTransfer,
      netInternalTransfer: calcData.netInternalTransfer,
      endingStock,
    };
  }).filter(p => p.productName && (productDataMap.has(p.productId) || p.endingStock !== 0 || p.openingStock !== 0));
}

function mapRpcProductsBalanceRows(data: unknown): ProductBalanceRow[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row: any) => ({
      productId: String(row.productId ?? row.product_id ?? '').trim(),
      barcode: String(row.barcode ?? '').trim(),
      productName: String(row.productName ?? row.product_name ?? '').trim(),
      category: String(row.category ?? 'Uncategorized').trim() || 'Uncategorized',
      openingStock: Number(row.openingStock ?? row.opening_stock ?? 0),
      netVendors: Number(row.netVendors ?? row.net_vendors ?? 0),
      netCustomers: Number(row.netCustomers ?? row.net_customers ?? 0),
      netProduction: Number(row.netProduction ?? row.net_production ?? 0),
      netAdjustment: Number(row.netAdjustment ?? row.net_adjustment ?? 0),
      netWarehouseTransfer: Number(row.netWarehouseTransfer ?? row.net_warehouse_transfer ?? 0),
      netInternalTransfer: Number(row.netInternalTransfer ?? row.net_internal_transfer ?? 0),
      endingStock: Number(row.endingStock ?? row.ending_stock ?? 0),
    }))
    .filter((row) => row.productName);
}

export async function getProductsBalanceReportData(filters?: { dateFrom?: string; dateTo?: string; location?: string }) {
  try {


    const data = await computeProductsBalanceReportDataJs(filters);
    return { success: true as const, data };
  } catch (error: any) {
    console.error('Service Error getProductsBalanceReportData:', error);
    return { success: false as const, error: 'Failed to fetch products balance data', details: error.message };
  }
}


export async function fetchRawInventoryProducts() {
  return fetchAllInventoryRows('bhs_PRODUCTS', '*');
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

export async function getLiveAvailableQuantitiesFromMoves(): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  const registry = await loadLocationRegistry();

  const moves = await fetchAllInventoryMovesStable();

  for (const move of moves) {
    const productId = (move['PRODUCT ID'] || '').trim();
    if (!productId) continue;

    const qty = move.QTY || 0;
    const fromLoc = resolveMoveFrom(move, registry);
    const toLoc = resolveMoveTo(move, registry);

    const effect = getNetQtyEffect(fromLoc, toLoc, qty);
    if (effect !== 0) {
      stockMap.set(productId, (stockMap.get(productId) || 0) + effect);
    }
  }

  return stockMap;
}
