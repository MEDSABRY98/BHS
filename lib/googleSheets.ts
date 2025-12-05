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
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:F`, // DATE, NUMBER, CUSTOMER NAME, DEBIT, CREDIT, SALESREP
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return [];
    }

    // Skip header row and parse data
    const data = rows.slice(1).map((row) => {
      const [date, number, customerName, debit, credit, salesRep] = row;
      return {
        date: date || '',
        number: number?.toString() || '',
        customerName: customerName || '',
        debit: parseFloat(debit?.toString().replace(/,/g, '') || '0'),
        credit: parseFloat(credit?.toString().replace(/,/g, '') || '0'),
        salesRep: salesRep || '',
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
