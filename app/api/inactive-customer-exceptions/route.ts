import { NextResponse } from 'next/server';
import { getInactiveCustomerExceptions } from '@/lib/googleSheets';

export async function GET() {
  try {
    const data = await getInactiveCustomerExceptions();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch inactive customer exceptions';
    return NextResponse.json(
      { 
        error: 'Failed to fetch inactive customer exceptions',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

