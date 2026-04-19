import { NextResponse } from 'next/server';
import { getSingleProductAnalysis } from '@/lib/googleSheets';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
        }

        const { searchParams } = new URL(request.url);
        const filters = {
            year: searchParams.get('year') || undefined,
            month: searchParams.get('month') || undefined,
            from: searchParams.get('from') || undefined,
            to: searchParams.get('to') || undefined,
            preset: searchParams.get('preset') || undefined,
        };

        const data = await getSingleProductAnalysis(id, filters);
        if (!data) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch product analysis', details: error.message },
            { status: 500 }
        );
    }
}
