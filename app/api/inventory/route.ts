import { NextResponse } from 'next/server';
import { getInventoryData } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getInventoryData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch inventory data';
    return NextResponse.json(
      { 
        error: 'Failed to fetch inventory data',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

