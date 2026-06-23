import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { data, error } = await bhs_supabase
            .from('web_Documents_Tracking')
            .select('*')
            .order('ID', { ascending: true });

        if (error) throw error;

        // Map Supabase columns to the frontend expected format
        const records = (data || []).map((row: any) => ({
            rowIndex: row['ID'], // Using ID as the unique identifier
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

        return NextResponse.json({ records });
    } catch (error) {
        console.error('GET /api/documents-tracking error:', error);
        return NextResponse.json({ error: 'Failed to fetch tracking data' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'add') {
            const { records } = body;
            if (!records || !Array.isArray(records)) {
                return NextResponse.json({ error: 'Records array is required' }, { status: 400 });
            }

            // Map frontend records to Supabase columns
            const insertData = records.map((record: any) => ({
                "ID": record.documentId || crypto.randomUUID(),
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

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error: any) {
        console.error('POST /api/documents-tracking error:', error);
        return NextResponse.json({ error: error.message || 'Failed to add records' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { bulk, updates, rowIndex, ...data } = body;

        if (bulk) {
            if (!updates || !Array.isArray(updates)) {
                return NextResponse.json({ error: 'updates array is required for bulk update' }, { status: 400 });
            }

            // Supabase doesn't support bulk update natively with varying values in a single call easily without upsert.
            // We'll iterate through updates
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
                    .eq('ID', update.rowIndex);

                if (error) throw error;
            }

            return NextResponse.json({ success: true });
        }

        if (!rowIndex) {
            return NextResponse.json({ error: 'rowIndex is required' }, { status: 400 });
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
            .eq('ID', rowIndex);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('PUT /api/documents-tracking error:', error);
        return NextResponse.json({ error: error.message || 'Failed to update record' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex } = body;

        if (!rowIndex) {
            return NextResponse.json({ error: 'rowIndex is required' }, { status: 400 });
        }

        const { error } = await bhs_supabase
            .from('web_Documents_Tracking')
            .delete()
            .eq('ID', rowIndex);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('DELETE /api/documents-tracking error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete record' }, { status: 500 });
    }
}
