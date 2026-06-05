import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

export async function GET() {
  try {
    // Fetch inactive customer exceptions, joining bhs_CUSTOMERS to get name and business ID
    const { data, error } = await bhs_supabas
      .from('web_SALES_DB_INACTIVECUSTOMERS')
      .select(`
        ID,
        customer:bhs_CUSTOMERS (
          ID,
          "CUSTOMER ID",
          "CUSTOMER SUB NAME"
        )
      `);

    if (error) throw error;

    // Map the relational structure to match the frontend expectations
    const formattedData = (data || [])
      .filter((item: any) => item.customer)
      .map((item: any) => ({
        customerId: item.customer["CUSTOMER ID"],
        customerName: item.customer["CUSTOMER SUB NAME"]
      }));

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error('API Error fetching exceptions:', error);
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
    const { customerId } = await request.json();
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // 1. Resolve business Customer ID to internal DB ID
    const { data: customer, error: custErr } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('ID')
      .eq('CUSTOMER ID', customerId.trim())
      .maybeSingle();

    if (custErr) throw custErr;
    if (!customer) {
      return NextResponse.json({ error: `Customer "${customerId}" not found in database.` }, { status: 404 });
    }

    // 2. Generate the next sequential ID (R-XXXX) for the exception list
    const { data: existingInactive, error: inactiveErr } = await bhs_supabas
      .from('web_SALES_DB_INACTIVECUSTOMERS')
      .select('ID');

    if (inactiveErr) throw inactiveErr;

    let nextNum = 1;
    if (existingInactive && existingInactive.length > 0) {
      existingInactive.forEach((item: any) => {
        const match = item.ID.match(/^R-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= nextNum) {
            nextNum = num + 1;
          }
        }
      });
    }
    const nextId = `R-${String(nextNum).padStart(4, '0')}`;

    // 3. Insert the customer into the exception list
    const { error: insertErr } = await bhs_supabas
      .from('web_SALES_DB_INACTIVECUSTOMERS')
      .upsert({
        ID: nextId,
        "CUSTOMER ID": customer.ID
      }, { onConflict: 'CUSTOMER ID' });

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error adding exception:', error);
    return NextResponse.json({ error: 'Failed to add exception', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    // 1. Resolve business Customer ID to internal DB ID
    const { data: customer, error: custErr } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('ID')
      .eq('CUSTOMER ID', customerId.trim())
      .maybeSingle();

    if (custErr) throw custErr;
    if (!customer) {
      return NextResponse.json({ error: `Customer "${customerId}" not found in database.` }, { status: 404 });
    }

    // 2. Delete the exception record
    const { error: deleteErr } = await bhs_supabas
      .from('web_SALES_DB_INACTIVECUSTOMERS')
      .delete()
      .eq('CUSTOMER ID', customer.ID);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error removing exception:', error);
    return NextResponse.json({ error: 'Failed to remove exception', details: error.message }, { status: 500 });
  }
}
