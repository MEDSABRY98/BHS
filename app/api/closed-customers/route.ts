import { NextResponse } from 'next/server';
import { getClosedCustomers } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const closedCustomers = await getClosedCustomers();
    return NextResponse.json({ closedCustomers: Array.from(closedCustomers) });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch closed customers list' },
      { status: 500 }
    );
  }
}

