import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Core';
import { VisitCustomerEntry } from '@/types';

// ============================================================
// PAYMENT DEFINITIONS
// ============================================================

export interface PaymentDefinitionEntry {
  customerId: string;
  customerName: string;
  date: string;
  invoiceNumber: string;
  amount: number;
  monthsClosed: string;
  rowIndex: number;
}

export async function getPaymentDefinitions() {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Definition-PAYMENT'!A:F`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    return rows.slice(1).map((row, index) => ({
      customerId: row[0]?.toString() || '',
      customerName: row[1]?.toString() || '',
      date: row[2]?.toString() || '',
      invoiceNumber: row[3]?.toString() || '',
      amount: parseFloat(row[4]?.toString().replace(/,/g, '') || '0'),
      monthsClosed: row[5]?.toString() || '',
      rowIndex: index + 2
    }));
  } catch (error) {
    console.error('Error fetching payment definitions:', error);
    throw error;
  }
}

export async function updatePaymentDefinition(rowIndex: number, monthsClosed: string) {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Definition-PAYMENT'!F${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[monthsClosed]],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating payment definition:', error);
    throw error;
  }
}

// ============================================================
// VISIT CUSTOMERS
// ============================================================

export async function getVisitCustomersData(): Promise<VisitCustomerEntry[]> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Visit Customers'!A:G`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    return rows.slice(1).map((row, index) => ({
      date: row[0] || '',
      customerName: row[1] || '',
      city: row[2] || '',
      salesRepName: row[3] || '',
      collectMoney: row[4] || '',
      howMuchCollectMoney: parseFloat(row[5]?.toString().replace(/,/g, '') || '0'),
      notes: row[6] || '',
      rowIndex: index + 2
    })).filter(e => e.customerName);
  } catch (error) {
    console.error('Error fetching Visit Customers data:', error);
    return [];
  }
}

export async function addVisitCustomerEntry(entries: VisitCustomerEntry | VisitCustomerEntry[]) {
  try {
    const entryList = Array.isArray(entries) ? entries : [entries];
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Visit Customers'!A:G`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: entryList.map(entry => [
          entry.date,
          entry.customerName,
          entry.city,
          entry.salesRepName,
          entry.collectMoney,
          entry.howMuchCollectMoney,
          entry.notes
        ]),
      },
    });
    return { success: true };
  } catch (error) {
    console.error('Error adding Visit Customer entries:', error);
    throw error;
  }
}

export async function updateVisitCustomerEntry(rowIndex: number, entry: VisitCustomerEntry) {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Visit Customers'!A${rowIndex}:G${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          entry.date,
          entry.customerName,
          entry.city,
          entry.salesRepName,
          entry.collectMoney,
          entry.howMuchCollectMoney,
          entry.notes
        ]],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating Visit Customer entry:', error);
    throw error;
  }
}

// ============================================================
// SUPPLIERS MATCHING
// ============================================================

export async function getSuppliersMatchingData() {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'S - Matching'!A:C`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    return rows.slice(1).map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      months: row[2] || '',
    }));
  } catch (error) {
    console.error('Error fetching suppliers matching data:', error);
    return [];
  }
}

export async function saveSuppliersMatchingData(supplierId: string, supplierName: string, months: string) {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'S - Matching'!A:B`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex(row => row[1]?.toString().trim().toLowerCase() === supplierName.trim().toLowerCase());

    if (rowIndex !== -1) {
      const sheetRow = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `'S - Matching'!C${sheetRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[months]] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `'S - Matching'!B:C`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[supplierName, months]] },
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving suppliers matching data:', error);
    throw error;
  }
}

// ============================================================
// SALES INTERFACES (shared types)
// ============================================================

export interface SalesInvoice {
  invoiceDate: string;
  invoiceNumber: string;
  customerId: string;
  customerMainName: string;
  customerName: string;
  area: string;
  market: string;
  merchandiser: string;
  salesRep: string;
  productId: string;
  barcode: string;
  product: string;
  productTag: string;
  productCost: number;
  productPrice: number;
  amount: number;
  qty: number;
}

export interface InactiveCustomerException {
  customerId: string;
  customerName: string;
}
