import { NextResponse } from 'next/server';
import { getSheetData } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getSheetData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch sheet data';
    return NextResponse.json(
      { 
        error: 'Failed to fetch sheet data',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

