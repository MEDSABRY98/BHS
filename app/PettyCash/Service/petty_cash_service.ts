'use server';

import { bhs_supabas } from '@/lib/supabase';

function parseRecordNum(id: string): number | null {
  const baseId = String(id || '').split('#')[0];
  if (!baseId.startsWith('R-')) return null;
  const num = parseInt(baseId.substring(2), 10);
  return isNaN(num) ? null : num;
}

function formatRecordId(num: number): string {
  return `R-${String(num).padStart(4, '0')}`;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message || fallback);
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

async function getMaxRecordNum(): Promise<number> {
  const [activeRes, historyRes] = await Promise.all([
    bhs_supabas.from('web_Petty_Cash_Active').select('ID'),
    bhs_supabas.from('web_Petty_Cash_History').select('ID'),
  ]);

  if (activeRes.error) throw activeRes.error;
  if (historyRes.error) throw historyRes.error;

  let maxNum = 0;
  const checkMax = (list: { ID?: string }[]) => {
    list.forEach((row) => {
      const num = parseRecordNum(row.ID || '');
      if (num !== null && num > maxNum) {
        maxNum = num;
      }
    });
  };

  checkMax(activeRes.data || []);
  checkMax(historyRes.data || []);

  return maxNum;
}

export async function getNextRecordId(): Promise<string> {
  return formatRecordId((await getMaxRecordNum()) + 1);
}

export async function getPettyCashRecords(tab: 'active' | 'history') {
  if (tab === 'history') {
    const { data, error } = await bhs_supabas
      .from('web_Petty_Cash_History')
      .select('*')
      .order('DATE', { ascending: false });

    if (error) throw new Error(extractErrorMessage(error, 'Failed to fetch history'));

    return (data || []).map((row) => ({
      id: row.ID,
      liquidationDate: row["LIQUIDATION DATE"],
      date: row.DATE,
      type: row.TYPE,
      amount: Number(row.AMOUNT),
      name: row.NAME,
      description: row.DESCRIPTION,
      paid: row.PAID
    }));
  }

  const { data, error } = await bhs_supabas
    .from('web_Petty_Cash_Active')
    .select('*')
    .order('DATE', { ascending: false });

  if (error) throw new Error(extractErrorMessage(error, 'Failed to fetch active records'));

  return (data || []).map((row) => ({
    id: row.ID,
    date: row.DATE,
    type: row.TYPE,
    amount: Number(row.AMOUNT),
    name: row.NAME,
    description: row.DESCRIPTION,
    paid: row.PAID
  }));
}

export async function createPettyCashEntry(body: any) {
  const { date, type, amount, name, description, paid } = body;

  if (!date || !type || !amount || !name || !description) {
    throw new Error('Missing required fields');
  }

  if (type !== 'Receipt' && type !== 'Expense') {
    throw new Error('Type must be either "Receipt" or "Expense"');
  }

  const nextId = await getNextRecordId();

  const { error: insertErr } = await bhs_supabas
    .from('web_Petty_Cash_Active')
    .insert([{
      "ID": nextId,
      "DATE": date,
      "TYPE": type,
      "AMOUNT": parseFloat(amount),
      "NAME": name,
      "DESCRIPTION": description,
      "PAID": paid || 'No'
    }]);

  if (insertErr) throw new Error(extractErrorMessage(insertErr, 'Failed to insert active record'));

  return { success: true, id: nextId };
}

export async function updatePettyCashEntry(body: any) {
  const { id, date, type, amount, name, description, paid } = body;

  if (!id || !date || !type || !amount || !name || !description) {
    throw new Error('Missing required fields');
  }

  if (type !== 'Receipt' && type !== 'Expense') {
    throw new Error('Type must be either "Receipt" or "Expense"');
  }

  const { error } = await bhs_supabas
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

  if (error) throw new Error(extractErrorMessage(error, 'Failed to update petty cash entry'));

  return { success: true };
}

export async function deletePettyCashEntry(id: string) {
  if (!id) {
    throw new Error('Missing id');
  }

  const { error } = await bhs_supabas
    .from('web_Petty_Cash_Active')
    .delete()
    .eq('ID', id);

  if (error) throw new Error(extractErrorMessage(error, 'Failed to delete petty cash record'));

  return { success: true };
}

export async function settlePettyCashPeriod(body: any) {
  const { liquidationDate, openingAmount, openingDescription } = body;

  if (!liquidationDate) {
    throw new Error('Missing liquidationDate');
  }

  const { data: activeRecords, error: fetchErr } = await bhs_supabas
    .from('web_Petty_Cash_Active')
    .select('*');

  if (fetchErr) throw new Error(extractErrorMessage(fetchErr, 'Failed to fetch active records'));

  if (activeRecords && activeRecords.length > 0) {
    const { error: cleanupErr } = await bhs_supabas
      .from('web_Petty_Cash_History')
      .delete()
      .eq('LIQUIDATION DATE', liquidationDate);

    if (cleanupErr) throw new Error(extractErrorMessage(cleanupErr, 'Failed to cleanup existing history'));

    let nextNum = await getMaxRecordNum();
    const historyRows = activeRecords.map((rec) => {
      nextNum += 1;
      return {
        "ID": formatRecordId(nextNum),
        "LIQUIDATION DATE": liquidationDate,
        "DATE": rec.DATE,
        "TYPE": rec.TYPE,
        "AMOUNT": rec.AMOUNT,
        "NAME": rec.NAME,
        "DESCRIPTION": rec.DESCRIPTION,
        "PAID": rec.PAID
      };
    });

    const { error: insertErr } = await bhs_supabas
      .from('web_Petty_Cash_History')
      .insert(historyRows);

    if (insertErr) throw new Error(extractErrorMessage(insertErr, 'Failed to insert history records'));

    const activeIds = activeRecords.map(rec => rec.ID);
    const { error: deleteErr } = await bhs_supabas
      .from('web_Petty_Cash_Active')
      .delete()
      .in('ID', activeIds);

    if (deleteErr) throw new Error(extractErrorMessage(deleteErr, 'Failed to delete active records'));
  }

  if (openingAmount && parseFloat(openingAmount) > 0) {
    const nextId = await getNextRecordId();

    const openingRow = {
      "ID": nextId,
      "DATE": liquidationDate,
      "TYPE": 'Receipt',
      "AMOUNT": parseFloat(openingAmount),
      "NAME": 'Custodian',
      "DESCRIPTION": openingDescription || 'Opening Balance / رصيد افتتاحي للدورة الجديدة',
      "PAID": 'Yes'
    };

    const { error: openingInsertErr } = await bhs_supabas
      .from('web_Petty_Cash_Active')
      .insert([openingRow]);

    if (openingInsertErr) throw new Error(extractErrorMessage(openingInsertErr, 'Failed to insert opening record'));
  }

  return { success: true };
}
