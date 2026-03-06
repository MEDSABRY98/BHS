import { NextResponse } from 'next/server';
import {
    getDocumentsTrackingRecords,
    addDocumentsTrackingRecord,
    updateDocumentsTrackingRecord,
    deleteDocumentsTrackingRecord,
    DocumentsTrackingRecord
} from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const records = await getDocumentsTrackingRecords();
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
            await addDocumentsTrackingRecord(records);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('POST /api/documents-tracking error:', error);
        return NextResponse.json({ error: 'Failed to add records' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex, ...data } = body;

        if (!rowIndex) {
            return NextResponse.json({ error: 'rowIndex is required' }, { status: 400 });
        }

        await updateDocumentsTrackingRecord(rowIndex, data);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/documents-tracking error:', error);
        return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex } = body;

        if (!rowIndex) {
            return NextResponse.json({ error: 'rowIndex is required' }, { status: 400 });
        }

        await deleteDocumentsTrackingRecord(rowIndex);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/documents-tracking error:', error);
        return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
}
