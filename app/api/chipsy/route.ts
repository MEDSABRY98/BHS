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
                // Stock In (Increase Main Inventory)
                // New: Destination is Main Inventory (e.g. Return from Person)
                // Legacy: Type was 'IN' (mapped to locFrom)
                if (transfer.locTo === 'Main Inventory' || transfer.locTo === 'MAIN' || transfer.locFrom === 'IN') {
                    product.qtyPcs += transfer.qtyPcs;
                }

                // Stock Out (Decrease Main Inventory)
                // New: Source is Main Inventory (e.g. Issue to Person)
                // Legacy: Type was 'OUT' (mapped to locFrom)
                else if (transfer.locFrom === 'Main Inventory' || transfer.locFrom === 'MAIN' || transfer.locFrom === 'OUT') {
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
