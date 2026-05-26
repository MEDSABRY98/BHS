import { NextResponse } from 'next/server';
import { saveVoucher, getVouchers } from '@/lib/googleSheets';

export async function GET() {
    try {
        const vouchers = await getVouchers();
        return NextResponse.json({ vouchers });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch vouchers' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { date, voucherNumber, receiptName, amount, description } = body;

        if (!date || !voucherNumber || !receiptName || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const result = await saveVoucher({
            date,
            voucherNumber,
            receiptName,
            amount: parseFloat(amount),
            description: description || '',
        });

        return NextResponse.json({ success: true, rowIndex: result.rowIndex });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Failed to save voucher' }, { status: 500 });
    }
}
