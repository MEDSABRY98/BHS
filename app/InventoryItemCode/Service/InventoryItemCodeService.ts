'use server';

import { bhs_supabas, fetchAllData } from '@/lib/supabase';

export async function getItemCodesData() {
  try {
    const data = await fetchAllData(() =>
      bhs_supabas.from('web_INVENTORY_ITEM_CODE').select('TAGS,"ITEM CODE",BARCODE'),
    );

    const mapped = data
      .map((row: { TAGS?: string | null; 'ITEM CODE'?: string | null; BARCODE?: string | null }) => ({
        tags: row.TAGS?.toString().trim() || '',
        itemCode: row['ITEM CODE']?.toString().trim() || '',
        barcode: row.BARCODE?.toString().trim() || '',
      }))
      .filter((entry) => entry.itemCode || entry.barcode);

    return { success: true as const, data: mapped };
  } catch (error: unknown) {
    console.error('Error fetching Item Codes:', error);
    return {
      success: false as const,
      error: 'Failed to fetch item codes',
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
