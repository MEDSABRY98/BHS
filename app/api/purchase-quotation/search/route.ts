import { NextRequest, NextResponse } from 'next/server';
import { searchQuotationByNumber } from '@/lib/purchaseQuotationSheets';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const quotationNumber = searchParams.get('number');

        if (!quotationNumber) {
            return NextResponse.json(
                { error: 'Quotation number is required' },
                { status: 400 }
            );
        }

        const result = await searchQuotationByNumber(quotationNumber);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error searching quotation:', error);
        return NextResponse.json(
            { error: 'Failed to search quotation' },
            { status: 500 }
        );
    }
}
