import { NextResponse } from 'next/server';
import { getDiscountTrackerEntries } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entries = await getDiscountTrackerEntries();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch discount tracker data';
    return NextResponse.json(
      {
        error: 'Failed to fetch discount tracker data',
        details: errorMessage,
      },
      { status: 500 },
    );
  }
}

