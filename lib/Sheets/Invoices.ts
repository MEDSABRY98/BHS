import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Core';

const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Invoices';

export async function getSheetData() {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:I`, // DATE, DUE DATE, NUMBER, CUSTOMER NAME, SALESREP, DEBIT, CREDIT, RESIDUAL, MATCHING
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    const data = rows.slice(1).map((row) => {
      const [date, dueDate, number, customerName, salesRep, debit, credit, residualAmount, matching] = row;
      return {
        date: date || '',
        dueDate: dueDate || '',
        number: number?.toString() || '',
        customerName: customerName || '',
        debit: parseFloat(debit?.toString().replace(/,/g, '') || '0'),
        credit: parseFloat(credit?.toString().replace(/,/g, '') || '0'),
        salesRep: salesRep || '',
        residualAmount: parseFloat(residualAmount?.toString().replace(/,/g, '') || '0'),
        matching: matching?.toString() || '',
      };
    }).filter(row => row.customerName);

    return data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

export async function getSupplierData() {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const [purchaseRes, refundRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'S-Invoices - Purchase'!A:D",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "'S-Invoices - Refund'!A:D",
      })
    ]);

    const parseRows = (rows: any[], type: 'Purchase' | 'Refund') => {
      if (!rows || rows.length < 2) return [];
      return rows.slice(1).map(row => ({
        date: row[0] || '',
        number: row[1]?.toString() || '',
        supplierName: row[2]?.toString() || '',
        amount: parseFloat(row[3]?.toString().replace(/,/g, '') || '0'),
        type
      })).filter(r => r.supplierName);
    };

    const purchases = parseRows(purchaseRes.data.values || [], 'Purchase');
    const refunds = parseRows(refundRes.data.values || [], 'Refund');

    return [...purchases, ...refunds];
  } catch (error) {
    console.error('Error fetching supplier data:', error);
    throw error;
  }
}
