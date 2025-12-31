import { NextResponse } from 'next/server';
import { getProductOrdersData } from '@/lib/googleSheets';

export async function GET() {
    try {
        const data = await getProductOrdersData();
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch product orders data', details: error.message },
            { status: 500 }
        );
    }
}
