import { NextResponse } from 'next/server';
import { getInactiveCustomerExceptions, addInactiveCustomerException, removeInactiveCustomerException } from '@/lib/googleSheets';

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

export async function POST(request: Request) {
  try {
    const { customerId, customerName } = await request.json();
    if (!customerId || !customerName) {
      return NextResponse.json({ error: 'Customer ID and Name are required' }, { status: 400 });
    }

    await addInactiveCustomerException(customerId, customerName);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to add exception' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    await removeInactiveCustomerException(customerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to remove exception' }, { status: 500 });
  }
}
