import { NextResponse } from 'next/server';
import { getSupplierData } from '@/lib/googleSheets';

export async function GET() {
    try {
        const data = await getSupplierData();
        return NextResponse.json({ data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch supplier data' },
            { status: 500 }
        );
    }
}
