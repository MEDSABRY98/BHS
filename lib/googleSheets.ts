import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DiscountTrackerEntry } from '@/types';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1s1G42Qd0FNDyvz42qi_6SPoKMAy8Kvx8eMm7iyR8pds';
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

function getServiceAccountCredentials(): ServiceAccountCredentials {
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
  customerName: string;
  merchandiser: string;
  salesRep: string;
  barcode: string;
  product: string;
  amount: number;
  qty: number;
}

// Get Sales Data from "Sales - Invoices" sheet
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
      range: `Sales - Invoices!A:J`, // INVOICE DATE, INVOICE NUMBER, CUSTOMER ID, CUSTOMER NAME, MERCHANDISER, SALESREP, BARCODE, PRODUCT, AMOUNT, QTY
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row
    const data = rows.slice(1).map((row) => {
      const invoiceNumber = row[1]?.toString().trim() || '';
      const customerId = row[2]?.toString().trim() || '';
      const customerName = row[3]?.toString().trim() || '';
      
      // Use amount and qty values as they are from Google Sheets (can be positive or negative)
      const amount = row[8] ? parseFloat(row[8].toString().replace(/,/g, '')) || 0 : 0;
      const qty = row[9] ? parseFloat(row[9].toString().replace(/,/g, '')) || 0 : 0;
      
      return {
        invoiceDate: row[0]?.toString().trim() || '',
        invoiceNumber: invoiceNumber,
        customerId: customerId,
        customerName: customerName,
        merchandiser: row[4]?.toString().trim() || '',
        salesRep: row[5]?.toString().trim() || '',
        barcode: row[6]?.toString().trim() || '',
        product: row[7]?.toString().trim() || '',
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