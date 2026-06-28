import { NextResponse } from 'next/server';
import { fetchICTotal } from '../NormalTotal/route';

export async function GET() {
  try {
    const data = await fetchICTotal('DamageExpire');
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch damage IC total' },
      { status: 500 }
    );
  }
}
