import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/Supabase';

// GET: Fetch all voucher records
export async function GET() {
  try {
    const { data, error } = await bhs_supabase
      .from('web_Petty_Cash_Vouchers')
      .select('*')
      .order('VOUCHER NUMBER', { ascending: false });

    if (error) throw error;

    const vouchers = (data || []).map(row => ({
      number: row["VOUCHER NUMBER"],
      date: row.DATE,
      receiptName: row["RECEIPT NAME"],
      amount: Number(row.AMOUNT),
      description: row.DESCRIPTION,
      createdBy: row.CREATED_BY
    }));

    return NextResponse.json({ vouchers });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch vouchers';
    return NextResponse.json(
      {
        error: 'Failed to fetch vouchers',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// POST: Save a new voucher record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, voucherNumber, receiptName, amount, description, createdBy } = body;

    if (!date || !voucherNumber || !receiptName || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { error } = await bhs_supabase
      .from('web_Petty_Cash_Vouchers')
      .insert([{
        "VOUCHER NUMBER": voucherNumber.trim(),
        "DATE": date,
        "RECEIPT NAME": receiptName.trim(),
        "AMOUNT": parseFloat(amount),
        "DESCRIPTION": description || '',
        "CREATED_BY": createdBy || 'System'
      }]);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save voucher';
    return NextResponse.json(
      {
        error: 'Failed to save voucher',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
