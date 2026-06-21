import { bhs_supabas } from '@/lib/supabase';

export type InventoryTableName =
  | 'web_INVENTORY_PRODUCTS'
  | 'web_INVENTORY_MOVES'
  | 'web_INVENTORY_ITEM_CODE'
  | 'mix_INVENTORY_COUNT_PRODUCTS'
  | 'mix_INVENTORY_COUNT_DETAILS'
  | 'mix_INVENTORY_COUNT_TOTALS';

export function parseRecordNum(id: string): number | null {
  const baseId = String(id || '').split('#')[0];
  if (!baseId.startsWith('R-')) return null;
  const num = parseInt(baseId.substring(2), 10);
  return Number.isNaN(num) ? null : num;
}

export function formatInventoryRecordId(num: number): string {
  return `R-${String(num).padStart(4, '0')}`;
}

export async function getNextInventoryRecordId(table: InventoryTableName): Promise<string> {
  const pageSize = 1000;
  let from = 0;
  let maxNum = 0;

  while (true) {
    const { data, error } = await bhs_supabas
      .from(table)
      .select('ID')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    data.forEach((row) => {
      const num = parseRecordNum(row.ID || '');
      if (num !== null && num > maxNum) maxNum = num;
    });

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return formatInventoryRecordId(maxNum + 1);
}
