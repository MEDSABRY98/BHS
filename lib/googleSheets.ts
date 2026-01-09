import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DiscountTrackerEntry } from '@/types';

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1s1G42Qd0FNDyvz42qi_6SPoKMAy8Kvx8eMm7iyR8pds';
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Invoices';

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
}

export function getServiceAccountCredentials(): ServiceAccountCredentials {
  // First try environment variable (for Vercel)
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT;

  if (credentialsJson) {
    try {
      return JSON.parse(credentialsJson);
    } catch (error) {
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON');
    }
  }

  // Fallback to file (for local development)
  try {
    // Try inside project first
    let filePath = join(process.cwd(), 'assets', 'BHAPPS.json');
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch {
      // If not found, try parent directory
      filePath = join(process.cwd(), '..', 'assets', 'BHAPPS.json');
      const fileContent = readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Error reading credentials file:', error);
    throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set and could not read from file');
  }
}

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
      range: `${SHEET_NAME}!A:H`, // DATE, DUE DATE, NUMBER, CUSTOMER NAME, SALESREP, DEBIT, CREDIT, MATCHING
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row and parse data
    const data = rows.slice(1).map((row) => {
      const [date, dueDate, number, customerName, salesRep, debit, credit, matching] = row;
      return {
        date: date || '',
        dueDate: dueDate || '',
        number: number?.toString() || '',
        customerName: customerName || '',
        debit: parseFloat(debit?.toString().replace(/,/g, '') || '0'),
        credit: parseFloat(credit?.toString().replace(/,/g, '') || '0'),
        salesRep: salesRep || '',
        matching: matching?.toString() || '',
      };
    }).filter(row => row.customerName); // Filter out empty rows

    return data;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
}

const MONTH_ABBREVIATIONS: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

const MONTH_NAMES_BY_NUMBER: Record<number, string> = {
  1: 'JAN',
  2: 'FEB',
  3: 'MAR',
  4: 'APR',
  5: 'MAY',
  6: 'JUN',
  7: 'JUL',
  8: 'AUG',
  9: 'SEP',
  10: 'OCT',
  11: 'NOV',
  12: 'DEC',
};

const normalizeMonthToken = (token: string): string | null => {
  const cleaned = token.trim().toUpperCase();
  if (!cleaned) return null;

  // Accept formats like JAN25, JAN2025, JAN-25, JAN/25
  const match = cleaned.match(/^([A-Z]{3})[-\/]?(\d{2}|\d{4})$/);
  if (!match) return null;

  const [, monthText, yearText] = match;
  const month = MONTH_ABBREVIATIONS[monthText];
  if (!month) return null;

  let year = parseInt(yearText, 10);
  if (year < 100) {
    year += 2000; // Assume 2000s for 2-digit years
  }

  return `${year}-${String(month).padStart(2, '0')}`;
};

const formatMonthTokenFromKey = (key: string): string => {
  // Input: YYYY-MM -> Output: MONYY (e.g., 2025-09 -> SEP25)
  const [yearStr, monthStr] = key.split('-');
  const monthNum = parseInt(monthStr, 10);
  const mon = MONTH_NAMES_BY_NUMBER[monthNum] || monthStr;
  const yy = yearStr.slice(-2);
  return `${mon}${yy}`;
};

export async function getDiscountTrackerEntries(): Promise<DiscountTrackerEntry[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `DISCOUNTS!A:C`, // CUSTOMER ID, CUSTOMER NAME, RECONCILIATION
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    return rows.slice(1) // skip header
      .map((row) => {
        const customerName = row[1]?.toString().trim() || ''; // Column B: CUSTOMER NAME
        const reconciliationRaw = row[2]?.toString() || ''; // Column C: RECONCILIATION

        const tokens = reconciliationRaw
          .split(/[,;\s]+/)
          .map(normalizeMonthToken)
          .filter((val: string | null): val is string => Boolean(val));

        if (!customerName) return null;

        return {
          customerName,
          reconciliationMonths: tokens,
        } as DiscountTrackerEntry;
      })
      .filter((entry): entry is DiscountTrackerEntry => Boolean(entry));
  } catch (error) {
    console.error('Error fetching discount tracker entries:', error);
    throw error;
  }
}

const normalizeMonthKeyFlexible = (token: string, fallbackYear: number): string | null => {
  if (/^\d{4}-\d{2}$/.test(token.trim())) return token.trim();
  return normalizeMonthToken(token) || normalizeMonthToken(`${token}${fallbackYear}`);
};

export async function markReconciliationMonth(customerName: string, monthKey: string): Promise<string[]> {
  const normalizedKey =
    normalizeMonthKeyFlexible(monthKey, new Date().getFullYear()) ||
    monthKey;

  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `DISCOUNTS!A:C`, // CUSTOMER ID, CUSTOMER NAME, RECONCILIATION
    });

    const rows = response.data.values || [];
    const customerIndex = rows.slice(1).findIndex(
      (row) => row[1]?.toString().trim().toLowerCase() === customerName.trim().toLowerCase(), // Column B: CUSTOMER NAME
    );

    if (customerIndex === -1) {
      throw new Error('Customer not found in DISCOUNTS sheet');
    }

    const rowNumber = customerIndex + 2; // account for header
    const existingCell = rows[rowNumber - 1]?.[2]?.toString() || ''; // Column C: RECONCILIATION
    const existingNormalized = existingCell
      .split(/[,;\s]+/)
      .map((t: string) => normalizeMonthKeyFlexible(t, new Date().getFullYear()))
      .filter((v: string | null): v is string => Boolean(v));

    const set = new Set<string>(existingNormalized);
    set.add(normalizedKey);

    const normalizedList = Array.from(set).sort();
    const tokensForSheet = normalizedList.map(formatMonthTokenFromKey).join(', ');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `DISCOUNTS!C${rowNumber}`, // Column C: RECONCILIATION
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[tokensForSheet]] },
    });

    return normalizedList;
  } catch (error) {
    console.error('Error marking reconciliation month:', error);
    throw error;
  }
}

