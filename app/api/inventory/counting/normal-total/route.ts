import { NextResponse } from 'next/server';
import { getNormalICTotal } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getNormalICTotal();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch normal IC total' },
      { status: 500 }
    );
  }
}
