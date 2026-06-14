import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Core';

export async function getClosedCustomers(): Promise<Set<string>> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `CLOSED!A:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return new Set();
    }

    const closedCustomers = new Set<string>();
    rows.slice(1).forEach((row) => {
      const customerName = row[1]?.toString().trim();
      if (customerName) {
        const normalized = customerName.toLowerCase().trim().replace(/\s+/g, ' ');
        closedCustomers.add(normalized);
      }
    });

    return closedCustomers;
  } catch (error) {
    console.error('Error fetching closed customers:', error);
    return new Set();
  }
}

export async function getSemiClosedCustomers(): Promise<Set<string>> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `SEMI-CLOSED!A:B`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return new Set();
    }

    const semiClosedCustomers = new Set<string>();
    rows.slice(1).forEach((row) => {
      const customerName = row[1]?.toString().trim();
      if (customerName) {
        const normalized = customerName.toLowerCase().trim().replace(/\s+/g, ' ');
        semiClosedCustomers.add(normalized);
      }
    });

    return semiClosedCustomers;
  } catch (error) {
    console.error('Error fetching semi-closed customers:', error);
    return new Set();
  }
}
