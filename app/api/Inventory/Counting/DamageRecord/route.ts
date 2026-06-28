import { NextResponse } from 'next/server';
import { fetchICDetails } from '../NormalTotal/route';

export async function GET() {
  try {
    const data = await fetchICDetails('DamageExpire');
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch damage IC record' },
      { status: 500 }
    );
  }
}