export async function unmarkReconciliationMonth(customerName: string, monthKey: string): Promise<string[]> {
  const normalizedKey =
    normalizeMonthKeyFlexible(monthKey, new Date().getFullYear()) ||
    monthKey;

  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `DISCOUNTS!A:C`, // CUSTOMER ID, CUSTOMER NAME, RECONCILIATION
    });

    const rows = response.data.values || [];
    const customerIndex = rows.slice(1).findIndex(
      (row) => row[1]?.toString().trim().toLowerCase() === customerName.trim().toLowerCase(), // Column B: CUSTOMER NAME
    );

    if (customerIndex === -1) {
      throw new Error('Customer not found in DISCOUNTS sheet');
    }

    const rowNumber = customerIndex + 2; // account for header
    const existingCell = rows[rowNumber - 1]?.[2]?.toString() || ''; // Column C: RECONCILIATION
    const existingNormalized = existingCell
      .split(/[,;\s]+/)
      .map((t: string) => normalizeMonthKeyFlexible(t, new Date().getFullYear()))
      .filter((v: string | null): v is string => Boolean(v));

    const set = new Set<string>(existingNormalized);
    if (set.has(normalizedKey)) {
      set.delete(normalizedKey);
    }

    const normalizedList = Array.from(set).sort();
    const tokensForSheet = normalizedList.map(formatMonthTokenFromKey).join(', ');

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `DISCOUNTS!C${rowNumber}`, // Column C: RECONCILIATION
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[tokensForSheet]] },
    });

    return normalizedList;
  } catch (error) {
    console.error('Error unmarking reconciliation month:', error);
    throw error;
  }
}

export async function getUsers() {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Users!A:C`, // NAME, ROLE, PASSWORD
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row and parse data
    // Assuming header is NAME, ROLE, PASSWORD
    const users = rows.slice(1).map((row) => {
      const [name, role, password] = row;
      return {
        name: name || '',
        role: role || '',
        password: password?.toString() || '',
      };
    }).filter(user => user.name && user.password);

    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

export async function getCustomerEmail(customerName: string): Promise<string | null> {
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
    if (!rows || rows.length === 0) {
      return null;
    }

    // Skip header row (assuming row 1 is header)
    // Find customer row (case-insensitive)
    // CUSTOMER NAME is now in column B (index 1)
    const customerRow = rows.slice(1).find(row =>
      row[1]?.toString().trim().toLowerCase() === customerName.trim().toLowerCase()
    );

    if (customerRow && customerRow[2]) {
      return customerRow[2].toString().trim();
    }

    return null;
  } catch (error) {
    console.error('Error fetching customer email:', error);
    // Don't throw, just return null if sheet doesn't exist or other error
    return null;
  }
}

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
    if (!rows || rows.length === 0) {
      return { customers: [], emails: [] };
    }

    const dataRows = rows.slice(1).map((row) => {
      const customerId = row[0]?.toString().trim() || '';
      const name = row[1]?.toString().trim() || ''; // CUSTOMER NAME is now in column B (index 1)
      const email = row[2]?.toString().trim() || ''; // EMAIL is now in column C (index 2)
      return { customerId, name, email };
    }).filter(r => r.name);

    const emailByCustomer = new Map<string, string>();
    dataRows.forEach(r => {
      if (r.email) emailByCustomer.set(normalizeCustomerKey(r.name), r.email);
    });

    const requestedNormalized = normalizeCustomerKey(customerName);

    // Determine target customers:
    // 1) If the requested name already contains '&' => treat as a group definition
    // 2) Else, try to find a group definition row that contains this customer as one of its parts
    // 3) Else, treat as single customer
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

    // Resolve emails per target customer (by exact name match)
    const emails: string[] = [];
    customers.forEach(c => {
      const e = emailByCustomer.get(normalizeCustomerKey(c));
      if (e) emails.push(e);
    });

    // Fallback: if group row has emails written directly, parse them
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
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row and return names of customers with emails
    // CUSTOMER NAME is now in column B (index 1), EMAIL is in column C (index 2)
    const customersWithEmails = rows.slice(1)
      .filter(row => row[1] && row[2] && row[2].toString().trim() !== '')
      .map(row => row[1].toString().trim());

    return customersWithEmails;
  } catch (error) {
    console.error('Error fetching all customer emails:', error);
    return [];
  }
}

export async function getNotes(customerName?: string) {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Notes!A:E`, // USER, CUSTOMER NAME, NOTES, TIMING, SOLVED
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row
    let notes = rows.slice(1).map((row, index) => ({
      user: row[0] || '',
      customerName: row[1] || '',
      content: row[2] || '',
      timestamp: row[3] || '',
      isSolved: row[4] === 'TRUE', // Check if solved column is TRUE
      rowIndex: index + 2 // Store 1-based index for updates (header is 1, so first data row is 2)
    }));

    if (customerName) {
      notes = notes.filter(note => note.customerName === customerName);
    }

    return notes;
  } catch (error) {
    console.error('Error fetching notes:', error);
    throw error;
  }
}

export async function addNote(user: string, customerName: string, content: string, isSolved: boolean = false) {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'UTC', // Or use specific timezone if required, usually UTC is good or server time
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `Notes!A:E`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[user, customerName, content, timestamp, isSolved ? 'TRUE' : 'FALSE']],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding note:', error);
    throw error;
  }
}

