import { NextResponse } from 'next/server';
import { bhs_supabase } from '@/lib/Supabase';

// GET: Fetch all active or history petty cash records
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab');

    if (tab === 'history') {
      const { data, error } = await bhs_supabase
        .from('web_Petty_Cash_History')
        .select('*')
        .order('DATE', { ascending: false });

      if (error) throw error;

      const records = (data || []).map(row => ({
        id: row.ID,
        liquidationDate: row["LIQUIDATION DATE"],
        date: row.DATE,
        type: row.TYPE,
        amount: Number(row.AMOUNT),
        name: row.NAME,
        description: row.DESCRIPTION,
        paid: row.PAID,
        createdBy: row.CREATED_BY,
        liquidatedBy: row.LIQUIDATED_BY
      }));

      return NextResponse.json({ records });
    }

    // Default: active transactions
    const { data, error } = await bhs_supabase
      .from('web_Petty_Cash_Active')
      .select('*')
      .order('DATE', { ascending: false });

    if (error) throw error;

    const records = (data || []).map(row => ({
      id: row.ID,
      date: row.DATE,
      type: row.TYPE,
      amount: Number(row.AMOUNT),
      name: row.NAME,
      description: row.DESCRIPTION,
      paid: row.PAID,
      createdBy: row.CREATED_BY
    }));

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

// POST: Save a new petty cash entry OR settle/close the current period
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Handle Period Settlement
    if (action === 'settle') {
      const { liquidationDate, openingAmount, openingDescription, userName } = body;

      if (!liquidationDate || !userName) {
        return NextResponse.json({ error: 'Missing liquidationDate or userName' }, { status: 400 });
      }

      // 1. Fetch all active records to be liquidated
      const { data: activeRecords, error: fetchErr } = await bhs_supabase
        .from('web_Petty_Cash_Active')
        .select('*');

      if (fetchErr) throw fetchErr;

      // 2. Archive active records to history (if any exist)
      if (activeRecords && activeRecords.length > 0) {
        const historyRows = activeRecords.map((rec) => ({
          "ID": rec.ID,
          "LIQUIDATION DATE": liquidationDate,
          "DATE": rec.DATE,
          "TYPE": rec.TYPE,
          "AMOUNT": rec.AMOUNT,
          "NAME": rec.NAME,
          "DESCRIPTION": rec.DESCRIPTION,
          "PAID": rec.PAID,
          "CREATED_BY": rec.CREATED_BY,
          "LIQUIDATED_BY": userName
        }));

        // Insert into history
        const { error: insertErr } = await bhs_supabase
          .from('web_Petty_Cash_History')
          .insert(historyRows);

        if (insertErr) throw insertErr;

        // Delete from active
        const activeIds = activeRecords.map(rec => rec.ID);
        const { error: deleteErr } = await bhs_supabase
          .from('web_Petty_Cash_Active')
          .delete()
          .in('ID', activeIds);

        if (deleteErr) throw deleteErr;
      }

      // 3. Create a new opening balance receipt record if amount > 0
      if (openingAmount && parseFloat(openingAmount) > 0) {
        // Find the max ID across history to generate the next sequential ID
        const { data: latestHistory, error: historyErr } = await bhs_supabase
          .from('web_Petty_Cash_History')
          .select('ID')
          .order('CREATED_AT', { ascending: false })
          .limit(100);

        if (historyErr) throw historyErr;

        let maxNum = 0;
        if (latestHistory && latestHistory.length > 0) {
          latestHistory.forEach((h) => {
            if (h.ID && h.ID.startsWith('R-')) {
              const num = parseInt(h.ID.substring(2));
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          });
        }

        const nextId = `R-${String(maxNum + 1).padStart(4, '0')}`;

        // Insert opening receipt row in active
        const openingRow = {
          "ID": nextId,
          "DATE": liquidationDate,
          "TYPE": 'Receipt',
          "AMOUNT": parseFloat(openingAmount),
          "NAME": 'Custodian',
          "DESCRIPTION": openingDescription || 'Opening Balance / رصيد افتتاحي للدورة الجديدة',
          "PAID": 'Yes',
          "CREATED_BY": userName
        };

        const { error: openingInsertErr } = await bhs_supabase
          .from('web_Petty_Cash_Active')
          .insert([openingRow]);

        if (openingInsertErr) throw openingInsertErr;
      }

      return NextResponse.json({ success: true });
    }

    // Handle normal Add New entry
    const { date, type, amount, name, description, paid, createdBy } = body;

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

    // 1. Generate the next sequential ID (R-XXXX)
    // Retrieve max from both Active and History tables
    const [activeRes, historyRes] = await Promise.all([
      bhs_supabase.from('web_Petty_Cash_Active').select('ID').order('CREATED_AT', { ascending: false }).limit(100),
      bhs_supabase.from('web_Petty_Cash_History').select('ID').order('CREATED_AT', { ascending: false }).limit(100)
    ]);

    if (activeRes.error) throw activeRes.error;
    if (historyRes.error) throw historyRes.error;

    let maxNum = 0;
    const checkMax = (list: any[]) => {
      list.forEach((r) => {
        if (r.ID && r.ID.startsWith('R-')) {
          const num = parseInt(r.ID.substring(2));
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      });
    };

    checkMax(activeRes.data || []);
    checkMax(historyRes.data || []);

    const nextId = `R-${String(maxNum + 1).padStart(4, '0')}`;

    // 2. Insert record into active table
    const { error: insertErr } = await bhs_supabase
      .from('web_Petty_Cash_Active')
      .insert([{
        "ID": nextId,
        "DATE": date,
        "TYPE": type,
        "AMOUNT": parseFloat(amount),
        "NAME": name,
        "DESCRIPTION": description,
        "PAID": paid || 'No',
        "CREATED_BY": createdBy || 'System'
      }]);

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, id: nextId });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      {
        error: 'Failed to process request',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// PUT: Update an active petty cash record
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, date, type, amount, name, description, paid } = body;

    if (!id || !date || !type || !amount || !name || !description) {
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

    const { error } = await bhs_supabase
      .from('web_Petty_Cash_Active')
      .update({
        "DATE": date,
        "TYPE": type,
        "AMOUNT": parseFloat(amount),
        "NAME": name,
        "DESCRIPTION": description,
        "PAID": paid || 'No'
      })
      .eq('ID', id);

    if (error) throw error;

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

// DELETE: Delete an active petty cash record
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing id' },
        { status: 400 }
      );
    }

    const { error } = await bhs_supabase
      .from('web_Petty_Cash_Active')
      .delete()
      .eq('ID', id);

    if (error) throw error;

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
