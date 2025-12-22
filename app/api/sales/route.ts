import { NextResponse } from 'next/server';
import { getSalesData } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getSalesData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sales data';
    return NextResponse.json(
      { 
        error: 'Failed to fetch sales data',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

