import { NextResponse } from 'next/server';
import { getInventoryCountingData } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getInventoryCountingData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch inventory counting data';
    return NextResponse.json(
      { 
        error: 'Failed to fetch inventory counting data',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

