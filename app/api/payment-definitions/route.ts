
import { NextResponse } from 'next/server';
import { getPaymentDefinitions, updatePaymentDefinition } from '@/lib/googleSheets';

export async function GET() {
    try {
        const data = await getPaymentDefinitions();
        return NextResponse.json({ data });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch payment definitions' },
            { status: 500 }
        );
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex, monthsClosed } = body;

        if (!rowIndex) {
            return NextResponse.json(
                { error: 'Row index is required' },
                { status: 400 }
            );
        }

        await updatePaymentDefinition(rowIndex, monthsClosed || '');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to update payment definition' },
            { status: 500 }
        );
    }
}
