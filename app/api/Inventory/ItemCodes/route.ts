import { NextResponse } from 'next/server';
import { getItemCodesData } from '@/lib/Sheets/GoogleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const data = await getItemCodesData();
        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching Item Codes:', error);
        return NextResponse.json({ error: 'Failed to fetch item codes' }, { status: 500 });
    }
}
