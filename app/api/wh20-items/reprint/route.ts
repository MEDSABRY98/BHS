import { NextResponse } from 'next/server';
import { getWh20TransferByNumber } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const transactionNumber = searchParams.get('transactionNumber');

        if (!transactionNumber) {
            return NextResponse.json({ error: 'Transaction number is required' }, { status: 400 });
        }

        const transfer = await getWh20TransferByNumber(transactionNumber);

        if (!transfer || transfer.length === 0) {
            return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
        }

        return NextResponse.json({ transfer });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch transfer' }, { status: 500 });
    }
}
