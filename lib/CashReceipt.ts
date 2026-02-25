import { google } from 'googleapis';
import { getServiceAccountCredentials, SPREADSHEET_ID } from './googleSheets';

/**
 * Saves a cash receipt to the 'Cash Receipt' sheet.
 * Columns: DATE, RECEIPT NUMBER, RECEIVED FROM, SEND BY, AMOUNT, AMOUNT IN WORDS, PAYMENT REASON
 */
export async function saveCashReceipt(data: {
    date: string;
    receiptNumber: string;
    receivedFrom: string;
    sendBy: string;
    amount: number;
    amountInWords: string;
    reason: string;
}): Promise<{ success: boolean }> {
    try {
        const credentials = getServiceAccountCredentials();

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        const rowValues = [
            data.date,           // A: DATE
            data.receiptNumber,  // B: RECEIPT NUMBER
            data.receivedFrom,   // C: RECEIVED FROM
            data.sendBy,         // D: SEND BY
            data.amount.toString(), // E: AMOUNT
            data.amountInWords,  // F: AMOUNT IN WORDS
            data.reason          // G: PAYMENT REASON
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `'Cash Receipt'!A:G`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [rowValues],
            },
        });

        return { success: true };
    } catch (error) {
        console.error('Error saving cash receipt:', error);
        throw error;
    }
}

/**
 * Gets the last receipt number from the 'Cash Receipt' sheet.
 */
export async function getLastReceiptNumber(): Promise<string> {
    try {
        const credentials = getServiceAccountCredentials();
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'Cash Receipt'!B:B`, // RECEIPT NUMBER column
        });

        const values = response.data.values;
        if (!values || values.length <= 1) {
            return 'CAH-000'; // Default if no data or only header
        }

        // Filter out empty or non-ID rows and get the last one
        const idRows = values.filter((row: string[]) => row[0] && row[0].includes('-'));
        if (idRows.length === 0) return 'CAH-000';

        return idRows[idRows.length - 1][0];
    } catch (error) {
        console.error('Error getting last receipt number:', error);
        return 'CAH-000';
    }
}

/**
 * Fetches all cash receipts from the 'Cash Receipt' sheet.
 */
export async function getAllReceipts() {
    try {
        const credentials = getServiceAccountCredentials();
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'Cash Receipt'!A:G`,
        });

        const rows = response.data.values;
        if (!rows || rows.length <= 1) {
            return [];
        }

        // Header Row: DATE, RECEIPT NUMBER, RECEIVED FROM, SEND BY, AMOUNT, AMOUNT IN WORDS, PAYMENT REASON
        return rows.slice(1).map((row, index) => ({
            rowIndex: index + 2, // 1-based index + header offset
            date: row[0] || '',
            receiptNumber: row[1] || '',
            receivedFrom: row[2] || '',
            sendBy: row[3] || '',
            amount: parseFloat(row[4]?.toString().replace(/,/g, '') || '0'),
            amountInWords: row[5] || '',
            reason: row[6] || '',
        })).filter(r => r.receiptNumber);
    } catch (error) {
        console.error('Error fetching all receipts:', error);
        throw error;
    }
}
