import { NextResponse } from 'next/server';
import { saveCreateOrder } from '@/lib/googleSheets';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { items } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: 'Invalid order items' },
                { status: 400 }
            );
        }

        await saveCreateOrder(items);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('API Error saving create order:', error);
        return NextResponse.json(
            { error: 'Failed to save order' },
            { status: 500 }
        );
    }
}
