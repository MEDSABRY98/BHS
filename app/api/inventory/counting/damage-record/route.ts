import { NextResponse } from 'next/server';
import { getDamageICRecord } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getDamageICRecord();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch damage IC record' },
      { status: 500 }
    );
  }
}
