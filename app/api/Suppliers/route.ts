import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';

export async function GET() {
  try {
    const pageSize = 1000;
    let from = 0;
    const allRows: {
      date: string;
      number: string;
      supplierName: string;
      amount: number;
      type: 'Purchase' | 'Refund';
    }[] = [];

    while (true) {
      const { data, error } = await bhs_supabas
        .from('web_Suppliers_Invoices')
        .select('"DATE", "TYPE", "INVOICE NUMBER", "SUPPLIER NAME", "AMOUNT"')
        .order('DATE', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      data.forEach((row) => {
        const supplierName = String(row['SUPPLIER NAME'] || '').trim();
        if (!supplierName) return;

        allRows.push({
          date: row.DATE || '',
          number: row['INVOICE NUMBER']?.toString() || '',
          supplierName,
          amount: parseFloat(String(row.AMOUNT ?? 0)) || 0,
          type: row.TYPE === 'Refund' ? 'Refund' : 'Purchase',
        });
      });

      if (data.length < pageSize) break;
      from += pageSize;
    }

    return NextResponse.json({ data: allRows });
  } catch (error) {
    console.error('API Error fetching supplier data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch supplier data', details: message }, { status: 500 });
  }
}
