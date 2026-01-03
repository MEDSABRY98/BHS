import { NextResponse } from 'next/server';
import { markReconciliationMonth } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerName = body?.customerName;
    const monthKey = body?.monthKey;
    const action = body?.action || 'reconcile'; // 'reconcile' or 'unreconcile'

    if (!customerName || !monthKey) {
      return NextResponse.json(
        { error: 'customerName and monthKey are required' },
        { status: 400 },
      );
    }

    let reconciliationMonths: string[];
    if (action === 'unreconcile') {
      const { unmarkReconciliationMonth } = await import('@/lib/googleSheets');
      reconciliationMonths = await unmarkReconciliationMonth(customerName, monthKey);
    } else {
      reconciliationMonths = await markReconciliationMonth(customerName, monthKey);
    }

    return NextResponse.json({ reconciliationMonths });
  } catch (error) {
    console.error('API Error (reconcile):', error);
    const message = error instanceof Error ? error.message : 'Failed to mark reconciliation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


