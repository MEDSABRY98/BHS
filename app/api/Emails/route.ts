import { NextResponse } from 'next/server';
import { resolveCustomerEmailTargets, getAllCustomerEmails } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerName = searchParams.get('customerName');

    // If customerName is provided, return specific customer's resolved emails
    if (customerName) {
      const { customers, emails } = await resolveCustomerEmailTargets(customerName);
      // Backward-compat: keep "email" as first email (if any)
      const email = emails[0] ?? null;
      return NextResponse.json({ email, emails, customers });
    }

    // Otherwise, return all customer emails
    const customersWithEmails = await getAllCustomerEmails();
    return NextResponse.json({ customers: customersWithEmails });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer emails' },
      { status: 500 }
    );
  }
}
