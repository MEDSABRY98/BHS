import { NextResponse } from 'next/server';
import { getSuppliersMatchingData, saveSuppliersMatchingData } from '@/lib/googleSheets';

export async function GET() {
    try {
        const data = await getSuppliersMatchingData();
        return NextResponse.json({ data });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { supplierId, supplierName, months } = await request.json();
        await saveSuppliersMatchingData(supplierId, supplierName, months);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
}
