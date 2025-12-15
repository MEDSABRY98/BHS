import { NextResponse } from 'next/server';
import { resolveCustomerEmailTargets } from '@/lib/googleSheets';

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

    const { customers, emails } = await resolveCustomerEmailTargets(customerName);

    // Backward-compat: keep "email" as first email (if any)
    const email = emails[0] ?? null;

    return NextResponse.json({ email, emails, customers });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer email' },
      { status: 500 }
    );
  }
}

