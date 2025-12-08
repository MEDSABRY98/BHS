import { NextResponse } from 'next/server';
import { getAllCustomerEmails } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const customersWithEmails = await getAllCustomerEmails();
    return NextResponse.json({ customers: customersWithEmails });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer emails list' },
      { status: 500 }
    );
  }
}

