import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

async function fetchAllInventoryRows<T>(
  table: 'web_INVENTORY_ITEM_CODE',
  select: string
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const allRows: T[] = [];

  while (true) {
    const { data, error } = await bhs_supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function getItemCodesData() {
  const data = await fetchAllInventoryRows<{
    TAGS: string | null;
    'ITEM CODE': string | null;
    BARCODE: string | null;
  }>('web_INVENTORY_ITEM_CODE', 'TAGS,"ITEM CODE",BARCODE');

  return data
    .map((row) => ({
      tags: row.TAGS?.toString().trim() || '',
      itemCode: row['ITEM CODE']?.toString().trim() || '',
      barcode: row.BARCODE?.toString().trim() || '',
    }))
    .filter((entry) => entry.itemCode || entry.barcode);
}

export async function GET() {
    try {
        const data = await getItemCodesData();
        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching Item Codes:', error);
        return NextResponse.json({ error: 'Failed to fetch item codes' }, { status: 500 });
    }
}
