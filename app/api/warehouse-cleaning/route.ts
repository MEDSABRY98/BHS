import { NextResponse } from 'next/server';
import { getWarehouseCleaningData } from '@/lib/googleSheets';

export async function GET() {
  try {
    console.log('[API] Fetching Warehouse Cleaning data...');
    const data = await getWarehouseCleaningData();
    console.log(`[API] Successfully fetched ${data.length} entries`);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API] Error fetching Warehouse Cleaning data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch Warehouse Cleaning data';
    return NextResponse.json(
      { 
        error: 'Failed to fetch Warehouse Cleaning data',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

