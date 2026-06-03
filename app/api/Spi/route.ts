import { NextResponse } from 'next/server';
import { getSpiData } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const spiData = await getSpiData();
    return NextResponse.json({ data: spiData });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SPI data' },
      { status: 500 }
    );
  }
}
