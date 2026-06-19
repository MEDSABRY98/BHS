import { bhs_supabas } from '@/lib/supabase';

export type SupplierTableName = 'web_Suppliers_Invoices' | 'web_Suppliers_Matching';

function parseRecordNum(id: string): number | null {
  const baseId = String(id || '').split('#')[0];
  if (!baseId.startsWith('R-')) return null;
  const num = parseInt(baseId.substring(2), 10);
  return Number.isNaN(num) ? null : num;
}

export function formatSupplierRecordId(num: number): string {
  return `R-${String(num).padStart(4, '0')}`;
}

export async function getNextSupplierRecordId(table: SupplierTableName): Promise<string> {
  const pageSize = 1000;
  let from = 0;
  let maxNum = 0;

  while (true) {
    const { data, error } = await bhs_supabas.from(table).select('ID').range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    data.forEach((row) => {
      const num = parseRecordNum(row.ID || '');
      if (num !== null && num > maxNum) maxNum = num;
    });

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return formatSupplierRecordId(maxNum + 1);
}

export async function allocateSupplierRecordIds(table: SupplierTableName, count: number): Promise<string[]> {
  if (count <= 0) return [];

  const pageSize = 1000;
  let from = 0;
  let maxNum = 0;

  while (true) {
    const { data, error } = await bhs_supabas.from(table).select('ID').range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    data.forEach((row) => {
      const num = parseRecordNum(row.ID || '');
      if (num !== null && num > maxNum) maxNum = num;
    });

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return Array.from({ length: count }, (_, i) => formatSupplierRecordId(maxNum + 1 + i));
}
