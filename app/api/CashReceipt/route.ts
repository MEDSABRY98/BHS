import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/Supabase';

/**
 * Saves a cash receipt to the Supabase table 'web_Cash_Receipt'
 */
async function saveCashReceipt(data: {
  date: string;
  receiptNumber: string;
  receivedFrom: string;
  sendBy: string;
  amount: number;
  amountInWords: string;
  reason: string;
}): Promise<{ success: boolean }> {
  try {
    const { error } = await bhs_supabase
      .from('web_Cash_Receipt')
      .insert([{
        "DATE": data.date,
        "RECEIPT NUMBER": data.receiptNumber,
        "RECEIVED FROM": data.receivedFrom,
        "SEND BY": data.sendBy,
        "AMOUNT": data.amount,
        "AMOUNT IN WORDS": data.amountInWords,
        "PAYMENT REASON": data.reason
      }]);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error saving cash receipt:', error);
    throw error;
  }
}

/**
 * Gets the last receipt number to preview the next one
 */
async function getLastReceiptNumber(): Promise<string> {
  try {
    const { data, error } = await bhs_supabase
      .from('web_Cash_Receipt')
      .select('"RECEIPT NUMBER"')
      .order('ID', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0 || !data[0]['RECEIPT NUMBER']) {
      return 'R-0000'; // Default start so next is R-0001
    }

    return data[0]['RECEIPT NUMBER'];
  } catch (error) {
    console.error('Error getting last receipt number:', error);
    return 'R-0000';
  }
}

/**
 * Fetches all cash receipts
 */
async function getAllReceipts() {
  try {
    const { data, error } = await bhs_supabase
      .from('web_Cash_Receipt')
      .select('*')
      .order('ID', { ascending: false });

    if (error) throw error;
    if (!data) return [];

    return data.map((row) => ({
      rowIndex: row['ID'], // Using ID instead of index
      date: row['DATE'] || '',
      receiptNumber: row['RECEIPT NUMBER'] || '',
      receivedFrom: row['RECEIVED FROM'] || '',
      sendBy: row['SEND BY'] || '',
      amount: parseFloat(row['AMOUNT']?.toString() || '0'),
      amountInWords: row['AMOUNT IN WORDS'] || '',
      reason: row['PAYMENT REASON'] || '',
    }));
  } catch (error) {
    console.error('Error fetching all receipts:', error);
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchAll = searchParams.get('all') === 'true';

    if (fetchAll) {
      const receipts = await getAllReceipts();
      return NextResponse.json({ receipts });
    }

    const lastId = await getLastReceiptNumber();
    const parts = lastId.split('-');
    let nextNum = 1;

    if (parts.length > 1) {
      const numPart = parseInt(parts[1], 10);
      if (!isNaN(numPart)) {
        nextNum = numPart + 1;
      }
    }

    const nextId = `R-${nextNum.toString().padStart(4, '0')}`;
    return NextResponse.json({ nextId });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, receiptNumber, receivedFrom, sendBy, amount, amountInWords, reason } = body;

    if (!date || !receiptNumber || !receivedFrom || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if receipt number already exists
    const { data: existing, error: searchError } = await bhs_supabase
      .from('web_Cash_Receipt')
      .select('"RECEIPT NUMBER"')
      .ilike('"RECEIPT NUMBER"', receiptNumber)
      .limit(1);
      
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Receipt number ${receiptNumber} already exists in the system.` },
        { status: 409 }
      );
    }

    await saveCashReceipt({
      date,
      receiptNumber,
      receivedFrom,
      sendBy,
      amount: parseFloat(amount),
      amountInWords,
      reason,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save cash receipt' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { date, receiptNumber, receivedFrom, sendBy, amount, amountInWords, reason } = body;

    if (!receiptNumber) {
      return NextResponse.json(
        { error: 'Missing receipt number for update' },
        { status: 400 }
      );
    }

    const { error } = await bhs_supabase
      .from('web_Cash_Receipt')
      .update({
        "DATE": date,
        "RECEIVED FROM": receivedFrom,
        "SEND BY": sendBy,
        "AMOUNT": parseFloat(amount),
        "AMOUNT IN WORDS": amountInWords,
        "PAYMENT REASON": reason
      })
      .eq('"RECEIPT NUMBER"', receiptNumber);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update cash receipt' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptNumber = searchParams.get('receiptNumber');

    if (!receiptNumber) {
      return NextResponse.json(
        { error: 'Missing receipt number for deletion' },
        { status: 400 }
      );
    }

    const { error } = await bhs_supabase
      .from('web_Cash_Receipt')
      .delete()
      .eq('"RECEIPT NUMBER"', receiptNumber);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete cash receipt' },
      { status: 500 }
    );
  }
}
