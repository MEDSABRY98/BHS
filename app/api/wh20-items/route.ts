import { NextResponse } from 'next/server';
import { getWh20Items, getNextWh20TransactionNumber, addWh20Transfers, Wh20Transfer, getWh20AutocompleteData } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [items, autocomplete] = await Promise.all([
            getWh20Items(),
            getWh20AutocompleteData()
        ]);
        return NextResponse.json({ items, autocomplete });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch WH/20 items' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { header, rows, user } = body;

        if (!header || !rows || rows.length === 0) {
            return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
        }

        const transactionNumber = await getNextWh20TransactionNumber();
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; // YYYY-MM-DD

        const transfers: Wh20Transfer[] = rows.map((row: any) => ({
            user: user || 'Unknown',
            number: transactionNumber,
            date: header.date || dateStr,
            recipientName: header.receiverName,
            destination: header.destination,
            reason: header.reason,
            barcode: row.barcode,
            product: row.productName,
            qty: parseFloat(row.qty),
            type: row.unit,
            price: parseFloat(row.price),
            total: parseFloat(row.total)
        }));

        await addWh20Transfers(transfers);

        return NextResponse.json({ success: true, transactionNumber });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to save transfer' }, { status: 500 });
    }
}
