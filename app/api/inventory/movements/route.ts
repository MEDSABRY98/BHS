import { NextResponse } from 'next/server';
import { getProductMovementsData } from '@/lib/googleSheets';

export async function GET() {
    try {
        const data = await getProductMovementsData();
        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch movements data', details: error.message },
            { status: 500 }
        );
    }
}