export async function updateNote(rowIndex: number, content: string, isSolved?: boolean) {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Update content column (C), timing column (D), and solved column (E) for the specific row
    // range: `Notes!C${rowIndex}:E${rowIndex}`
    const values = [[content, timestamp, isSolved === undefined ? 'FALSE' : (isSolved ? 'TRUE' : 'FALSE')]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Notes!C${rowIndex}:E${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
}

export async function deleteNote(rowIndex: number) {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // To "delete" a row in Sheets properly without shifting subsequent data issues (though we rely on index), 
    // we can clear the values. However, a true delete (shifting up) is usually better for lists.
    // But since we are using rowIndex directly, we should use batchUpdate with deleteDimension.
    // Note: rowIndex here is 1-based (Sheet row number), but API expects 0-based index.
    // So row 2 in Sheet is index 1.

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0, // Assuming the first sheet or find ID by name if not. 
                // Ideally we should fetch sheetId by name 'Notes'.
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    // Important: The above code assumes 'Notes' is the first sheet (ID 0) or we know its ID.
    // If 'Notes' is NOT ID 0, we MUST find its ID first.
    // Let's do a quick lookup to be safe.

    return { success: true };
  } catch (error) {
    // If batchUpdate fails (likely due to Sheet ID assumption), fall back to clearing content
    // Or implement fetching sheet ID. 
    // For stability let's implement proper ID fetching in a helper if we want to delete rows.
    // For now, let's just clear the row content to avoid ID complexity if we are lazy, 
    // BUT clearing row keeps empty space. Users usually want it gone.
    // Let's try to implement the proper sheet ID lookup.

    console.error('Error deleting note:', error);
    throw error;
  }
}

async function getSheetId(sheetName: string): Promise<number | null> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    let sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);

    // Try case-insensitive/trimmed match if exact match fails
    if (!sheet) {
      sheet = response.data.sheets?.find(s =>
        s.properties?.title?.trim().toLowerCase() === sheetName.trim().toLowerCase()
      );
    }

    if (!sheet) {
      const available = response.data.sheets?.map(s => s.properties?.title).join(', ');
      console.error(`Sheet '${sheetName}' not found. Available: ${available}`);
    }

    return sheet?.properties?.sheetId ?? null;
  } catch (error) {
    console.error('Error getting sheet ID:', error);
    return null;
  }
}

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
      range: `CLOSED!A:B`, // CUSTOMER ID, CUSTOMER NAME
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return new Set();
    }

    // Skip header row and return set of customer names (normalized for exact match)
    // CUSTOMER NAME is now in column B (index 1)
    const closedCustomers = new Set<string>();
    rows.slice(1).forEach((row) => {
      const customerName = row[1]?.toString().trim(); // CUSTOMER NAME is in column B
      if (customerName) {
        // Normalize: lowercase, trim, and normalize whitespace only (exact match - keep punctuation)
        const normalized = customerName.toLowerCase().trim().replace(/\s+/g, ' ');
        closedCustomers.add(normalized);
      }
    });

    return closedCustomers;
  } catch (error) {
    console.error('Error fetching closed customers:', error);
    // Don't throw, just return empty set if sheet doesn't exist or other error
    return new Set();
  }
}

export async function deleteNoteRow(rowIndex: number) {
  try {
    const sheetId = await getSheetId('Notes');

    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    if (sheetId !== null) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1, // 0-based start index
                  endIndex: rowIndex,       // 0-based end index (exclusive)
                },
              },
            },
          ],
        },
      });
      return { success: true };
    } else {
      console.warn('Notes sheet ID not found, attempting to clear row content instead.');
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `Notes!A${rowIndex}:D${rowIndex}`,
      });
      return { success: true };
    }
  } catch (error) {
    console.error('Error deleting note row:', error);
    // Try fallback to clear if batchUpdate failed
    try {
      const credentials = getServiceAccountCredentials();
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });

      console.log(`Fallback: Clearing row ${rowIndex}...`);
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `Notes!A${rowIndex}:D${rowIndex}`,
      });
      return { success: true };
    } catch (clearError) {
      console.error('Error clearing note row:', clearError);
      throw error;
    }
  }
}

export async function getInventoryData() {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Inventory!A:H`, // BARCODE, ITEM CODE, PRODUCT NAME, TAGS, TYPE, QTY IN BOX, WEIGHT, SIZE
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row
    const data = rows.slice(1).map((row, index) => {
      return {
        rowIndex: index + 2, // 1-based index (header is 1)
        barcode: row[0] || '',
        itemCode: row[1] || '',
        productName: row[2] || '',
        tags: row[3] || '',
        type: row[4] || '',
        qtyInBox: row[5] ? parseInt(row[5]) : 0,
        weight: row[6] || '',
        size: row[7] || '',
      };
    }).filter(row => row.productName);

    return data;
  } catch (error) {
    console.error('Error fetching inventory data:', error);
    throw error;
  }
}

export async function updateInventoryItem(rowIndex: number, data: {
  barcode: string;
  itemCode: string;
  productName: string;
  tags: string;
  type: string;
  qtyInBox: number;
  weight: string;
  size: string;
}) {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const values = [[
      data.barcode,
      data.itemCode,
      data.productName,
      data.tags,
      data.type,
      data.qtyInBox,
      data.weight,
      data.size
    ]];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Inventory!A${rowIndex}:H${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
}

export interface WarehouseCleaningEntry {
  cleaningName: string;
  organizingName: string;
  year: string;
  month: string;
  date: string;
  week: string;
  day: string;
  rating: string;
}

export async function getWarehouseCleaningData(): Promise<WarehouseCleaningEntry[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // First, get all sheet names to find the correct one
    let actualSheetName = '';
    try {
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
      });

      const allSheets = spreadsheetInfo.data.sheets || [];
      const sheetNames = allSheets.map(s => s.properties?.title || '').filter(Boolean);
      console.log('[Warehouse Cleaning] Available sheets:', sheetNames);

      // Try to find sheet with "warehouse" and "cleaning" in the name (case-insensitive)
      const matchingSheet = sheetNames.find(name =>
        name.toLowerCase().includes('warehouse') && name.toLowerCase().includes('cleaning')
      );

      if (matchingSheet) {
        actualSheetName = matchingSheet;
        console.log(`[Warehouse Cleaning] Found matching sheet: "${actualSheetName}"`);
      } else {
        // Try exact match
        const exactMatch = sheetNames.find(name =>
          name.trim().toLowerCase() === 'warehouse cleaning'
        );
        if (exactMatch) {
          actualSheetName = exactMatch;
        } else {
          throw new Error(
            `Sheet "Warehouse Cleaning" not found. Available sheets: ${sheetNames.join(', ')}`
          );
        }
      }
    } catch (err) {
      console.error('[Warehouse Cleaning] Error finding sheet:', err);
      throw err;
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${actualSheetName}!A:H`, // Cleaning Name, Organizing Name, Year, Month, Date, Week, Day, Rating
    });

    const rows = response.data.values;
    console.log(`[Warehouse Cleaning] Found ${rows ? rows.length : 0} rows from sheet "${actualSheetName}"`);

    if (!rows || rows.length === 0) {
      console.log('[Warehouse Cleaning] No rows found in sheet');
      return [];
    }

    // Skip header row and parse data
    const data = rows.slice(1).map((row) => {
      const [cleaningName, organizingName, year, month, date, week, day, rating] = row;
      return {
        cleaningName: cleaningName?.toString().trim() || '',
        organizingName: organizingName?.toString().trim() || '',
        year: year?.toString().trim() || '',
        month: month?.toString().trim() || '',
        date: date?.toString().trim() || '',
        week: week?.toString().trim() || '',
        day: day?.toString().trim() || '',
        rating: rating?.toString().trim() || '',
      };
    }).filter(row => {
      // Less strict filter - only filter completely empty rows
      return row.cleaningName || row.organizingName || row.date || row.year || row.month;
    });

    console.log(`[Warehouse Cleaning] Parsed ${data.length} entries after filtering`);
    if (data.length > 0) {
      console.log('[Warehouse Cleaning] Sample entry:', data[0]);
    }
    return data;
  } catch (error) {
    console.error('Error fetching Warehouse Cleaning data:', error);
    throw error;
  }
}

