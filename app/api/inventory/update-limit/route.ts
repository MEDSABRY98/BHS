
import { NextResponse } from 'next/server';
import { updateProductOrderLimit } from '@/lib/googleSheets';

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex, field, value } = body;

        if (!rowIndex || !field || value === undefined) {
            return NextResponse.json(
                { error: 'Missing rowIndex, field, or value' },
                { status: 400 }
            );
        }

        if (field !== 'minQ' && field !== 'maxQ') {
            return NextResponse.json(
                { error: 'Invalid field. Must be minQ or maxQ' },
                { status: 400 }
            );
        }

        await updateProductOrderLimit(rowIndex, field, Number(value));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to update limit', details: error.message },
            { status: 500 }
        );
    }
}
