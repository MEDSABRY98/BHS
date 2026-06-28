import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

export const maxDuration = 120;

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
  table: 'web_INVENTORY_PRODUCTS' | 'web_INVENTORY_MOVES',
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

async function fetchInventoryMovesForProduct(productId: string): Promise<InventoryMoveRow[]> {
  return fetchAllInventoryRows<InventoryMoveRow>('web_INVENTORY_MOVES', INVENTORY_MOVE_SELECT, {
    order: { column: 'DATE', ascending: true },
    productId,
  });
}

async function getSingleProductAnalysis(
  productId: string,
  filters?: { year?: string; month?: string; from?: string; to?: string; preset?: string }
) {
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

  return {
    summary: { sales: totalSales, returns: totalReturns, returnsRate: returnsRate.toFixed(2), netPurchases, netFlow, currentStock, minQ },
    monthlyData: [...allPeriods].reverse(),
    granularity
  };
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }
        const filters = {
            year: searchParams.get('year') || undefined,
            month: searchParams.get('month') || undefined,
            from: searchParams.get('from') || undefined,
            to: searchParams.get('to') || undefined,
            preset: searchParams.get('preset') || undefined,
        };

        const data = await getSingleProductAnalysis(id, filters);
        if (!data) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch product analysis', details: error.message },
            { status: 500 }
        );
    }
}