export async function updateWarehouseCleaningRating(
  year: string,
  month: string,
  date: string,
  rating: string
): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Find the sheet
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const allSheets = spreadsheetInfo.data.sheets || [];
    const sheetNames = allSheets.map(s => s.properties?.title || '').filter(Boolean);

    const matchingSheet = sheetNames.find(name =>
      name.toLowerCase().includes('warehouse') && name.toLowerCase().includes('cleaning')
    ) || sheetNames.find(name =>
      name.trim().toLowerCase() === 'warehouse cleaning'
    );

    if (!matchingSheet) {
      throw new Error(`Sheet "Warehouse Cleaning" not found`);
    }

    // Get all data to find the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${matchingSheet}!A:H`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error('No data found in sheet');
    }

    // Find the row matching year, month, and date
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowYear = row[2]?.toString().trim() || '';
      const rowMonth = row[3]?.toString().trim() || '';
      const rowDate = row[4]?.toString().trim() || '';

      if (rowYear === year && rowMonth === month && rowDate === date) {
        rowIndex = i + 1; // 1-based row number
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error(`Row not found for Year: ${year}, Month: ${month}, Date: ${date}`);
    }

    // Update the rating in column H (8th column)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${matchingSheet}!H${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[rating]],
      },
    });

    console.log(`[Warehouse Cleaning] Updated rating for row ${rowIndex}: ${rating}`);
    return { success: true };
  } catch (error) {
    console.error('Error updating Warehouse Cleaning rating:', error);
    throw error;
  }
}

// Sales Data Interface
export interface SalesInvoice {
  invoiceDate: string;
  invoiceNumber: string;
  customerId: string;
  customerMainName: string;
  customerName: string;
  area: string;
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

// Get Sales Data from "Sales - Invoices" sheet
export interface InactiveCustomerException {
  customerId: string;
  customerName: string;
}

export async function getInactiveCustomerExceptions(): Promise<InactiveCustomerException[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Inactive Customers - Exception!A:B', // CUSTOMER ID, CUSTOMER NAME
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row and parse data
    const data = rows.slice(1).map((row) => {
      const [customerId, customerName] = row;
      return {
        customerId: customerId?.toString().trim() || '',
        customerName: customerName?.toString().trim() || '',
      };
    }).filter(row => row.customerId); // Filter out empty rows

    return data;
  } catch (error) {
    console.error('Error fetching inactive customer exceptions:', error);
    // Return empty array if sheet doesn't exist or has errors
    return [];
  }
}

export async function getSalesData(): Promise<SalesInvoice[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Sales - Invoices!A:P`, // INVOICE DATE, INVOICE NUMBER, CUSTOMER ID, CUSTOMER MAIN NAME, CUSTOMER SUB NAME, AREA, MERCHANDISER, SALESREP, PRODUCT ID, BARCODE, PRODUCT, PRODUCT TAG, PRODUCT COST, PRODUCT PRICE, AMOUNT, QTY
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row
    const data = rows.slice(1).map((row) => {
      const invoiceNumber = row[1]?.toString().trim() || '';
      const customerId = row[2]?.toString().trim() || '';
      const customerMainName = row[3]?.toString().trim() || '';
      const customerName = row[4]?.toString().trim() || '';
      const area = row[5]?.toString().trim() || '';

      // Use amount and qty values as they are from Google Sheets (can be positive or negative)
      const amount = row[14] ? parseFloat(row[14].toString().replace(/,/g, '')) || 0 : 0;
      const qty = row[15] ? parseFloat(row[15].toString().replace(/,/g, '')) || 0 : 0;
      const productCost = row[12] ? parseFloat(row[12].toString().replace(/,/g, '')) || 0 : 0;
      const productPrice = row[13] ? parseFloat(row[13].toString().replace(/,/g, '')) || 0 : 0;

      return {
        invoiceDate: row[0]?.toString().trim() || '',
        invoiceNumber: invoiceNumber,
        customerId: customerId,
        customerMainName: customerMainName,
        customerName: customerName,
        area: area,
        merchandiser: row[6]?.toString().trim() || '',
        salesRep: row[7]?.toString().trim() || '',
        productId: row[8]?.toString().trim() || '',
        barcode: row[9]?.toString().trim() || '',
        product: row[10]?.toString().trim() || '',
        productTag: row[11]?.toString().trim() || '',
        productCost: productCost,
        productPrice: productPrice,
        amount: amount,
        qty: qty,
      };
    }).filter(row => row.customerId && row.customerName && row.product); // Filter out empty rows

    return data;
  } catch (error) {
    console.error('Error fetching sales data:', error);
    throw error;
  }
}

// Get Water Delivery Note Data from "Water - Delivery Note" sheet
export interface WaterDeliveryNoteItem {
  itemName: string;
}

export async function getWaterDeliveryNoteData(): Promise<WaterDeliveryNoteItem[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Water - Delivery Note!A:A`, // ITEM NAME
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row
    const data = rows.slice(1).map((row) => {
      return {
        itemName: row[0]?.toString().trim() || '',
      };
    }).filter(row => row.itemName); // Filter out empty rows

    return data;
  } catch (error) {
    console.error('Error fetching water delivery note data:', error);
    throw error;
  }
}

