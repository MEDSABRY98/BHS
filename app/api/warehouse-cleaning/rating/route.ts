import { NextResponse } from 'next/server';
import { updateWarehouseCleaningRating } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { year, month, date, rating } = body;

    if (!year || !month || !date) {
      return NextResponse.json(
        { error: 'Year, month, and date are required' },
        { status: 400 }
      );
    }

    await updateWarehouseCleaningRating(year, month, date, rating || '');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update rating';
    return NextResponse.json(
      { 
        error: 'Failed to update rating',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

