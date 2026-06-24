import { NextResponse } from 'next/server';
import { updateICItem } from '@/lib/Inventory';;

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { sheetName, productId, newValues } = body;

    if (!sheetName || !productId || !newValues) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const success = await updateICItem(sheetName, productId, newValues);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Item not found in sheet' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('API Error updating IC item:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update IC item' },
      { status: 500 }
    );
  }
}
