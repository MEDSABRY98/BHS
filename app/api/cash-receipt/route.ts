import { NextResponse } from 'next/server';
import { saveCashReceipt, getLastReceiptNumber, getAllReceipts } from '@/components/CashReceipt';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const fetchAll = searchParams.get('all') === 'true';

        if (fetchAll) {
            const receipts = await getAllReceipts();
            return NextResponse.json({ receipts });
        }

        const lastId = await getLastReceiptNumber();
        const parts = lastId.split('-');
        let nextNum = 1;

        if (parts.length > 1) {
            const numPart = parseInt(parts[1]);
            if (!isNaN(numPart)) {
                nextNum = numPart + 1;
            }
        }

        const nextId = `CAH-${nextNum.toString().padStart(3, '0')}`;
        return NextResponse.json({ nextId });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, receiptNumber, receivedFrom, sendBy, amount, amountInWords, reason } = body;

        if (!date || !receiptNumber || !receivedFrom || !amount) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if receipt number already exists
        const allReceipts = await getAllReceipts();
        const exists = allReceipts.some((r: any) => r.receiptNumber.toLowerCase() === receiptNumber.toLowerCase());
        if (exists) {
            return NextResponse.json(
                { error: `Receipt number ${receiptNumber} already exists in the system.` },
                { status: 409 }
            );
        }

        await saveCashReceipt({
            date,
            receiptNumber,
            receivedFrom,
            sendBy,
            amount: parseFloat(amount),
            amountInWords,
            reason,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to save cash receipt' },
            { status: 500 }
        );
    }
}
