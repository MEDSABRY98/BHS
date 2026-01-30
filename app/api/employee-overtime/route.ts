import { NextResponse } from 'next/server';
import {
  getEmployeeNames,
  getEmployeeSalaries,
  saveEmployeeOvertime,
  getEmployeeOvertimeRecords,
  updateEmployeeOvertime,
  deleteEmployeeOvertime,
  getEmployeeAbsenceRecords,
  saveEmployeeAbsence,
  deleteEmployeeAbsence
} from '@/lib/googleSheets';

// GET: Fetch employee names, overtime records, or absence records
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'names') {
      const [names, salaries] = await Promise.all([
        getEmployeeNames(),
        getEmployeeSalaries()
      ]);
      return NextResponse.json({ names, salaries });
    } else if (type === 'absence') {
      const records = await getEmployeeAbsenceRecords();
      return NextResponse.json({ records });
    } else {
      const records = await getEmployeeOvertimeRecords();
      return NextResponse.json({ records });
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Save overtime or absence records
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, date, employeeName, employeeNameEn, particulars, description, type, shiftStart, shiftEnd, shiftHours, overtimeHours, deductionHours } = body;

    if (!date || (!employeeName && !employeeNameEn)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (mode === 'absence') {
      await saveEmployeeAbsence({
        date,
        employeeNameEn: employeeNameEn || employeeName,
        particulars: particulars || description || ''
      });
    } else {
      await saveEmployeeOvertime({
        date,
        employeeName: employeeName || employeeNameEn,
        type: type || 'Overtime',
        description: description || particulars || '',
        shiftStart,
        shiftEnd,
        shiftHours,
        overtimeHours,
        deductionHours
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to save record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete record
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex, mode } = body;

    if (!rowIndex) {
      return NextResponse.json({ error: 'Missing rowIndex' }, { status: 400 });
    }

    if (mode === 'absence') {
      await deleteEmployeeAbsence(rowIndex);
    } else {
      await deleteEmployeeOvertime(rowIndex);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT: Update overtime record (Absence update not requested but could be added similarly)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex, date, employeeName, type, description, shiftStart, shiftEnd, shiftHours, overtimeHours, deductionHours } = body;

    if (!rowIndex || !date || !employeeName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await updateEmployeeOvertime(rowIndex, {
      date,
      employeeName,
      type: type || 'Overtime',
      description,
      shiftStart,
      shiftEnd,
      shiftHours,
      overtimeHours,
      deductionHours
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update record', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

