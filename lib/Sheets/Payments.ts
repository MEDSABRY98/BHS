import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Core';

/** Used only by /api/SuppliersMigrate for one-time import from Google Sheets. */
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

    return rows.slice(1).map((row) => ({
      id: row[0] || '',
      name: row[1] || '',
      months: row[2] || '',
    }));
  } catch (error) {
    console.error('Error fetching suppliers matching data:', error);
    return [];
  }
}

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
