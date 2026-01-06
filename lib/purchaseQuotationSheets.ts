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

export async function getAuthClient(): Promise<any> {
    const credentials = getServiceAccountCredentials();

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return auth.getClient();
}

// Purchase Quotation Functions
export async function getNextQuotationNumber(): Promise<string> {
    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const sheetName = 'Purchase Quotation';

        // Get current year
        const currentYear = new Date().getFullYear();

        // Get all quotation numbers
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!B:B`, // Column B: QUOTATION NO
        });

        const rows = response.data.values || [];

        // Find the highest number for current year
        let maxNumber = 0;
        const yearPrefix = `PO-${currentYear}-`;

        rows.forEach((row) => {
            const quotationNo = row[0];
            if (quotationNo && quotationNo.startsWith(yearPrefix)) {
                const numberPart = parseInt(quotationNo.split('-')[2]);
                if (!isNaN(numberPart) && numberPart > maxNumber) {
                    maxNumber = numberPart;
                }
            }
        });

        // Generate next number
        const nextNumber = (maxNumber + 1).toString().padStart(3, '0');
        return `${yearPrefix}${nextNumber}`;
    } catch (error) {
        console.error('Error getting next quotation number:', error);
        // Fallback to default
        const currentYear = new Date().getFullYear();
        return `PO-${currentYear}-001`;
    }
}

export async function getSheetId(auth: any, sheetName: string): Promise<number | null> {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
    return sheet?.properties?.sheetId ?? null;
}

export async function savePurchaseQuotation(data: {
    date: string;
    quotationNumber: string;
    supplierName: string;
    notes?: string;
    items: Array<{
        barcode: string;
        name: string;
        quantity: number;
        unit: string;
        price: number;
    }>;
}): Promise<{ success: boolean }> {
    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const sheetName = 'Purchase Quotation';

        // 1. Get Sheet ID
        const sheetId = await getSheetId(auth, sheetName);
        if (sheetId === null) {
            throw new Error(`Sheet "${sheetName}" not found`);
        }

        // 2. Find existing rows with the same quotation number
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:B`, // Read Date and Quotation No columns
        });

        const rows = response.data.values || [];
        const rowsToDelete: number[] = [];

        // Identify rows to delete (0-indexed)
        rows.forEach((row, index) => {
            if (row[1] === data.quotationNumber) {
                rowsToDelete.push(index);
            }
        });

        // 3. Delete existing rows (if any)
        if (rowsToDelete.length > 0) {
            // Sort indices in descending order to avoid index shifting issues
            rowsToDelete.sort((a, b) => b - a);

            // Group contiguous rows into ranges to minimize API calls (optional but good)
            // For simplicity here, we'll creating individual delete requests, 
            // but since we sort descending, we can batch them safely if we had to.
            // Actually, DeleteDimensionRequest takes a range.

            // To be safe and simple: filter out ranges. 
            // Better: Since it's likely contiguous, we can optimize. But row-by-row desc is safest logic.

            const requests = rowsToDelete.map(rowIndex => ({
                deleteDimension: {
                    range: {
                        sheetId: sheetId,
                        dimension: 'ROWS',
                        startIndex: rowIndex,
                        endIndex: rowIndex + 1,
                    },
                },
            }));

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                requestBody: {
                    requests: requests, // Delete from bottom up works if executed sequentially? 
                    // batchUpdate documentation says request order matters.
                    // If we delete index 10, then index 5, index 5 is still index 5.
                    // If we delete index 5, then index 10 (which was 10), it might have shifted.
                    // So descending order is crucial.
                },
            });
        }

        // 4. Prepare new rows - one row per item
        const newRows = data.items.map(item => [
            data.date,
            data.quotationNumber,
            data.supplierName,
            item.barcode,
            item.name,
            item.quantity,
            item.unit,
            item.price,
            item.quantity * item.price,
            data.notes || ''
        ]);

        // 5. Append new rows
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:J`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: newRows
            }
        });

        return { success: true };
    } catch (error) {
        console.error('Error saving purchase quotation:', error);
        throw error;
    }
}

export async function searchQuotationByNumber(quotationNumber: string): Promise<{
    found: boolean;
    data?: {
        date: string;
        quotationNumber: string;
        supplierName: string;
        notes?: string;
        items: Array<{
            barcode: string;
            name: string;
            quantity: number;
            unit: string;
            price: number;
        }>;
    };
}> {
    try {
        const auth = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const sheetName = 'Purchase Quotation';

        // Get all data
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:J`,
        });

        const rows = response.data.values || [];

        // Find rows with matching quotation number
        const matchingRows = rows.filter(row => row[1] === quotationNumber);

        if (matchingRows.length === 0) {
            return { found: false };
        }

        // Extract data
        const firstRow = matchingRows[0];
        const items = matchingRows.map(row => ({
            barcode: row[3] || '',
            name: row[4] || '',
            quantity: parseFloat(row[5]) || 0,
            unit: row[6] || 'PIECE',
            price: parseFloat(row[7]) || 0
        }));

        return {
            found: true,
            data: {
                date: firstRow[0] || '',
                quotationNumber: firstRow[1] || '',
                supplierName: firstRow[2] || '',
                notes: firstRow[9] || '',
                items
            }
        };
    } catch (error) {
        console.error('Error searching quotation:', error);
        throw error;
    }
}
