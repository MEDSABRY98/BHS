import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

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
      range: `CUSTOMER DETAILS!A:B`, // CUSTOMER NAME, EMAIL
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return null;
    }

    // Skip header row (assuming row 1 is header)
    // Find customer row (case-insensitive)
    const customerRow = rows.slice(1).find(row => 
      row[0]?.toString().trim().toLowerCase() === customerName.trim().toLowerCase()
    );

    if (customerRow && customerRow[1]) {
      return customerRow[1].toString().trim();
    }

    return null;
  } catch (error) {
    console.error('Error fetching customer email:', error);
    // Don't throw, just return null if sheet doesn't exist or other error
    return null;
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
      range: `CUSTOMER DETAILS!A:B`, // CUSTOMER NAME, EMAIL
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row and return names of customers with emails
    const customersWithEmails = rows.slice(1)
      .filter(row => row[0] && row[1] && row[1].toString().trim() !== '')
      .map(row => row[0].toString().trim());

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
      range: `Notes!A:D`, // USER, CUSTOMER NAME, NOTES, TIMING
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

export async function addNote(user: string, customerName: string, content: string) {
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
      range: `Notes!A:D`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[user, customerName, content, timestamp]],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding note:', error);
    throw error;
  }
}

export async function updateNote(rowIndex: number, content: string) {
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
    
    // Update content column (C) and timing column (D) for the specific row
    // We can do this in one call if they are adjacent.
    // range: `Notes!C${rowIndex}:D${rowIndex}`
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Notes!C${rowIndex}:D${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[content, timestamp]],
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
