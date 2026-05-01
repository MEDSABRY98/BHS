import { NextResponse } from 'next/server';
import { getNormalICRecord } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getNormalICRecord();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch normal IC record' },
      { status: 500 }
    );
  }
}