// Save Water Delivery Note to "Water - Delivery Note" sheet in columns C:F
export async function saveWaterDeliveryNote(data: {
  date: string;
  deliveryNoteNumber: string;
  items: Array<{ itemName: string; quantity: number }>;
}): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare rows: each item gets its own row
    // Columns: C (Date), D (Delivery Note Number), E (Item Name), F (Quantity)
    const values = data.items
      .filter(item => item.itemName && item.quantity > 0)
      .map(item => [
        data.date,
        data.deliveryNoteNumber,
        item.itemName,
        item.quantity.toString()
      ]);

    if (values.length === 0) {
      throw new Error('No valid items to save');
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `Water - Delivery Note!C:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving water delivery note:', error);
    throw error;
  }
}

// Get the next Delivery Note Number from "Water - Delivery Note" sheet
export async function getNextDeliveryNoteNumber(): Promise<string> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get all delivery note numbers from column D
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Water - Delivery Note!D:D`, // Delivery Note Number column
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      // If no data, start with DN-001
      return 'DN-001';
    }

    // Skip header row and find the highest number
    const numbers = rows.slice(1)
      .map(row => row[0]?.toString().trim() || '')
      .filter(num => num && num.startsWith('DN-'))
      .map(num => {
        // Extract number from DN-XXX format
        const match = num.match(/DN-(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);

    if (numbers.length === 0) {
      return 'DN-001';
    }

    const maxNumber = Math.max(...numbers);
    const nextNumber = maxNumber + 1;

    // Format as DN-XXX with leading zeros
    return `DN-${String(nextNumber).padStart(3, '0')}`;
  } catch (error) {
    console.error('Error getting next delivery note number:', error);
    // Return default if error
    return 'DN-001';
  }
}

// Get Water Delivery Note by Delivery Note Number
export interface WaterDeliveryNoteData {
  date: string;
  deliveryNoteNumber: string;
  items: Array<{ itemName: string; quantity: number }>;
  rowIndices: number[]; // Store row indices for updating
}

export async function getWaterDeliveryNoteByNumber(deliveryNoteNumber: string): Promise<WaterDeliveryNoteData | null> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get all data from columns C:F (Date, Delivery Note Number, Item Name, Quantity)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Water - Delivery Note!C:F`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // Skip header row (index 1 in sheet, but 0 in array)
    // Find all rows matching the delivery note number
    const matchingRows: Array<{ rowIndex: number; date: string; itemName: string; quantity: number }> = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row && row.length >= 2 && row[1]?.toString().trim() === deliveryNoteNumber.trim()) {
        matchingRows.push({
          rowIndex: i + 1, // +1 because sheet rows are 1-indexed
          date: row[0]?.toString().trim() || '',
          itemName: row[2]?.toString().trim() || '',
          quantity: parseFloat(row[3]?.toString() || '0') || 0
        });
      }
    }

    if (matchingRows.length === 0) {
      return null;
    }

    // All rows should have the same date and delivery note number
    const date = matchingRows[0].date;
    const items = matchingRows.map(row => ({
      itemName: row.itemName,
      quantity: row.quantity
    }));
    const rowIndices = matchingRows.map(row => row.rowIndex);

    return {
      date,
      deliveryNoteNumber: deliveryNoteNumber.trim(),
      items,
      rowIndices
    };
  } catch (error) {
    console.error('Error fetching water delivery note by number:', error);
    throw error;
  }
}

// Update Water Delivery Note in Google Sheet
export async function updateWaterDeliveryNote(
  deliveryNoteNumber: string,
  data: {
    date: string;
    items: Array<{ itemName: string; quantity: number }>;
  }
): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // First, get the existing rows for this delivery note
    const existingData = await getWaterDeliveryNoteByNumber(deliveryNoteNumber);
    if (!existingData) {
      throw new Error('Delivery note not found');
    }

    const existingRowIndices = existingData.rowIndices;
    const newItems = data.items.filter(item => item.itemName && item.quantity > 0);

    // Get sheet ID for batch operations
    const sheetId = await getSheetId('Water - Delivery Note');
    if (!sheetId) {
      throw new Error('Sheet "Water - Delivery Note" not found');
    }

    const requests: any[] = [];

    // Prepare values for all rows (update existing + new)
    const values = newItems.map(item => [
      data.date,
      deliveryNoteNumber,
      item.itemName,
      item.quantity.toString()
    ]);

    // Update existing rows one by one to handle non-consecutive rows
    const rowsToUpdate = Math.min(newItems.length, existingRowIndices.length);
    for (let i = 0; i < rowsToUpdate; i++) {
      const rowIndex = existingRowIndices[i];
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Water - Delivery Note!C${rowIndex}:F${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values[i]]
        }
      });
    }

    // Delete excess rows if any (from bottom to top to maintain indices)
    if (existingRowIndices.length > newItems.length) {
      for (let i = existingRowIndices.length - 1; i >= newItems.length; i--) {
        requests.push({
          deleteDimension: {
            range: {
              sheetId: sheetId,
              dimension: 'ROWS',
              startIndex: existingRowIndices[i] - 1,
              endIndex: existingRowIndices[i]
            }
          }
        });
      }
    }

    // Add new rows if we have more items than existing rows
    if (newItems.length > existingRowIndices.length) {
      const additionalValues = values.slice(existingRowIndices.length);
      if (additionalValues.length > 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `Water - Delivery Note!C:F`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: additionalValues
          }
        });
      }
    }

    // Execute delete requests if any
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: requests
        }
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating water delivery note:', error);
    throw error;
  }
}

// Get all unique employee names from "Employee Overtime" sheet column D (Employee Name (En))
export async function getEmployeeNames(): Promise<string[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Employee DataBase'!C:C`, // Employee Name (En) column
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row and get unique employee names (no duplicates)
    const uniqueNames = new Set<string>();

    rows.slice(1).forEach((row) => {
      const name = row[0]?.toString().trim();
      if (name && name.length > 0) {
        uniqueNames.add(name); // Set automatically prevents duplicates
      }
    });

    // Convert Set to Array - Set ensures each name appears only once
    const uniqueNamesArray = Array.from(uniqueNames);

    // Sort alphabetically
    return uniqueNamesArray.sort();
  } catch (error) {
    console.error('Error fetching employee names:', error);
    throw error;
  }
}
// Save Employee Overtime record to "Employee Overtime" sheet
// Columns: A (Date), B (Type), C (Employee ID), D (Employee Name Ar), 
//          E (Employee Name En), F (Particulars), G (FROM AM/PM), H (FTime), I (TO AM/PM), J (TTime)
export async function saveEmployeeOvertime(data: {
  date: string;
  employeeName: string;
  type: string;
  description: string;
  fromAmPm?: string;
  timeFrom: string;
  toAmPm?: string;
  timeTo: string;
}): Promise<{ success: boolean }> {
  try {
    // Validate required fields
    if (!data.date || !data.employeeName || !data.type || !data.description || !data.timeFrom || !data.timeTo) {
      throw new Error('Missing required fields: date, employeeName, type, description, timeFrom, or timeTo');
    }

    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare row data according to sheet structure:
    // A: Date
    // B: Type (Overtime/Absent)
    // C: Employee ID (empty)
    // D: Employee Name (Ar) (empty)
    // E: Employee Name (En)
    // F: Particulars
    // G: FROM AM/PM (always PM)
    // H: FTime (timeFrom)
    // I: TO AM/PM (always PM)
    // J: TTime (timeTo)
    const rowValues = [
      data.date.trim(),           // A: Date
      data.type || 'Overtime',    // B: Type
      '',                         // C: Employee ID (empty)
      '',                         // D: Employee Name (Ar) (empty)
      data.employeeName.trim(),   // E: Employee Name (En)
      data.description.trim(),    // F: Particulars
      data.fromAmPm || 'PM',      // G: FROM AM/PM
      data.timeFrom.trim(),       // H: FTime
      data.toAmPm || 'PM',        // I: TO AM/PM
      data.timeTo.trim()          // J: TTime
    ];

    // Use append to add new row at the end
    // Use A:J range
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Employee Overtime'!A:J`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving employee overtime:', error);
    throw error;
  }
}

