import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

function parseRecordNum(id: string): number | null {
  const baseId = String(id || '').split('#')[0].trim().toUpperCase();
  if (!baseId.startsWith('R-')) return null;
  const num = parseInt(baseId.substring(2), 10);
  return Number.isNaN(num) ? null : num;
}

function formatRecordId(num: number): string {
  return `R-${String(num).padStart(4, '0')}`;
}

function parseReceiptNum(receiptNumber: string): number | null {
  const value = String(receiptNumber || '').trim().toUpperCase();
  const cahMatch = value.match(/^CAH-(\d+)$/);
  if (cahMatch) {
    const num = parseInt(cahMatch[1], 10);
    return Number.isNaN(num) ? null : num;
  }
  return parseRecordNum(value);
}

function formatReceiptNumber(num: number): string {
  return `CAH-${String(num).padStart(3, '0')}`;
}

async function getMaxRecordNum(): Promise<number> {
  const { data, error } = await bhs_supabase.from('web_Cash_Receipt').select('ID');
  if (error) throw error;

  let maxNum = 0;
  (data || []).forEach((row) => {
    const num = parseRecordNum(row.ID || '');
    if (num !== null && num > maxNum) maxNum = num;
  });
  return maxNum;
}

async function getMaxReceiptNum(): Promise<number> {
  const { data, error } = await bhs_supabase
    .from('web_Cash_Receipt')
    .select('"RECEIPT NUMBER"');
  if (error) throw error;

  let maxNum = 0;
  (data || []).forEach((row) => {
    const num = parseReceiptNum(row['RECEIPT NUMBER'] || '');
    if (num !== null && num > maxNum) maxNum = num;
  });
  return maxNum;
}

async function getNextRecordPair(): Promise<{ id: string; receiptNumber: string }> {
  const nextNum = Math.max(await getMaxRecordNum(), await getMaxReceiptNum()) + 1;
  return {
    id: formatRecordId(nextNum),
    receiptNumber: formatReceiptNumber(nextNum),
  };
}

/**
 * Saves a cash receipt to the Supabase table 'web_Cash_Receipt'
 */
async function saveCashReceipt(data: {
  id: string;
  date: string;
  receiptNumber: string;
  receivedFrom: string;
  sendBy: string;
  amount: number;
  amountInWords: string;
  reason: string;
}): Promise<{ success: boolean }> {
  const { error } = await bhs_supabase.from('web_Cash_Receipt').insert([
    {
      ID: data.id,
      DATE: data.date,
      'RECEIPT NUMBER': data.receiptNumber,
      'RECEIVED FROM': data.receivedFrom,
      'SEND BY': data.sendBy,
      AMOUNT: data.amount,
      'AMOUNT IN WORDS': data.amountInWords,
      'PAYMENT REASON': data.reason,
    },
  ]);

  if (error) throw error;
  return { success: true };
}

/**
 * Fetches all cash receipts
 */
async function getAllReceipts() {
  const { data, error } = await bhs_supabase
    .from('web_Cash_Receipt')
    .select('*')
    .order('ID', { ascending: false });

  if (error) throw error;
  if (!data) return [];

  return data.map((row) => ({
    rowIndex: row['ID'],
    date: row['DATE'] || '',
    receiptNumber: row['RECEIPT NUMBER'] || '',
    receivedFrom: row['RECEIVED FROM'] || '',
    sendBy: row['SEND BY'] || '',
    amount: parseFloat(row['AMOUNT']?.toString() || '0'),
    amountInWords: row['AMOUNT IN WORDS'] || '',
    reason: row['PAYMENT REASON'] || '',
  }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fetchAll = searchParams.get('all') === 'true';

    if (fetchAll) {
      const receipts = await getAllReceipts();
      return NextResponse.json({ receipts });
    }

    const next = await getNextRecordPair();
    return NextResponse.json({
      nextId: next.receiptNumber,
      nextReceiptNumber: next.receiptNumber,
    });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, receiptNumber, receivedFrom, sendBy, amount, amountInWords, reason } = body;

    if (!date || !receivedFrom || amount === undefined || amount === null || amount === '') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const next = await getNextRecordPair();
    const clientNum = receiptNumber ? parseReceiptNum(String(receiptNumber)) : null;
    const nextNum = parseReceiptNum(next.receiptNumber);
    const finalReceiptNumber =
      clientNum !== null && clientNum === nextNum
        ? formatReceiptNumber(clientNum)
        : next.receiptNumber;

    const { data: existing, error: searchError } = await bhs_supabase
      .from('web_Cash_Receipt')
      .select('"RECEIPT NUMBER"')
      .ilike('"RECEIPT NUMBER"', finalReceiptNumber)
      .limit(1);

    if (searchError) throw searchError;

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `Receipt number ${finalReceiptNumber} already exists in the system.` },
        { status: 409 }
      );
    }

    const receiptNum = parseReceiptNum(finalReceiptNumber);
    const recordId = receiptNum !== null ? formatRecordId(receiptNum) : next.id;

    const { data: existingId, error: idSearchError } = await bhs_supabase
      .from('web_Cash_Receipt')
      .select('ID')
      .eq('ID', recordId)
      .limit(1);

    if (idSearchError) throw idSearchError;

    if (existingId && existingId.length > 0) {
      return NextResponse.json(
        { error: `Record ID ${recordId} already exists. Please refresh and try again.` },
        { status: 409 }
      );
    }

    await saveCashReceipt({
      id: recordId,
      date,
      receiptNumber: finalReceiptNumber,
      receivedFrom,
      sendBy: sendBy || '',
      amount: parseFloat(String(amount)),
      amountInWords: amountInWords || '',
      reason: reason || '',
    });

    return NextResponse.json({ success: true, receiptNumber: finalReceiptNumber });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save cash receipt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { date, receiptNumber, receivedFrom, sendBy, amount, amountInWords, reason } = body;

    if (!receiptNumber) {
      return NextResponse.json({ error: 'Missing receipt number for update' }, { status: 400 });
    }

    const { error } = await bhs_supabase
      .from('web_Cash_Receipt')
      .update({
        DATE: date,
        'RECEIVED FROM': receivedFrom,
        'SEND BY': sendBy,
        AMOUNT: parseFloat(String(amount)),
        'AMOUNT IN WORDS': amountInWords,
        'PAYMENT REASON': reason,
      })
      .eq('"RECEIPT NUMBER"', receiptNumber);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update cash receipt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const receiptNumber = searchParams.get('receiptNumber');

    if (!receiptNumber) {
      return NextResponse.json({ error: 'Missing receipt number for deletion' }, { status: 400 });
    }

    const { error } = await bhs_supabase
      .from('web_Cash_Receipt')
      .delete()
      .eq('"RECEIPT NUMBER"', receiptNumber);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete cash receipt';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
