import { NextResponse } from 'next/server';
import { getSemiClosedCustomers } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const semiClosedCustomers = await getSemiClosedCustomers();
        return NextResponse.json({ semiClosedCustomers: Array.from(semiClosedCustomers) });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch semi-closed customers list' },
            { status: 500 }
        );
    }
}
