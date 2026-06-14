import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/Supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const refresh = searchParams.get('refresh') === 'true';

    // -------------------------------------------------------------
    // مسار تجميع الشهور (Months Aggregation)
    // -------------------------------------------------------------
    if (action === 'months') {
      if (!refresh) {
        const { data: cacheRow, error: cacheErr } = await bhs_supabas
          .from('web_Sales_DB_Cache')
          .select('DATA')
          .eq('KEY', 'months_data')
          .single();

        if (!cacheErr && cacheRow && cacheRow.DATA) {
          return NextResponse.json({ data: cacheRow.DATA });
        }
      }

      const { data, error } = await bhs_supabas.rpc('get_sales_months_summary');
      if (error) throw error;

      const monthsList = (data || []).map((row: any) => ({
        year: Number(row.year),
        month: Number(row.month),
        count: Number(row.count),
      }));

      await bhs_supabas
        .from('web_Sales_DB_Cache')
        .update({ DATA: monthsList, UPDATED_AT: new Date().toISOString() })
        .eq('KEY', 'months_data');

      return NextResponse.json({ data: monthsList });
    }

    // -------------------------------------------------------------
    // مسار جلب المبيعات بالكامل (All Sales Data)
    // -------------------------------------------------------------

    if (!refresh) {
      const { data: cacheRow, error: cacheErr } = await bhs_supabas
        .from('web_Sales_DB_Cache')
        .select('DATA')
        .eq('KEY', 'sales_data')
        .single();

      if (!cacheErr && cacheRow && cacheRow.DATA) {
        return NextResponse.json({ data: cacheRow.DATA });
      }
    }

    const { error: rpcErr } = await bhs_supabas.rpc('refresh_sales_cache');
    if (rpcErr) throw rpcErr;

    const { data: freshCache, error: fetchErr } = await bhs_supabas
      .from('web_Sales_DB_Cache')
      .select('DATA')
      .eq('KEY', 'sales_data')
      .single();

    if (fetchErr) throw fetchErr;

    return NextResponse.json({ data: freshCache?.DATA || [] });

  } catch (error: any) {
    console.error('API Error fetching sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales data', details: error.message || error },
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

    await bhs_supabas.from('web_Sales_DB_Cache').update({ DATA: null }).eq('KEY', 'sales_data');
    await bhs_supabas.from('web_Sales_DB_Cache').update({ DATA: null }).eq('KEY', 'months_data');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error deleting month sales:', error);
    return NextResponse.json(
      { error: 'Failed to delete month sales data', details: error.message || error },
      { status: 500 }
    );
  }
}