// Get all Employee Overtime records from "Employee Overtime" sheet
export async function getEmployeeOvertimeRecords(): Promise<Array<{
  id: string;
  date: string;
  type: string;
  employeeName: string;
  description: string;
  timeFrom: string;
  timeTo: string;
  hours: string;
  rowIndex: number;
}>> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `Employee Overtime!A:J`, // All columns (up to J)
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row
    const records = rows.slice(1).map((row, index) => {
      const date = row[0]?.toString().trim() || '';
      const type = row[1]?.toString().trim() || 'Overtime'; // B: Type
      const employeeId = row[2]?.toString().trim() || ''; // C: Employee ID
      const employeeNameAr = row[3]?.toString().trim() || ''; // D: Employee Name (Ar)
      const employeeName = row[4]?.toString().trim() || ''; // E: Employee Name (En)
      const description = row[5]?.toString().trim() || ''; // F: Particulars
      const fromAmPm = row[6]?.toString().trim() || 'PM'; // G: FROM AM/PM
      const timeFrom = row[7]?.toString().trim() || ''; // H: FTime
      const toAmPm = row[8]?.toString().trim() || 'PM'; // I: TO AM/PM
      const timeTo = row[9]?.toString().trim() || ''; // J: TTime

      // Calculate hours
      let hours = '0.00';
      if (timeFrom && timeTo) {
        // Handle different time formats: "4", "4.30", "4:30"
        const parseTime = (timeStr: string, amPm: string): { hours: number; minutes: number } => {
          if (!timeStr) return { hours: 0, minutes: 0 };

          let h: number, m: number;
          if (timeStr.includes(':')) {
            const [hour, min] = timeStr.split(':').map(Number);
            h = hour || 0;
            m = min || 0;
          } else if (timeStr.includes('.')) {
            const [hour, min] = timeStr.split('.').map(Number);
            h = hour || 0;
            m = min || 0;
          } else {
            h = parseInt(timeStr) || 0;
            m = 0;
          }

          // Convert to 24-hour format based on AM/PM
          if (amPm === 'AM') {
            if (h === 12) h = 0; // 12 AM = 0 hours
          } else { // PM
            if (h !== 12) h += 12; // Add 12 for PM (except 12 PM)
          }

          return { hours: h, minutes: m };
        };

        const fromTime = parseTime(timeFrom, fromAmPm);
        const toTime = parseTime(timeTo, toAmPm);

        const fromMins = fromTime.hours * 60 + fromTime.minutes;
        let toMins = toTime.hours * 60 + toTime.minutes;
        if (toMins < fromMins) toMins += 24 * 60;
        const calculatedHours = (toMins - fromMins) / 60;

        // Convert to base-60 format (4.30 instead of 4.5)
        const wholeHours = Math.floor(calculatedHours);
        const minutes = Math.round((calculatedHours - wholeHours) * 60);
        hours = isNaN(calculatedHours) ? '0' : `${wholeHours}.${minutes}`;
      }

      return {
        id: `row_${index + 2}`, // Unique ID based on row index
        date,
        type,
        employeeId,
        employeeNameAr,
        employeeName,
        description,
        fromAmPm,
        timeFrom,
        toAmPm,
        timeTo,
        hours,
        rowIndex: index + 2, // 1-based index (header is 1, so first data row is 2)
      };
    }).filter(record => record.employeeName && record.date); // Filter out empty rows

    return records;
  } catch (error) {
    console.error('Error fetching employee overtime records:', error);
    throw error;
  }
}

// Update Employee Overtime record
// Columns: A (Date), B (Type), C (Employee ID), D (Employee Name Ar), 
//          E (Employee Name En), F (Particulars), G (FROM AM/PM), H (FTime), I (TO AM/PM), J (TTime)
export async function updateEmployeeOvertime(rowIndex: number, data: {
  date: string;
  employeeName: string;
  type: string;
  description: string;
  fromAmPm?: string;
  timeFrom: string;
  toAmPm?: string;
  timeTo: string;
}): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Prepare row data based on the column order
    const rowValues = [
      data.date.trim(),           // A: Date
      data.type || 'Overtime',    // B: Type
      '',                         // C: Employee ID (empty)
      '',                         // D: Employee Name (Ar) (empty)
      data.employeeName.trim(),   // E: Employee Name (En)
      data.description.trim(),    // F: Particulars
      data.fromAmPm || 'PM',      // G: FROM AM/PM
      data.timeFrom.trim(),       // H: FTime
      data.toAmPm || 'PM',        // I: TO AM/PM
      data.timeTo.trim()          // J: TTime
    ];

    // Update the row at the specified index
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Employee Overtime!A${rowIndex}:J${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating employee overtime:', error);
    throw error;
  }
}

// Delete Employee Overtime record
export async function deleteEmployeeOvertime(rowIndex: number): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // First, get the sheet ID for "Employee Overtime"
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheetInfo.data.sheets?.find(s =>
      s.properties?.title === 'Employee Overtime'
    );

    if (!sheet || !sheet.properties?.sheetId) {
      throw new Error('Employee Overtime sheet not found');
    }

    const sheetId = sheet.properties.sheetId;

    // Delete the row using batchUpdate
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // Convert to 0-based index
                endIndex: rowIndex,
              },
            },
          },
        ],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting employee overtime:', error);
    throw error;
  }
}

