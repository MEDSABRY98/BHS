import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServiceAccountCredentials, SPREADSHEET_ID } from '@/lib/googleSheets';

/**
 * Saves a cash receipt to the 'Cash Receipt' sheet.
 * Columns: DATE, RECEIPT NUMBER, RECEIVED FROM, SEND BY, AMOUNT, AMOUNT IN WORDS, PAYMENT REASON
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
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const rowValues = [
      data.date,           // A: DATE
      data.receiptNumber,  // B: RECEIPT NUMBER
      data.receivedFrom,   // C: RECEIVED FROM
      data.sendBy,         // D: SEND BY
      data.amount.toString(), // E: AMOUNT
      data.amountInWords,  // F: AMOUNT IN WORDS
      data.reason          // G: PAYMENT REASON
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Cash Receipt'!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving cash receipt:', error);
    throw error;
  }
}

/**
 * Gets the last receipt number from the 'Cash Receipt' sheet.
 */
async function getLastReceiptNumber(): Promise<string> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Cash Receipt'!B:B`, // RECEIPT NUMBER column
    });

    const values = response.data.values;
    if (!values || values.length <= 1) {
      return 'CAH-000'; // Default if no data or only header
    }

    // Filter out empty or non-ID rows and get the last one
    const idRows = values.filter((row: string[]) => row[0] && row[0].includes('-'));
    if (idRows.length === 0) return 'CAH-000';

    return idRows[idRows.length - 1][0];
  } catch (error) {
    console.error('Error getting last receipt number:', error);
    return 'CAH-000';
  }
}

/**
 * Fetches all cash receipts from the 'Cash Receipt' sheet.
 */
async function getAllReceipts() {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Cash Receipt'!A:G`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return [];
    }

    // Header Row: DATE, RECEIPT NUMBER, RECEIVED FROM, SEND BY, AMOUNT, AMOUNT IN WORDS, PAYMENT REASON
    return rows.slice(1).map((row, index) => ({
      rowIndex: index + 2, // 1-based index + header offset
      date: row[0] || '',
      receiptNumber: row[1] || '',
      receivedFrom: row[2] || '',
      sendBy: row[3] || '',
      amount: parseFloat(row[4]?.toString().replace(/,/g, '') || '0'),
      amountInWords: row[5] || '',
      reason: row[6] || '',
    })).filter(r => r.receiptNumber);
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
      const numPart = parseInt(parts[1]);
      if (!isNaN(numPart)) {
        nextNum = numPart + 1;
      }
    }

    const nextId = `CAH-${nextNum.toString().padStart(3, '0')}`;
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
    const allReceipts = await getAllReceipts();
    const exists = allReceipts.some((r: any) => r.receiptNumber.toLowerCase() === receiptNumber.toLowerCase());
    if (exists) {
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
