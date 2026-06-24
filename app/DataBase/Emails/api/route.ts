import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await bhs_supabase.from('debit_EMILS').select('*');
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, email } = body;
    
    // We assume ID is auto-generated
    const { data, error } = await bhs_supabase.from('debit_EMILS').insert({
      'CUSTOMER ID': customerId,
      'EMAIL_NAME': email
    }).select();
    
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    // Assuming there's an ID. If not, we will fallback to CUSTOMER ID
    const { id, customerId, email } = body;
    
    let query = bhs_supabase.from('debit_EMILS').update({
      'CUSTOMER ID': customerId,
      'EMAIL_NAME': email
    });
    
    if (id) {
      query = query.eq('ID', id);
    } else {
      query = query.eq('CUSTOMER ID', customerId); // Fallback
    }

    const { data, error } = await query.select();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const customerId = searchParams.get('customerId');
    
    let query = bhs_supabase.from('debit_EMILS').delete();
    if (id) {
      query = query.eq('ID', id);
    } else if (customerId) {
      query = query.eq('CUSTOMER ID', customerId);
    } else {
      throw new Error('ID or CUSTOMER ID is required to delete');
    }

    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
