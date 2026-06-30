import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

const TABLE = 'web_Sales_DB_INACTIVECUSTOMERS';

async function resolveCustomerNames(customerIds: string[]) {
  const uniqueIds = [...new Set(customerIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map<string, string>();

  const { data: customers, error } = await bhs_supabas
    .from('bhs_CUSTOMERS')
    .select('"CUSTOMER ID", "CUSTOMER SUB NAME", "CUSTOMER MAIN NAME"')
    .in('CUSTOMER ID', uniqueIds);

  if (error) throw error;

  const nameById = new Map<string, string>();
  (customers || []).forEach((c) => {
    const id = String(c['CUSTOMER ID'] || '').trim();
    const name =
      c['CUSTOMER SUB NAME'] ||
      c['CUSTOMER MAIN NAME'] ||
      id;
    if (id) nameById.set(id, name);
  });

  return nameById;
}

export async function GET() {
  try {
    const { data: rows, error } = await bhs_supabas
      .from(TABLE)
      .select('"ID", "CUSTOMER ID", "CREATED_AT"')
      .order('CREATED_AT', { ascending: false });

    if (error) throw error;

    const customerIds = (rows || []).map((r) => String(r['CUSTOMER ID'] || '').trim());
    const nameById = await resolveCustomerNames(customerIds);

    const data = (rows || []).map((row) => {
      const customerId = String(row['CUSTOMER ID'] || '').trim();
      return {
        customerId,
        customerName: nameById.get(customerId) || customerId,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('InactiveCustomer GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch inactive customer exceptions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerId = String(body.customerId || '').trim();
    const customerName = String(body.customerName || '').trim();

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await bhs_supabas
      .from(TABLE)
      .select('"ID"')
      .eq('CUSTOMER ID', customerId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json({ success: true, alreadyExists: true });
    }

    const { error } = await bhs_supabas.from(TABLE).insert({
      ID: customerId,
      'CUSTOMER ID': customerId,
    });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { customerId, customerName: customerName || customerId },
    });
  } catch (error) {
    console.error('InactiveCustomer POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to hide inactive customer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = String(searchParams.get('customerId') || '').trim();

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    const { error } = await bhs_supabas
      .from(TABLE)
      .delete()
      .eq('CUSTOMER ID', customerId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('InactiveCustomer DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Failed to restore inactive customer';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
