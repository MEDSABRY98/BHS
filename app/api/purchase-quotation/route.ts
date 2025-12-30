import { NextRequest, NextResponse } from 'next/server';
import { getNextQuotationNumber, savePurchaseQuotation, searchQuotationByNumber } from '@/lib/purchaseQuotationSheets';

export async function GET() {
    try {
        const nextNumber = await getNextQuotationNumber();
        return NextResponse.json({ quotationNumber: nextNumber });
    } catch (error) {
        console.error('Error fetching quotation number:', error);
        return NextResponse.json(
            { error: 'Failed to fetch quotation number' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const result = await savePurchaseQuotation(body);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error saving quotation:', error);
        return NextResponse.json(
            { error: 'Failed to save quotation' },
            { status: 500 }
        );
    }
}
