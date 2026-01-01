
import { NextResponse } from 'next/server';
import { updateProductOrderQinc } from '@/lib/googleSheets';

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { rowIndex, qinc } = body;

        if (!rowIndex || qinc === undefined) {
            return NextResponse.json(
                { error: 'Missing rowIndex or qinc' },
                { status: 400 }
            );
        }

        await updateProductOrderQinc(rowIndex, Number(qinc));

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to update QINC', details: error.message },
            { status: 500 }
        );
    }
}