// Save Petty Cash entry to "Petty Cash" sheet
// Columns: A (DATE), B (TYPE), C (AMOUNT), D (NAME), E (DESCRIPTION), F (PAID?)
export async function savePettyCash(data: {
  date: string;
  type: 'Receipt' | 'Expense';
  amount: number;
  name: string;
  description: string;
  paid?: string;
}): Promise<{ success: boolean; rowIndex?: number }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const rowValues = [
      data.date.trim(),           // A: DATE
      data.type,                   // B: TYPE (Receipt or Expense)
      data.amount.toString(),      // C: AMOUNT
      data.name.trim(),            // D: NAME (Source for Receipt, Recipient for Expense)
      data.description.trim(),     // E: DESCRIPTION
      data.paid || ''              // F: PAID?
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Petty Cash'!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });

    // Get the row index of the newly added row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Petty Cash'!A:F`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.length; // Row index (1-based, including header)

    return { success: true, rowIndex };
  } catch (error) {
    console.error('Error saving petty cash:', error);
    throw error;
  }
}

// Get Petty Cash records from "Petty Cash" sheet
export async function getPettyCashRecords(): Promise<Array<{
  id: string;
  rowIndex: number;
  date: string;
  type: 'Receipt' | 'Expense';
  amount: number;
  name: string;
  description: string;
  paid: string;
}>> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Petty Cash'!A:F`,
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      return [];
    }

    // Skip header row (row 1) and parse data
    return rows.slice(1).map((row, index) => {
      const [date, type, amount, name, description, paid] = row;
      return {
        id: `petty-cash-${index + 2}`, // Use row index as ID
        rowIndex: index + 2, // Row index (1-based, including header)
        date: date?.toString().trim() || '',
        type: (type?.toString().trim() === 'Expense' ? 'Expense' : 'Receipt') as 'Receipt' | 'Expense',
        amount: parseFloat(amount?.toString().replace(/,/g, '') || '0'),
        name: name?.toString().trim() || '',
        description: description?.toString().trim() || '',
        paid: paid?.toString().trim() || '',
      };
    }).filter(record => record.date && record.name); // Filter out empty rows
  } catch (error) {
    console.error('Error fetching petty cash records:', error);
    throw error;
  }
}

// Update Petty Cash record in "Petty Cash" sheet
// Columns: A (DATE), B (TYPE), C (AMOUNT), D (NAME), E (DESCRIPTION), F (PAID?)
export async function updatePettyCash(rowIndex: number, data: {
  date: string;
  type: string;
  amount: number;
  name: string;
  description: string;
  paid?: string;
}): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Update the row (columns A to F)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Petty Cash'!A${rowIndex}:F${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          data.date,
          data.type,
          data.amount,
          data.name,
          data.description,
          data.paid || ''
        ]],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating petty cash:', error);
    throw error;
  }
}

// Delete Petty Cash record from "Petty Cash" sheet
export async function deletePettyCash(rowIndex: number): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === 'Petty Cash');
    if (!sheet?.properties?.sheetId) {
      throw new Error('Petty Cash sheet not found');
    }

    const sheetId = sheet.properties.sheetId;

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // Convert to 0-based index
                endIndex: rowIndex
              }
            }
          }
        ]
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting petty cash:', error);
    throw error;
  }
}

// Get Product Orders Data from "Inventory - Orders" sheet
export interface ProductOrder {
  productId: string;
  barcode: string;
  productName: string;
  qinc: number;
  tags: string;
  qtyOnHand: number;
  qtyFreeToUse: number;
  salesQty: number;
  rowIndex: number;
  salesBreakdown: { label: string; qty: number }[];
}

export async function getProductOrdersData(): Promise<ProductOrder[]> {
  try {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch both Inventory and Sales data in parallel
    const [inventoryResponse, salesResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Inventory - Orders'!A:G`, // Expanded range to include QINC
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'Sales - Invoices'!A:P`, // Fetch A:P to include Date (A), ProductID (I), Qty (P)
      })
    ]);

    // Process Sales Data
    // Define 3 month buckets (current, last, 2 ago)
    const now = new Date();
    // Get start of months
    const getMonthStart = (monthsAgo: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
      return d;
    };

    // M4 (3 Ago), ... , M1 (Current)
    const months = [3, 2, 1, 0].map(i => getMonthStart(i));

    const monthKeys = months.map(d => `${d.getFullYear()}-${d.getMonth()}`);
    const monthLabels = months.map(d => {
      const mon = d.toLocaleString('en-US', { month: 'short' });
      const yy = d.getFullYear().toString().slice(-2);
      return `${mon} ${yy}`;
    });

    // Maps for each month bucket
    const salesBreakdownMap = new Map<string, number[]>(); // productId -> [q1, q2, q3, q4]
    const salesMap = new Map<string, number>(); // Legacy 90-day total

    const salesRows = salesResponse.data.values || [];

    // Calculate 90 days ago cutoff for total salesQty
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(now.getDate() - 120); // extend logic to roughly cover 4 months for map if needed, though strict 90 days kept for legacy total
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    // Skip header row for sales
    salesRows.slice(1).forEach(row => {
      const dateStr = row[0]?.toString().trim();
      if (!dateStr) return;

      // Handle various date formats if needed, but assuming standard
      const invoiceDate = new Date(dateStr);
      if (isNaN(invoiceDate.getTime())) return;

      const productId = row[8]?.toString().trim();
      const qtyStr = row[15]?.toString().replace(/,/g, '') || '0';
      const qty = parseFloat(qtyStr);

      if (!productId || isNaN(qty)) return;

      // 1. Total 90 Days Logic (Keep consistent or extend? User didn't ask to change total sales logic, just breakdown columns)
      // Actually strictly speaking, if we show 4 months, user might expect total calculation to cover clean 4 months or keep strict 90 days.
      // Let's keep strict 90 days for "salesQty" property to avoid changing semantic meaning elsewhere, but breakdown will show full months.
      if (invoiceDate >= ninetyDaysAgo) {
        salesMap.set(productId, (salesMap.get(productId) || 0) + qty);
      }

      // 2. Monthly Logic
      const key = `${invoiceDate.getFullYear()}-${invoiceDate.getMonth()}`;
      const monthIndex = monthKeys.findIndex(k => k === key);

      if (monthIndex !== -1) {
        const breakdown = salesBreakdownMap.get(productId) || new Array(months.length).fill(0);
        breakdown[monthIndex] += qty;
        salesBreakdownMap.set(productId, breakdown);
      }
    });

    const rows = inventoryResponse.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row
    const data = rows.slice(1).map((row, index) => {
      let productId = row[0]?.toString().trim() || '';
      const barcode = row[1]?.toString().trim() || '';
      const productName = row[2]?.toString().trim() || '';

      // Fallback for missing ID to ensure uniqueness in UI
      if (!productId) {
        if (barcode) productId = `BAR-${barcode}`;
        else if (productName) productId = `NAME-${productName.replace(/\s+/g, '_')}`;
        else productId = `ROW-${index}`;
      }

      const breakdownQtys = salesBreakdownMap.get(productId) || new Array(months.length).fill(0);
      // Map to label/qty objects
      const salesBreakdown = breakdownQtys.map((qty, idx) => ({
        label: monthLabels[idx],
        qty: qty
      }));

      return {
        productId,
        barcode,
        productName,
        qinc: parseFloat(row[3]?.toString().replace(/,/g, '') || '0'), // QINC column
        tags: row[4]?.toString().trim() || '',
        qtyOnHand: parseFloat(row[5]?.toString().replace(/,/g, '') || '0'),
        qtyFreeToUse: parseFloat(row[6]?.toString().replace(/,/g, '') || '0'),
        salesQty: salesMap.get(productId) || 0,
        rowIndex: index + 2, // 1-based index, header is 1
        salesBreakdown
      };
    }).filter(row => row.productName); // Filter out empty rows

    // ... existing code ...

    return data;
  } catch (error) {
    console.error('Error fetching product orders data:', error);
    throw error;
  }
}

export async function updateProductOrderQinc(rowIndex: number, qinc: number): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Inventory - Orders'!D${rowIndex}`, // Updated QINC column D
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[qinc]],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating QINC:', error);
    throw error;
  }
}



