import { NextResponse } from 'next/server';
import { getSalesDataServer } from '@/lib/SalesCache';

export async function GET() {
  try {
    const rawData = await getSalesDataServer();
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Sales cache is empty' }, { status: 500 });
    }

    const customersMap = new Map<string, { id: string, mainName: string, subName: string }>();
    rawData.forEach(item => {
      if (item.customerId && !customersMap.has(item.customerId)) {
        customersMap.set(item.customerId, {
          id: item.customerId,
          mainName: item.customerMainName || '',
          subName: item.customerName || ''
        });
      }
    });

    const uniqueCustomers = Array.from(customersMap.values()).sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ uniqueCustomers });

  } catch (error: any) {
    console.error('API Error CustomersList:', error);
    return NextResponse.json({ error: 'Failed to fetch customers list', details: error.message || error }, { status: 500 });
  }
}
