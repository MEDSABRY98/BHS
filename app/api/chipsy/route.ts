
import { NextResponse } from 'next/server';
import { getChipsyInventory } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const data = await getChipsyInventory();
        return NextResponse.json({ data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch chipsy inventory' }, { status: 500 });
    }
}
