import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getServiceAccountCredentials, SPREADSHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const credentials = getServiceAccountCredentials();
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = google.sheets({ version: 'v4', auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'Item Code'!A:C`, // TAGS, ITEM CODE, BARCODE
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return NextResponse.json({ data: [] });
        }

        // Skip header row
        const data = rows.slice(1).map(row => ({
            tags: row[0]?.toString().trim() || '',
            itemCode: row[1]?.toString().trim() || '',
            barcode: row[2]?.toString().trim() || ''
        })).filter(entry => entry.itemCode || entry.barcode);

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching Item Codes:', error);
        return NextResponse.json({ error: 'Failed to fetch item codes' }, { status: 500 });
    }
}
