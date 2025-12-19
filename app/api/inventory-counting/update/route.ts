import { NextResponse } from 'next/server';
import { updateInventoryCountingProduct } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex, barcode, productName, qtyInBox, totalQty } = body;

    if (!rowIndex || !barcode || !productName) {
      return NextResponse.json(
        { error: 'Missing required fields: rowIndex, barcode, productName' },
        { status: 400 }
      );
    }

    await updateInventoryCountingProduct(rowIndex, {
      barcode,
      productName,
      qtyInBox: qtyInBox || 0,
      totalQty: totalQty || 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update inventory counting product';
    return NextResponse.json(
      { 
        error: 'Failed to update inventory counting product',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

