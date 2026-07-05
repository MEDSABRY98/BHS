'use server';

import { bhs_supabase } from '@/lib/supabase';

export async function getDocumentsTracking() {
    try {
        const { data, error } = await bhs_supabase
            .from('web_Documents_Tracking')
            .select('*')
            .order('DOCUMENT ID', { ascending: true });

        if (error) throw error;

        // Map Supabase columns to the frontend expected format
        const records = (data || []).map((row: any) => ({
            rowIndex: row['DOCUMENT ID'],
            documentId: row['DOCUMENT ID'] || '',
            receivedDate: row['RECEIVED DATE'] || '',
            datedSendToOffice: row['DATED SEND TO OFFICE'] || '',
            documentDate: row['DOCUMENT DATE'] || '',
            documentNumber: row['DOCUMENT NUMBER'] || '',
            documentName: row['DOCUMENT NAME'] || '',
            receivedFrom: row['RECEIVED FROM'] || '',
            documentAmount: row['DOCUMENT AMOUNT'] ? parseFloat(row['DOCUMENT AMOUNT']) : 0,
            documentNotes: row['DOCUMENT NOTES'] || '',
            whoDeliveryForOffice: row['WHO DELIVERY FOR OFFICE?'] || '',
            whoTakeFromOffice: row['WHO TAKE FROM OFFICE?'] || '',
            documentStatus: row['DOCUMENT STATUS'] || ''
        }));

        return { records };
    } catch (error) {
        console.error('Service error getting tracking data:', error);
        throw new Error('Failed to fetch tracking data');
    }
}

export async function addDocumentsTrackingRecords(records: any[]) {
    try {
        if (!records || !Array.isArray(records)) {
            throw new Error('Records array is required');
        }

        // Map frontend records to Supabase columns
        const insertData = records.map((record: any) => ({
            "DOCUMENT ID": record.documentId || '',
            "RECEIVED DATE": record.receivedDate || '',
            "DATED SEND TO OFFICE": record.datedSendToOffice || '',
            "DOCUMENT DATE": record.documentDate || '',
            "DOCUMENT NUMBER": record.documentNumber || '',
            "DOCUMENT NAME": record.documentName || '',
            "RECEIVED FROM": record.receivedFrom || '',
            "DOCUMENT AMOUNT": record.documentAmount ? parseFloat(record.documentAmount) : null,
            "DOCUMENT NOTES": record.documentNotes || '',
            "WHO DELIVERY FOR OFFICE?": record.whoDeliveryForOffice || '',
            "WHO TAKE FROM OFFICE?": record.whoTakeFromOffice || '',
            "DOCUMENT STATUS": record.documentStatus || ''
        }));

        const { error } = await bhs_supabase
            .from('web_Documents_Tracking')
            .insert(insertData);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Service error adding records:', error);
        throw new Error(error.message || 'Failed to add records');
    }
}

export async function updateDocumentTrackingRecord(rowIndex: string, data: any) {
    try {
        if (!rowIndex) {
            throw new Error('rowIndex is required');
        }

        const mapData: any = {};
        if (data.receivedDate !== undefined) mapData["RECEIVED DATE"] = data.receivedDate;
        if (data.datedSendToOffice !== undefined) mapData["DATED SEND TO OFFICE"] = data.datedSendToOffice;
        if (data.documentDate !== undefined) mapData["DOCUMENT DATE"] = data.documentDate;
        if (data.documentNumber !== undefined) mapData["DOCUMENT NUMBER"] = data.documentNumber;
        if (data.documentName !== undefined) mapData["DOCUMENT NAME"] = data.documentName;
        if (data.receivedFrom !== undefined) mapData["RECEIVED FROM"] = data.receivedFrom;
        if (data.documentAmount !== undefined) mapData["DOCUMENT AMOUNT"] = parseFloat(data.documentAmount);
        if (data.documentNotes !== undefined) mapData["DOCUMENT NOTES"] = data.documentNotes;
        if (data.whoDeliveryForOffice !== undefined) mapData["WHO DELIVERY FOR OFFICE?"] = data.whoDeliveryForOffice;
        if (data.whoTakeFromOffice !== undefined) mapData["WHO TAKE FROM OFFICE?"] = data.whoTakeFromOffice;
        if (data.documentStatus !== undefined) mapData["DOCUMENT STATUS"] = data.documentStatus;

        const { error } = await bhs_supabase
            .from('web_Documents_Tracking')
            .update(mapData)
            .eq('DOCUMENT ID', rowIndex);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Service error updating record:', error);
        throw new Error(error.message || 'Failed to update record');
    }
}

export async function bulkUpdateDocumentsTrackingRecords(updates: { rowIndex: string; data: any }[]) {
    try {
        if (!updates || !Array.isArray(updates)) {
            throw new Error('updates array is required for bulk update');
        }

        // Iterative updates since no simple bulk update exists natively
        for (const update of updates) {
            const mapData: any = {};
            if (update.data.receivedDate !== undefined) mapData["RECEIVED DATE"] = update.data.receivedDate;
            if (update.data.datedSendToOffice !== undefined) mapData["DATED SEND TO OFFICE"] = update.data.datedSendToOffice;
            if (update.data.documentDate !== undefined) mapData["DOCUMENT DATE"] = update.data.documentDate;
            if (update.data.documentNumber !== undefined) mapData["DOCUMENT NUMBER"] = update.data.documentNumber;
            if (update.data.documentName !== undefined) mapData["DOCUMENT NAME"] = update.data.documentName;
            if (update.data.receivedFrom !== undefined) mapData["RECEIVED FROM"] = update.data.receivedFrom;
            if (update.data.documentAmount !== undefined) mapData["DOCUMENT AMOUNT"] = parseFloat(update.data.documentAmount);
            if (update.data.documentNotes !== undefined) mapData["DOCUMENT NOTES"] = update.data.documentNotes;
            if (update.data.whoDeliveryForOffice !== undefined) mapData["WHO DELIVERY FOR OFFICE?"] = update.data.whoDeliveryForOffice;
            if (update.data.whoTakeFromOffice !== undefined) mapData["WHO TAKE FROM OFFICE?"] = update.data.whoTakeFromOffice;
            if (update.data.documentStatus !== undefined) mapData["DOCUMENT STATUS"] = update.data.documentStatus;

            const { error } = await bhs_supabase
                .from('web_Documents_Tracking')
                .update(mapData)
                .eq('DOCUMENT ID', update.rowIndex);

            if (error) throw error;
        }

        return { success: true };
    } catch (error: any) {
        console.error('Service error bulk updating records:', error);
        throw new Error(error.message || 'Failed to update records');
    }
}

export async function deleteDocumentTrackingRecord(rowIndex: string) {
    try {
        if (!rowIndex) {
            throw new Error('rowIndex is required');
        }

        const { error } = await bhs_supabase
            .from('web_Documents_Tracking')
            .delete()
            .eq('DOCUMENT ID', rowIndex);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Service error deleting record:', error);
        throw new Error(error.message || 'Failed to delete record');
    }
}
