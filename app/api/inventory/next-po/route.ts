import { NextResponse } from 'next/server';
import { getNextPONumber } from '@/lib/googleSheets';

export async function GET() {
    try {
        const poNumber = await getNextPONumber();
        return NextResponse.json({ poNumber });
    } catch (error) {
        console.error('Error fetching next PO Number:', error);
        return NextResponse.json({ error: 'Failed to fetch next PO Number' }, { status: 500 });
    }
}
