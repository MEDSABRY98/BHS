import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

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
    let filePath = join(process.cwd(), 'assets', 'BHAPPS.json');
    try {
      const fileContent = readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    } catch {
      filePath = join(process.cwd(), '..', 'assets', 'BHAPPS.json');
      const fileContent = readFileSync(filePath, 'utf-8');
      return JSON.parse(fileContent);
    }
  } catch (error) {
    console.error('Error reading credentials file:', error);
    throw new Error('GOOGLE_SERVICE_ACCOUNT environment variable is not set and could not read from file');
  }
}

export async function getSheetsClient() {
  const credentials = getServiceAccountCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

export async function getSheetId(sheetName: string): Promise<number | null> {
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

export function nowTimestamp(): string {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}
