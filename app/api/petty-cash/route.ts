import { NextResponse } from 'next/server';
import { savePettyCash, getPettyCashRecords, deletePettyCash, updatePettyCash } from '@/lib/googleSheets';

// GET: Fetch all petty cash records
export async function GET() {
  try {
    const records = await getPettyCashRecords();
    return NextResponse.json({ records });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch data';
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

// POST: Save petty cash entry
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, type, amount, name, description } = body;

    if (!date || !type || !amount || !name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type !== 'Receipt' && type !== 'Expense') {
      return NextResponse.json(
        { error: 'Type must be either "Receipt" or "Expense"' },
        { status: 400 }
      );
    }

    const result = await savePettyCash({
      date,
      type,
      amount: parseFloat(amount),
      name,
      description,
    });
    
    return NextResponse.json({ success: true, rowIndex: result.rowIndex });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save petty cash entry';
    return NextResponse.json(
      { 
        error: 'Failed to save petty cash entry',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

// PUT: Update petty cash record
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex, date, type, amount, name, description } = body;

    if (!rowIndex || !date || !type || !amount || !name || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type !== 'Receipt' && type !== 'Expense') {
      return NextResponse.json(
        { error: 'Type must be either "Receipt" or "Expense"' },
        { status: 400 }
      );
    }

    await updatePettyCash(rowIndex, {
      date,
      type,
      amount: parseFloat(amount),
      name,
      description,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update petty cash entry';
    return NextResponse.json(
      { 
        error: 'Failed to update petty cash entry',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete petty cash record
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex } = body;

    if (!rowIndex) {
      return NextResponse.json(
        { error: 'Missing rowIndex' },
        { status: 400 }
      );
    }

    await deletePettyCash(rowIndex);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete petty cash record';
    return NextResponse.json(
      { 
        error: 'Failed to delete petty cash record',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

