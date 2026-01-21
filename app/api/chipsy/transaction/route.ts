import { NextResponse } from 'next/server';
import {
    getChipsyInventory,
    getNextChipsyTransactionNumber,
    addChipsyBulkTransfers,
    ChipsyTransfer
} from '@/lib/googleSheets';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Support both single item (legacy/fallback) and batch array
        // Expected Batch Structure:
        // {
        //   transaction: { user, type, personName, customerName, description },
        //   items: [{ barcode, qty, unit }]
        // }

        let transactionMeta;
        let items: any[] = [];

        if (body.items && Array.isArray(body.items)) {
            transactionMeta = body.transaction;
            items = body.items;
        } else {
            // Legacy/Single Item Fallback
            transactionMeta = body;
            items = [{ barcode: body.barcode, qty: body.qty, unit: body.unit }];
        }

        const { user, type, personName, customerName, description } = transactionMeta;

        if (!items || items.length === 0 || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Fetch Inventory for Validation & Name Lookup
        const products = await getChipsyInventory();
        const productMap = new Map(products.map(p => [p.barcode, p]));

        // 2. Generate Transaction Number
        const transactionNumber = await getNextChipsyTransactionNumber();
        const now = new Date();
        const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;

        // 3. Prepare Transfers
        const transfers: ChipsyTransfer[] = [];

        for (const item of items) {
            const product = productMap.get(item.barcode);
            if (!product) continue; // Skip invalid products

            const qtyPcs = item.unit === 'CTN' ? item.qty * product.pcsInCtn : item.qty;

            transfers.push({
                number: transactionNumber,
                user: user || 'Unknown',
                date: dateStr,
                type,
                personName: personName || '',
                customerName: customerName || '',
                barcode: item.barcode,
                productName: product.productName,
                qtyPcs,
                description: description || ''
            });
        }

        if (transfers.length === 0) {
            return NextResponse.json({ error: 'No valid items to process' }, { status: 400 });
        }

        // 4. Save to Sheets
        await addChipsyBulkTransfers(transfers);

        return NextResponse.json({ success: true, transactionNumber });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
    }
}
