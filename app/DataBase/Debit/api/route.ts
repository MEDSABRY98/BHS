import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  try {
    const { error } = await bhs_supabase.from('mix_DEBIT').delete().neq('ID', 0); // Delete all rows
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'All data deleted successfully.' });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete data', details: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body;
    
    if (!data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Upsert or Insert data
    const chunkSize = 1000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const { error } = await bhs_supabase.from('mix_DEBIT').insert(chunk);
      if (error) throw error;
    }

    return NextResponse.json({ success: true, message: `${data.length} rows inserted successfully.` });
  } catch (error: any) {
    console.error('Insert Error:', error);
    return NextResponse.json({ error: 'Failed to insert data', details: error.message }, { status: 500 });
  }
}
