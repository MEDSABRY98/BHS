import { NextResponse } from 'next/server';
import { getWaterDeliveryNoteData, saveWaterDeliveryNote, getNextDeliveryNoteNumber } from '@/lib/googleSheets';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // If action is 'next-number', return the next delivery note number
    if (action === 'next-number') {
      const nextNumber = await getNextDeliveryNoteNumber();
      return NextResponse.json({ nextNumber });
    }

    // Otherwise, return the items data
    const data = await getWaterDeliveryNoteData();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching water delivery note data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch water delivery note data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, deliveryNoteNumber, items } = body;

    if (!date || !deliveryNoteNumber || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Missing required fields: date, deliveryNoteNumber, items' },
        { status: 400 }
      );
    }

    await saveWaterDeliveryNote({
      date,
      deliveryNoteNumber,
      items: items.map((item: any) => ({
        itemName: item.itemName || '',
        quantity: item.quantity || 0
      }))
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving water delivery note:', error);
    return NextResponse.json(
      { error: 'Failed to save water delivery note' },
      { status: 500 }
    );
  }
}

