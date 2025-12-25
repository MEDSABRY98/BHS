import { NextResponse } from 'next/server';
import { getEmployeeNames, saveEmployeeOvertime, getEmployeeOvertimeRecords } from '@/lib/googleSheets';

// GET: Fetch employee names or all records
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    if (type === 'names') {
      // Get employee names for dropdown
      const names = await getEmployeeNames();
      return NextResponse.json({ names });
    } else {
      // Get all overtime records
      const records = await getEmployeeOvertimeRecords();
      return NextResponse.json({ records });
    }
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

// POST: Save employee overtime record
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, employeeName, description, timeFrom, timeTo } = body;

    if (!date || !employeeName || !description || !timeFrom || !timeTo) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await saveEmployeeOvertime({
      date,
      employeeName,
      description,
      timeFrom,
      timeTo,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save overtime record';
    return NextResponse.json(
      { 
        error: 'Failed to save overtime record',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

