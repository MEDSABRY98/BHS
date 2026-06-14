import { NextResponse } from 'next/server';
import { bhs_supabas } from '@/lib/Supabase';

export async function GET() {
  try {
    const { data, error } = await bhs_supabas
      .from('bhs_CUSTOMERS')
      .select('"CUSTOMER ID", "CUSTOMER MAIN NAME", "CUSTOMER SUB NAME"')
      .order('CUSTOMER MAIN NAME', { ascending: true });

    if (error) throw error;

    const uniqueCustomers = (data || []).map((c: any) => ({
      id: c['CUSTOMER ID'],
      mainName: c['CUSTOMER MAIN NAME'] || '',
      subName: c['CUSTOMER SUB NAME'] || ''
    }));

    return NextResponse.json({ uniqueCustomers });

  } catch (error: any) {
    console.error('API Error CustomersList:', error);
    return NextResponse.json({ error: 'Failed to fetch customers list', details: error.message || error }, { status: 500 });
  }
}
