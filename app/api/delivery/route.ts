import { NextResponse } from 'next/server';
import {
    getLpoRecords,
    getLpoItemsLog,
    addLpoRecord,
    updateLpoRecord,
    deleteLpoRecord,
    addLpoItemLog,
    getLpoCustomers,
} from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

// ── GET /api/delivery ──────────────────────────────────────────
// Returns all LPO records merged with their items (missing, shipped, canceled)
export async function GET() {
    try {
        const [records, itemsLog, customers] = await Promise.all([
            getLpoRecords(),
            getLpoItemsLog(),
            getLpoCustomers(),
        ]);

        // Merge items into each LPO record
        const merged = records.map(record => {
            const items = itemsLog.filter(item => item.lpoId === record.lpoId);
            const missing = items.filter(i => i.status === 'missing').map(i => i.itemName);
            const shippedItems = items.filter(i => i.status === 'shipped').map(i => i.itemName);
            const canceledItems = items.filter(i => i.status === 'canceled').map(i => i.itemName);

            return {
                id: record.lpoId,
                lpoId: record.lpoId,
                lpo: record.lpoNumber,
                date: record.lpoDate,
                customer: record.customerName,
                lpoVal: record.lpoValue,
                invoiceVal: record.invoiceValue,
                invoiceDate: record.invoiceDate,
                status: record.status,
                reship: record.reship,
                notes: record.notes,
                missing,
                shippedItems,
                canceledItems,
                _rowIndex: record.rowIndex, // for updates/deletes
            };
        });

        return NextResponse.json({ orders: merged, customers });
    } catch (error) {
        console.error('GET /api/delivery error:', error);
        return NextResponse.json({ error: 'Failed to fetch delivery data' }, { status: 500 });
    }
}

// ── POST /api/delivery ─────────────────────────────────────────
// Add new LPO record  OR  Add item log entry
// body: { action: 'add_lpo' | 'add_item', ...data }
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'add_lpo') {
            const { lpoNumber, lpoDate, customerName, lpoValue } = body;
            if (!lpoNumber || !lpoDate || !customerName || !lpoValue) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }
            // Auto-generate LPO ID: read current count and create L-XXX
            const existingRecords = await getLpoRecords();
            const nextNum = (existingRecords.length + 1).toString().padStart(3, '0');
            const lpoId = `L-${nextNum}`;
            await addLpoRecord({ lpoId, lpoNumber, lpoDate, customerName, lpoValue });
            return NextResponse.json({ success: true, lpoId });
        }

        if (action === 'add_item') {
            const { lpoId, itemName, status, shipmentValue } = body;
            if (!lpoId || !itemName || !status) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }
            // Auto-generate Row ID: read current count and create R-XXX
            const existingItems = await getLpoItemsLog();
            const nextNum = (existingItems.length + 1).toString().padStart(3, '0');
            const rowId = `R-${nextNum}`;
            await addLpoItemLog({ rowId, lpoId, itemName, status, shipmentValue: shipmentValue || 0 });
            return NextResponse.json({ success: true, rowId });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('POST /api/delivery error:', error);
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}

// ── PUT /api/delivery ──────────────────────────────────────────
// Update LPO record fields (invoice info, status, reship, notes)
// body: { rowIndex, ...fields }
export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex, ...fields } = body;

        if (!rowIndex) {
            return NextResponse.json({ error: 'rowIndex is required' }, { status: 400 });
        }

        await updateLpoRecord(rowIndex, fields);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('PUT /api/delivery error:', error);
        return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }
}

// ── DELETE /api/delivery ───────────────────────────────────────
// Delete LPO record by rowIndex
// body: { rowIndex }
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex } = body;

        if (!rowIndex) {
            return NextResponse.json({ error: 'rowIndex is required' }, { status: 400 });
        }

        await deleteLpoRecord(rowIndex);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('DELETE /api/delivery error:', error);
        return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }
}
