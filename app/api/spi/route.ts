import { NextResponse } from 'next/server';
import { getSpiData } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const data = await getSpiData();
        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch SPI' }, { status: 500 });
    }
}