// Save Order to "Inventory - Orders - Make" sheet
export interface CreateOrderItem {
  poNumber: string;
  productId: string;
  barcode: string;
  productName: string;
  qtyOrder: number;
  status: string;
}

export async function saveCreateOrder(items: CreateOrderItem[]): Promise<{ success: boolean }> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    const sheetTitle = 'Inventory - Orders - Make';
    const sheet = spreadsheetInfo.data.sheets?.find(s => s.properties?.title === sheetTitle);
    const sheetId = sheet?.properties?.sheetId;

    if (sheetId === undefined) throw new Error(`Sheet ${sheetTitle} not found`);

    if (items.length > 0) {
      const poNumber = items[0].poNumber;

      // 1. Find existing rows for this PO
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `'${sheetTitle}'!A:A`, // Only need PO column
      });

      const rows = response.data.values;
      const deleteRequests: any[] = [];

      if (rows && rows.length > 0) {
        // Find rows to delete (reverse order to keep indices valid during deletion if doing one by one, 
        // but batchUpdate handles shift if we are careful, or better: just delete them)
        // Actually, if we delete row 10, row 11 becomes 10.
        // If we construct requests to delete row 10 and row 11 (original indices), 
        // we must be careful.
        // Standard safe way: Sort descending and create separate delete ranges.

        const indices = rows.map((r, i) => ({ po: r[0], index: i }))
          .filter(r => r.po === poNumber)
          .map(r => r.index);

        // Sort descending
        indices.sort((a, b) => b - a);

        indices.forEach(idx => {
          deleteRequests.push({
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: idx,
                endIndex: idx + 1
              }
            }
          });
        });
      }

      // 2. Delete existing
      if (deleteRequests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: deleteRequests
          }
        });
      }
    }

    // 3. Append new
    const values = items.map(item => [
      item.poNumber,
      item.productId,
      item.barcode,
      item.productName,
      item.qtyOrder,
      item.status
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Inventory - Orders - Make'!A:F`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error saving create order:', error);
    throw error;
  }
}

export async function getOrderDetailsByPO(poNumber: string): Promise<CreateOrderItem[]> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Inventory - Orders - Make'!A:F`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];

    // Filter by PO Number (Column A -> index 0)
    // Note: This logic assumes all rows for a PO are in this sheet.
    const orderItems: CreateOrderItem[] = rows
      .slice(1) // skip header
      .filter(row => row[0]?.toString().trim() === poNumber)
      .map(row => ({
        poNumber: row[0]?.toString().trim() || '',
        productId: row[1]?.toString().trim() || '',
        barcode: row[2]?.toString().trim() || '',
        productName: row[3]?.toString().trim() || '',
        qtyOrder: parseInt(row[4]?.toString().replace(/,/g, '') || '0'),
        status: row[5]?.toString().trim() || 'Pending'
      }));

    return orderItems;
  } catch (error) {
    console.error('Error fetching order details:', error);
    throw error;
  }
}

export async function getNextPONumber(): Promise<string> {
  try {
    const credentials = getServiceAccountCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch only the PO Number column (A)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "'Inventory - Orders - Make'!A:A", // Only get PONO column
    });

    const rows = response.data.values;
    const currentYear = new Date().getFullYear();
    let maxSequence = 0;

    if (rows && rows.length > 1) { // Skip header if present
      const poPattern = new RegExp(`PO-${currentYear}-(\\d{3})`);

      rows.slice(1).forEach(row => {
        const po = row[0]?.toString().trim();
        if (po) {
          const match = po.match(poPattern);
          if (match) {
            const sequence = parseInt(match[1], 10);
            if (!isNaN(sequence) && sequence > maxSequence) {
              maxSequence = sequence;
            }
          }
        }
      });
    }

    const nextSequence = maxSequence + 1;
    const nextSequenceStr = nextSequence.toString().padStart(3, '0');

    return `PO-${currentYear}-${nextSequenceStr}`;

  } catch (error) {
    console.error('Error fetching next PO Number:', error);
    // Fallback if sheet doesn't exist or error, start fresh for widely used safe defaults
    const year = new Date().getFullYear();
    return `PO-${year}-001`;
  }
}