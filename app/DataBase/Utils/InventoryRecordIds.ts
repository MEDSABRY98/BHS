import { bhs_supabas } from '@/lib/supabase';

export type InventoryTableName =
  | 'web_INVENTORY_PRODUCTS'
  | 'web_INVENTORY_MOVES'
  | 'web_INVENTORY_ITEM_CODE';

function parseRecordNum(id: string): number | null {
  const baseId = String(id || '').split('#')[0];
  if (!baseId.startsWith('R-')) return null;
  const num = parseInt(baseId.substring(2), 10);
  return Number.isNaN(num) ? null : num;
}

export function formatInventoryRecordId(num: number): string {
  return `R-${String(num).padStart(4, '0')}`;
}

export async function getNextInventoryRecordId(table: InventoryTableName): Promise<string> {
  const { data, error } = await bhs_supabas.from(table).select('ID');
  if (error) throw error;

  let maxNum = 0;
  (data || []).forEach((row) => {
    const num = parseRecordNum(row.ID || '');
    if (num !== null && num > maxNum) maxNum = num;
  });

  return formatInventoryRecordId(maxNum + 1);
}
