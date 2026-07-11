'use server';

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
  'PRODUCT BARCODE': string | null;
  'PRODUCT NAME': string;
  'AVAILABLE QTY': number | null;
  'QTY IN BOX': number | null;
};

type MixCountTable =
  | 'bhs_PRODUCTS'
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

async function loadMixCountProductMap(): Promise<Map<string, MixCountProductRow>> {
  const products = await fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', '*');
  return new Map(products.map((p) => [p['PRODUCT ID']?.toString().trim(), p]));
}

export async function fetchICTotal(countType: CountType) {
  try {
    const [products, totals] = await Promise.all([
      fetchAllMixCountRows<MixCountProductRow>('bhs_PRODUCTS', '*'),
      fetchAllMixCountRows<{ 'PRODUCT ID': string; 'COUNTED QTY': number | null }>(
        'mix_INVENTORY_COUNT_TOTALS',
        '"PRODUCT ID","COUNTED QTY"',
        { column: 'COUNT_TYPE', value: countType }
      ),
    ]);

    const totalMap = new Map(
      totals.map((t) => [t['PRODUCT ID']?.toString().trim(), parseNum(t['COUNTED QTY'])])
    );

    const data = products
      .map((p) => ({
        productId: p['PRODUCT ID']?.toString().trim() || '',
        barcodeName: p['PRODUCT BARCODE']?.toString().trim() || '',
        productName: p['PRODUCT NAME']?.toString().trim() || '',
        availableQty: parseNum(p['AVAILABLE QTY']),
        qtyInBox: parseNum(p['QTY IN BOX']),
        countedQty: totalMap.get(p['PRODUCT ID']?.toString().trim()) || 0,
      }))
      .filter((item) => item.productName)
      .sort((a, b) => a.productName.localeCompare(b.productName));
      
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in fetchICTotal:', error);
    return { success: false, error: 'Failed to fetch IC total', details: error.message };
  }
}

export async function fetchICDetails(countType: CountType) {
  try {
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

    const data = details
      .map((row) => {
        const productId = row['PRODUCT ID']?.toString().trim() || '';
        const product = productMap.get(productId);
        return {
          rowId: row.ID || '',
          date: row.DATE || '',
          user: row.USER?.toString().trim() || '',
          warehouse: row.WAREHOUSE?.toString().trim() || '',
          productId,
          barcodeName: product?.['PRODUCT BARCODE']?.toString().trim() || '',
          productName: product?.['PRODUCT NAME']?.toString().trim() || '',
          qtyInBox: parseNum(row['QTY IN BOX'] ?? product?.['QTY IN BOX']),
          countDetails: row['COUNT DETAILS']?.toString() || '',
          countedQty: parseNum(row['COUNTED QTY']),
        };
      })
      .filter((record) => record.productId);
      
    return { success: true, data };
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
        'AVAILABLE QTY': parseNum(newValues.availableQty),
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
