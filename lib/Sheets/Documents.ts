import { SPREADSHEET_ID, getSheetId, getSheetsClient } from './Core';

const DOCUMENTS_TRACKING_SHEET = 'Documents Tracking';

export interface DocumentsTrackingRecord {
  rowIndex?: number;
  documentId: string;
  receivedDate: string;
  documentDate: string;
  documentNumber: string;
  documentName: string;
  receivedFrom: string;
  documentAmount: number;
  documentNotes: string;
  documentStatus: string;
  datedReceived: string;
  datedRecord: string;
  datedSendToOffice: string;
  whoDeliveryForOffice: string;
  whoTakeFromOffice: string;
}

export async function getDocumentsTrackingRecords(): Promise<DocumentsTrackingRecord[]> {
  try {
    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${DOCUMENTS_TRACKING_SHEET}'!A:N`,
    });
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map((row, i) => ({
      rowIndex: i + 2,
      documentId: row[0]?.toString() || '',
      receivedDate: row[1]?.toString() || '',
      documentDate: row[2]?.toString() || '',
      documentNumber: row[3]?.toString() || '',
      documentName: row[4]?.toString() || '',
      receivedFrom: row[5]?.toString() || '',
      documentAmount: parseFloat(row[6]?.toString().replace(/,/g, '') || '0'),
      documentNotes: row[7]?.toString() || '',
      whoDeliveryForOffice: row[8]?.toString() || '',
      whoTakeFromOffice: row[9]?.toString() || '',
      documentStatus: row[10]?.toString() || '',
      datedReceived: row[11]?.toString() || '',
      datedRecord: row[12]?.toString() || '',
      datedSendToOffice: row[13]?.toString() || '',
    }));
  } catch (error) {
    console.error('Error fetching Documents Tracking Records:', error);
    throw error;
  }
}

export async function addDocumentsTrackingRecord(data: DocumentsTrackingRecord | DocumentsTrackingRecord[]): Promise<{ success: boolean }> {
  try {
    const sheets = await getSheetsClient();
    const records = Array.isArray(data) ? data : [data];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${DOCUMENTS_TRACKING_SHEET}'!A:N`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: records.map(record => [
          record.documentId,
          record.receivedDate,
          record.documentDate,
          record.documentNumber,
          record.documentName,
          record.receivedFrom,
          record.documentAmount,
          record.documentNotes,
          record.whoDeliveryForOffice || '',
          record.whoTakeFromOffice || '',
          record.documentStatus,
          record.datedReceived || '',
          record.datedRecord || '',
          record.datedSendToOffice || '',
        ]),
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error adding Documents Tracking Record:', error);
    throw error;
  }
}

export async function updateDocumentsTrackingRecord(rowIndex: number, data: Partial<Omit<DocumentsTrackingRecord, 'rowIndex' | 'documentId'>>): Promise<{ success: boolean }> {
  try {
    const sheets = await getSheetsClient();

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${DOCUMENTS_TRACKING_SHEET}'!A${rowIndex}:N${rowIndex}`,
    });
    const currentRow = res.data.values?.[0] || [];

    const updateMap: Record<string, number> = {
      receivedDate: 1, documentDate: 2, documentNumber: 3, documentName: 4,
      receivedFrom: 5, documentAmount: 6, documentNotes: 7, whoDeliveryForOffice: 8,
      whoTakeFromOffice: 9, documentStatus: 10, datedReceived: 11, datedRecord: 12, datedSendToOffice: 13,
    };

    const updatedValues = [...currentRow];
    Object.entries(data).forEach(([key, value]) => {
      const colIndex = updateMap[key];
      if (colIndex !== undefined) {
        updatedValues[colIndex] = value;
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${DOCUMENTS_TRACKING_SHEET}'!A${rowIndex}:N${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [updatedValues],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating Documents Tracking Record:', error);
    throw error;
  }
}

export async function deleteDocumentsTrackingRecord(rowIndex: number): Promise<{ success: boolean }> {
  try {
    const sheets = await getSheetsClient();
    const sheetId = await getSheetId(DOCUMENTS_TRACKING_SHEET);

    if (sheetId === null) {
      throw new Error(`Sheet '${DOCUMENTS_TRACKING_SHEET}' not found`);
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        }],
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting Documents Tracking Record:', error);
    throw error;
  }
}

export async function batchUpdateDocumentsTrackingRecords(updates: { rowIndex: number, data: Partial<Omit<DocumentsTrackingRecord, 'rowIndex' | 'documentId'>> }[]): Promise<{ success: boolean }> {
  try {
    const sheets = await getSheetsClient();

    const updateMap: Record<string, number> = {
      receivedDate: 1, documentDate: 2, documentNumber: 3, documentName: 4,
      receivedFrom: 5, documentAmount: 6, documentNotes: 7, whoDeliveryForOffice: 8,
      whoTakeFromOffice: 9, documentStatus: 10, datedReceived: 11, datedRecord: 12, datedSendToOffice: 13,
    };

    const ranges = updates.map(u => `'${DOCUMENTS_TRACKING_SHEET}'!A${u.rowIndex}:N${u.rowIndex}`);
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges,
    });

    const data = (response.data.valueRanges || []).map((vr, i) => {
      const u = updates[i];
      const currentRow = vr.values?.[0] || [];
      const updatedValues = [...currentRow];

      Object.entries(u.data).forEach(([key, value]) => {
        const colIndex = updateMap[key];
        if (colIndex !== undefined) {
          updatedValues[colIndex] = value;
        }
      });

      return {
        range: ranges[i],
        values: [updatedValues]
      };
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        data,
        valueInputOption: 'USER_ENTERED',
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Error batch updating Documents Tracking Records:', error);
    throw error;
  }
}
