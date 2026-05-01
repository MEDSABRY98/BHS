import { NextResponse } from 'next/server';
import { getDamageICTotal } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getDamageICTotal();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch damage IC total' },
      { status: 500 }
    );
  }
}
