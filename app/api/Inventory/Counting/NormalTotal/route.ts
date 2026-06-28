import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

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

function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
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

export async function fetchICTotal(countType: CountType): Promise<ICItem[]> {
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

export async function fetchICDetails(countType: CountType): Promise<ICRecord[]> {
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

export async function GET() {
  try {
    const data = await fetchICTotal('Normal');
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch normal IC total' },
      { status: 500 }
    );
  }
}
