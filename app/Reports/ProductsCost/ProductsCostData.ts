// Products · Reduced Cost — data + calculation (no UI).
//  reduced cost = real cost × (1 − percent / 100), rounded to 3 decimals like the Products database page.

import { bhs_supabas } from '@/lib/secureDb';

export interface ProductCostRow {
  productId: string;
  /** empty when the product has no parent (empty, 0, or its own ID) */
  parentId: string;
  barcode: string;
  name: string;
  cost: number;
  active: boolean;
}

export const roundCost = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
};

/** Parses the percentage typed by the user. Returns null when it is not a number between 0 and 100. */
export const parsePercent = (text: string): number | null => {
  const t = text.trim().replace('%', '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

export const reduceCost = (cost: number, percent: number): number => roundCost(cost * (1 - percent / 100));

/** All products (read in pages of 1000: the database returns at most 1000 rows per request). */
export async function fetchProductsForCost(): Promise<ProductCostRow[]> {
  const rows: ProductCostRow[] = [];
  const step = 1000;
  for (let start = 0; ; start += step) {
    const { data, error } = await bhs_supabas
      .from('bhs_PRODUCTS')
      .select('"PRODUCT ID", "PRODUCT PARENT ID", "PRODUCT BARCODE", "PRODUCT NAME", "PRODUCT COST", "IS_ACTIVE"')
      .order('PRODUCT NAME')
      .range(start, start + step - 1);
    if (error) throw error;
    (data || []).forEach((p: any) => {
      const productId = String(p['PRODUCT ID'] ?? '').trim();
      const parent = String(p['PRODUCT PARENT ID'] ?? '').trim();
      rows.push({
        productId,
        parentId: parent && Number(parent) !== 0 && parent !== productId ? parent : '', // 0 / empty = no parent
        barcode: String(p['PRODUCT BARCODE'] ?? ''),
        name: String(p['PRODUCT NAME'] ?? ''),
        cost: roundCost(p['PRODUCT COST']),
        active: p['IS_ACTIVE'] !== false,
      });
    });
    if (!data || data.length < step) break;
  }
  return rows;
}
