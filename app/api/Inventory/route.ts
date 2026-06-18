import { NextResponse } from 'next/server';
import { getProductOrdersData, updateProductColumn } from '@/lib/Sheets/GoogleSheets';

export const maxDuration = 120;

export async function GET() {
  try {
    const data = await getProductOrdersData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch inventory data';
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory data',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { productId, field, value } = await request.json();

    if (!productId || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await updateProductColumn(productId, field, value);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update Error:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error.message },
      { status: 500 }
    );
  }
}

