import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials } from './Core';

// --- Helpers ---
const normalizeCustomerKey = (name: string): string =>
  name.toString().toLowerCase().trim().replace(/\s+/g, ' ');

const splitCustomerGroupNames = (text: string): string[] =>
  text
    .split('&')
    .map((p) => p.trim())
    .filter(Boolean);

export async function resolveCustomerEmailTargets(customerName: string): Promise<{ customers: string[]; emails: string[] }> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `EMAILS!A:C`, // CUSTOMER ID, CUSTOMER NAME, EMAIL
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return { customers: [], emails: [] };

    const dataRows = rows.slice(1).map((row) => {
      const customerId = row[0]?.toString().trim() || '';
      const name = row[1]?.toString().trim() || '';
      const email = row[2]?.toString().trim() || '';
      return { customerId, name, email };
    }).filter(r => r.name);

    const emailByCustomer = new Map<string, string>();
    dataRows.forEach(r => {
      if (r.email) emailByCustomer.set(normalizeCustomerKey(r.name), r.email);
    });

    const requestedNormalized = normalizeCustomerKey(customerName);

    let customers: string[] = [];
    let groupRowEmail: string | null = null;

    if (customerName.includes('&')) {
      customers = splitCustomerGroupNames(customerName);
      const exactGroupRow = dataRows.find(r => normalizeCustomerKey(r.name) === requestedNormalized);
      groupRowEmail = exactGroupRow?.email || null;
    } else {
      const groupRow = dataRows.find(r => {
        if (!r.name.includes('&')) return false;
        const parts = splitCustomerGroupNames(r.name).map(normalizeCustomerKey);
        return parts.some(p => p === requestedNormalized);
      });
      if (groupRow) {
        customers = splitCustomerGroupNames(groupRow.name);
        groupRowEmail = groupRow.email || null;
      } else {
        customers = [customerName.trim()];
      }
    }

    const emails: string[] = [];
    customers.forEach(c => {
      const e = emailByCustomer.get(normalizeCustomerKey(c));
      if (e) emails.push(e);
    });

    if (emails.length === 0 && groupRowEmail) {
      const parsed = groupRowEmail
        .split(/[,&;]+/)
        .map(s => s.trim())
        .filter(Boolean);
      emails.push(...parsed);
    }

    const uniqueEmails = Array.from(new Set(emails));
    return { customers, emails: uniqueEmails };
  } catch (error) {
    console.error('Error resolving customer email targets:', error);
    return { customers: [], emails: [] };
  }
}

export async function getAllCustomerEmails(): Promise<string[]> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `EMAILS!A:C`, // CUSTOMER ID, CUSTOMER NAME, EMAIL
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    const customersWithEmails = rows.slice(1)
      .filter(row => row[1] && row[2] && row[2].toString().trim() !== '')
      .map(row => ({
        customerName: row[1].toString().trim(),
        email: row[2].toString().trim()
      }));

    return customersWithEmails as any;
  } catch (error) {
    console.error('Error fetching all customer emails:', error);
    return [];
  }
}

export async function getLuluEmails(): Promise<any[]> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'EMAILS - LULU'!A:F`, // CUSTOMER ID, CUSTOMER CODE, AREA, CUSTOMER NAME, TO:, CC:
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    return rows.slice(1).map((row) => ({
      customerId: row[0] || '',
      customerCode: row[1] || '',
      area: row[2] || '',
      customerName: row[3] || '',
      to: row[4] || '',
      cc: row[5] || '',
    })).filter(r => r.customerName);
  } catch (error) {
    console.error('Error fetching Lulu emails:', error);
    return [];
  }
}
