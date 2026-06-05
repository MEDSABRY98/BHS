import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

export async function GET() {
  try {
    // Single aggregation query via DB-side RPC — fast thanks to index on "INVOICE DATE"
    const { data, error } = await bhs_supabas.rpc('get_sales_months_summary');

    if (error) throw error;

    const monthsList = (data || []).map((row: any) => ({
      year: Number(row.year),
      month: Number(row.month),
      count: Number(row.count),
    }));

    return NextResponse.json({ data: monthsList });
  } catch (error: any) {
    console.error('API Error fetching sales months:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales months', details: error.message || error },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and Month are required' }, { status: 400 });
    }

    const y = parseInt(year);
    const m = parseInt(month);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const endDate = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const { error } = await bhs_supabas
      .from('web_Sales_DB')
      .delete()
      .gte('INVOICE DATE', startDate)
      .lt('INVOICE DATE', endDate);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error deleting month sales:', error);
    return NextResponse.json(
      { error: 'Failed to delete month sales data', details: error.message || error },
      { status: 500 }
    );
  }
}
