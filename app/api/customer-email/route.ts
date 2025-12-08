import { NextResponse } from 'next/server';
import { getCustomerEmail } from '@/lib/googleSheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerName = searchParams.get('customerName');

    if (!customerName) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    const email = await getCustomerEmail(customerName);
    
    return NextResponse.json({ email });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer email' },
      { status: 500 }
    );
  }
}

