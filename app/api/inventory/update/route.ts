import { NextResponse } from 'next/server';
import { updateInventoryItem } from '@/lib/googleSheets';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex, ...data } = body;

    if (!rowIndex || !data) {
      return NextResponse.json(
        { error: 'Missing rowIndex or data' },
        { status: 400 }
      );
    }

    await updateInventoryItem(rowIndex, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update inventory item';
    return NextResponse.json(
      { 
        error: 'Failed to update inventory item',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

