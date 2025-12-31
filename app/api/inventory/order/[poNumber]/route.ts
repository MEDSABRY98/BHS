import { NextResponse } from 'next/server';
import { getOrderDetailsByPO } from '@/lib/googleSheets';

export async function GET(
    request: Request,
    { params }: { params: { poNumber: string } }
) {
    const poNumber = params.poNumber;

    try {
        const orderItems = await getOrderDetailsByPO(poNumber);
        return NextResponse.json({ success: true, data: orderItems });
    } catch (error) {
        console.error('Error in order/[poNumber]:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch order details' },
            { status: 500 }
        );
    }
}
