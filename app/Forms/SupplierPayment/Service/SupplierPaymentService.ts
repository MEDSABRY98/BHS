'use server';

// Supplier Payment form — suppliers list for the dropdown (read only, from bhs_SUPPLIERS).

import { getSessionUser, UnauthorizedError } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { formsOf } from '../../Shared/FormsPermissions';
import { SUPPLIER_PAYMENT_FORM_ID } from '../SupplierPaymentTypes';

export type PaymentSupplier = { id: string; name: string; paymentTerm: number };

/** Every supplier (name + payment term in days), A-Z. */
export async function listPaymentSuppliers(): Promise<PaymentSupplier[]> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (!formsOf(user).includes(SUPPLIER_PAYMENT_FORM_ID)) throw new UnauthorizedError("You don't have permission to use this form.");

  const out: PaymentSupplier[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await getSupabaseAdmin()
      .from('bhs_SUPPLIERS')
      .select('ID, "SUPPLIER ID", "SUPPLIER NAME", "PAYMENT TERM"')
      .order('ID', { ascending: true })
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    for (const r of (data || []) as any[]) {
      const name = String(r['SUPPLIER NAME'] || '').trim();
      if (!name) continue;
      out.push({ id: String(r['SUPPLIER ID'] || r.ID || name).trim(), name, paymentTerm: Number(r['PAYMENT TERM']) || 0 });
    }
    if (!data || data.length < size) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
