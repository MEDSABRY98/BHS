'use server';

import { bhs_supabas } from '@/lib/supabase';

export async function getVouchers() {
  const { data, error } = await bhs_supabas
    .from('web_Petty_Cash_Vouchers')
    .select('*')
    .order('VOUCHER NUMBER', { ascending: false });

  if (error) throw new Error(error.message || 'Failed to fetch vouchers');

  return (data || []).map(row => ({
    number: row["VOUCHER NUMBER"],
    date: row.DATE,
    receiptName: row["RECEIPT NAME"],
    amount: Number(row.AMOUNT),
    description: row.DESCRIPTION,
    createdBy: row.CREATED_BY
  }));
}

export async function createVoucher(body: any) {
  const { date, voucherNumber, receiptName, amount, description, createdBy } = body;

  if (!date || !voucherNumber || !receiptName || !amount) {
    throw new Error('Missing required fields');
  }

  const { error } = await bhs_supabas
    .from('web_Petty_Cash_Vouchers')
    .insert([{
      "VOUCHER NUMBER": voucherNumber.trim(),
      "DATE": date,
      "RECEIPT NAME": receiptName.trim(),
      "AMOUNT": parseFloat(amount),
      "DESCRIPTION": description || '',
      "CREATED_BY": createdBy || 'System'
    }]);

  if (error) throw new Error(error.message || 'Failed to save voucher');

  return { success: true };
}
