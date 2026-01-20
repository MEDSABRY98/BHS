
import { NextResponse } from 'next/server';
import {
    getChipsyInventory,
    updateChipsyInventoryQty,
    addChipsyTransfer,
    ChipsyTransfer
} from '@/lib/googleSheets';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { barcode, type, qty, unit, user, personName, customerName } = body;
        // type: 'IN' | 'OUT'
        // unit: 'PCS' | 'CTN'
        // qty: number

        if (!barcode || !type || !qty || !unit) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Fetch current inventory to find product and current stock
        const products = await getChipsyInventory();
        const product = products.find(p => p.barcode === barcode);

        if (!product) {
            return NextResponse.json({ error: 'Product not found in inventory' }, { status: 404 });
        }

        // 2. Calculate Qty in Pieces
        const qtyPcs = unit === 'CTN' ? qty * product.pcsInCtn : qty;

        // 3. Calculate New Stock
        let newStock = product.qtyPcs;
        if (type === 'IN') {
            newStock += qtyPcs;
        } else if (type === 'OUT') {
            newStock -= qtyPcs;
        }

        // 4. Update Inventory Sheet
        await updateChipsyInventoryQty(product.rowIndex, newStock);

        // 5. Add Transfer Record
        const transfer: ChipsyTransfer = {
            user: user || 'Unknown',
            date: new Date().toLocaleString('en-US'),
            type,
            personName: personName || '',
            customerName: customerName || '',
            barcode,
            productName: product.productName,
            qtyPcs // Always record in Pieces
        };

        await addChipsyTransfer(transfer);

        return NextResponse.json({ success: true, newStock });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
    }
}
