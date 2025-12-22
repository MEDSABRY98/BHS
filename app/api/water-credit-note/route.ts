import { NextResponse } from 'next/server';
import { getWaterCreditNoteData } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getWaterCreditNoteData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching water credit note data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch water credit note data' },
      { status: 500 }
    );
  }
}

