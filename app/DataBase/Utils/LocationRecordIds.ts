import { bhs_supabas } from '@/lib/supabase';

const TABLE = 'web_INVENTORY_LOCATIONS';

function isMissingTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /does not exist|42P01|Could not find the table|schema cache/i.test(message);
}

export function parseLocationRecordNum(id: string): number | null {
  const baseId = String(id || '').split('#')[0].trim().toUpperCase();
  if (!baseId.startsWith('LOC-')) return null;
  const num = parseInt(baseId.substring(4), 10);
  return Number.isNaN(num) ? null : num;
}

export function formatLocationRecordId(num: number): string {
  return `LOC-${String(num).padStart(4, '0')}`;
}

export function isLocationRecordId(value: string): boolean {
  return parseLocationRecordNum(value) !== null;
}

export async function getNextLocationRecordId(): Promise<string> {
  try {
    const pageSize = 1000;
    let from = 0;
    let maxNum = 0;

    while (true) {
      const { data, error } = await bhs_supabas
        .from(TABLE)
        .select('ID')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((row) => {
        const num = parseLocationRecordNum(row.ID || '');
        if (num !== null && num > maxNum) maxNum = num;
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }

    return formatLocationRecordId(maxNum + 1);
  } catch (error) {
    if (isMissingTableError(error)) {
      return formatLocationRecordId(1);
    }
    throw error;
  }
}

export async function allocateLocationRecordIds(count: number): Promise<string[]> {
  if (count <= 0) return [];
  const startNum = parseLocationRecordNum(await getNextLocationRecordId()) ?? 1;
  return Array.from({ length: count }, (_, i) => formatLocationRecordId(startNum + i));
}
