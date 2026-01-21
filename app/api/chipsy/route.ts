import { NextResponse } from 'next/server';
import { getChipsyInventory, getChipsyTransfers } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [inventory, transfers] = await Promise.all([
            getChipsyInventory(),
            getChipsyTransfers()
        ]);

        // Create a map of mutable products
        const inventoryMap = new Map(inventory.map(item => [item.barcode, { ...item }]));

        // Apply all transfers to calculate dynamic stock
        // Note: transfers are returned newest-first by getChipsyTransfers, but order doesn't matter for sum
        transfers.forEach(transfer => {
            const product = inventoryMap.get(transfer.barcode);
            if (product) {
                if (transfer.type === 'IN') {
                    product.qtyPcs += transfer.qtyPcs;
                } else if (transfer.type === 'OUT') {
                    product.qtyPcs -= transfer.qtyPcs;
                }
            }
        });

        const data = Array.from(inventoryMap.values());
        return NextResponse.json({ data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch chipsy inventory' }, { status: 500 });
    }
}
