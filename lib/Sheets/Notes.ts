import { google } from 'googleapis';
import { SPREADSHEET_ID, getServiceAccountCredentials, getSheetId } from './Core';

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

    let notes = rows.slice(1).map((row, index) => ({
      user: row[0] || '',
      customerName: row[1] || '',
      content: row[2] || '',
      timestamp: row[3] || '',
      isSolved: row[4] === 'TRUE',
      rowIndex: index + 2
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
      timeZone: 'UTC',
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
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
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
