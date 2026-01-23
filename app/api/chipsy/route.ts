import { NextResponse } from 'next/server';
import { getChipsyInventory, getChipsyTransfers, getSheetData } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [inventory, transfers, mainSheetData] = await Promise.all([
            getChipsyInventory(),
            getChipsyTransfers(),
            getSheetData()
        ]);

        // Create a map of mutable products
        const inventoryMap = new Map(inventory.map(item => [item.barcode, { ...item }]));

        // Process transfers chronologically (Oldest First)
        // getChipsyTransfers returns Newest First, so we reverse it
        const chronologicalTransfers = [...transfers].reverse();
        const personSalesBuffer = new Map<string, number>(); // barcode -> qty

        chronologicalTransfers.forEach(transfer => {
            const product = inventoryMap.get(transfer.barcode);
            if (!product) return;

            const isMain = (t: string) => t === 'Main Inventory' || t === 'MAIN';
            const isCustomer = (t: string) => t === 'Customer' || t === 'CUSTOMER';
            const isLegacyIn = (t: string) => t === 'IN';
            const isLegacyOut = (t: string) => t === 'OUT';

            // Track Person -> Customer Sales (Buffer against future reconciliation)
            // A person sale means the item left physical stock (via person) previously.
            // When we later reconcile with Odoo (Main -> Customer), we shouldn't deduct this item again.
            if (!isMain(transfer.locFrom) && !isCustomer(transfer.locFrom) && !isLegacyIn(transfer.locFrom) && !isLegacyOut(transfer.locFrom) &&
                isCustomer(transfer.locTo)) {

                const currentBuffer = personSalesBuffer.get(transfer.barcode) || 0;
                personSalesBuffer.set(transfer.barcode, currentBuffer + transfer.qtyPcs);
            }

            // Check for Reconciliation (Odoo Invoice Adjustment)
            const isReconciliation = transfer.description && transfer.description.includes('تسوية مخزون (فواتير عملاء)');

            // Stock In (Increase Main Inventory)
            if (isMain(transfer.locTo) || isLegacyIn(transfer.locFrom)) {
                product.qtyPcs += transfer.qtyPcs;
            }

            // Stock Out (Decrease Main Inventory)
            else if (isMain(transfer.locFrom) || isLegacyOut(transfer.locFrom)) {
                let qtyToDeduct = transfer.qtyPcs;

                if (isReconciliation) {
                    const buffer = personSalesBuffer.get(transfer.barcode) || 0;
                    // If buffer exists, we've already "spent" this stock via Person->Customer.
                    // So we ignore that amount from this deduction.
                    const amountToIgnore = Math.min(qtyToDeduct, buffer);

                    qtyToDeduct -= amountToIgnore;

                    // Consume the buffer
                    personSalesBuffer.set(transfer.barcode, buffer - amountToIgnore);
                }

                product.qtyPcs -= qtyToDeduct;
            }
        });

        // Extract unique customers from main app data
        const allCustomers = Array.from(new Set(mainSheetData.map(d => d.customerName))).sort();

        const data = Array.from(inventoryMap.values());
        return NextResponse.json({ data, transfers, allCustomers });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch chipsy inventory' }, { status: 500 });
    }
}
