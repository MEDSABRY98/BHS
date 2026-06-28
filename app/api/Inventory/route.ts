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

async function getProductOrdersData() {
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
}

async function updateProductColumn(productId: string, columnName: string, value: unknown) {
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
}

export async function GET() {
  try {
    const data = await getProductOrdersData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch inventory data';
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory data',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { productId, field, value } = await request.json();

    if (!productId || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await updateProductColumn(productId, field, value);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error.message },
      { status: 500 }
    );
  }
}
