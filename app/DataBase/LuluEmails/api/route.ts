import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await bhs_supabase.from('debit_EMILS_LULU').select('*');
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, customerCode, to, cc } = body;
    
    const { data, error } = await bhs_supabase.from('debit_EMILS_LULU').insert({
      'CUSTOMER ID': customerId,
      'CUSTOMER CODE': customerCode,
      'TO:': to,
      'CC:': cc
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
    const { id, customerId, customerCode, to, cc } = body;
    
    let query = bhs_supabase.from('debit_EMILS_LULU').update({
      'CUSTOMER ID': customerId,
      'CUSTOMER CODE': customerCode,
      'TO:': to,
      'CC:': cc
    });
    
    if (id) {
      query = query.eq('ID', id);
    } else {
      query = query.eq('CUSTOMER ID', customerId);
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
    
    let query = bhs_supabase.from('debit_EMILS_LULU').delete();
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
