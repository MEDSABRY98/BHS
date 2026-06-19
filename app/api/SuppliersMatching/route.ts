import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/supabase';
import { getNextSupplierRecordId } from '@/app/DataBase/Utils/SupplierRecordIds';

export async function GET() {
  try {
    const { data, error } = await bhs_supabas
      .from('web_Suppliers_Matching')
      .select('"ID", "SUPPLIER NAME", "MONTHS"')
      .order('SUPPLIER NAME');

    if (error) throw error;

    const mapped = (data || []).map((row) => ({
      id: row.ID || '',
      name: row['SUPPLIER NAME'] || '',
      months: row.MONTHS || '',
    }));

    return NextResponse.json({ data: mapped });
  } catch (error) {
    console.error('API Error fetching suppliers matching:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to fetch matching data', details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supplierName, months } = await request.json();
    const normalizedName = String(supplierName || '').trim();
    if (!normalizedName) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 });
    }

    const { data: existingRows, error: fetchError } = await bhs_supabas
      .from('web_Suppliers_Matching')
      .select('"ID", "SUPPLIER NAME"');

    if (fetchError) throw fetchError;

    const match = (existingRows || []).find(
      (row) => String(row['SUPPLIER NAME'] || '').trim().toLowerCase() === normalizedName.toLowerCase()
    );

    if (match?.ID) {
      const { error: updateError } = await bhs_supabas
        .from('web_Suppliers_Matching')
        .update({
          MONTHS: months || '',
          UPDATED_AT: new Date().toISOString(),
        })
        .eq('ID', match.ID);

      if (updateError) throw updateError;
    } else {
      const nextId = await getNextSupplierRecordId('web_Suppliers_Matching');
      const { error: insertError } = await bhs_supabas.from('web_Suppliers_Matching').insert({
        ID: nextId,
        'SUPPLIER NAME': normalizedName,
        MONTHS: months || '',
      });

      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error saving suppliers matching:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to save matching data', details: message }, { status: 500 });
  }
}
