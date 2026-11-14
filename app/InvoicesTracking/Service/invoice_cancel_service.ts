'use server';

// Invoice cancellation forms: every form that is printed / downloaded is kept in
// web_INVOICE_CANCELLATIONS (one row per invoice, rows of one form share FORM_ID).
//
// create table if not exists "web_INVOICE_CANCELLATIONS" (
//   "ID" uuid primary key default gen_random_uuid(),
//   "FORM_ID" text not null,
//   "INVOICE_ID" text not null,
//   "CUSTOMER_ID" text,
//   "AMOUNT" numeric not null default 0,
//   "REASON" text not null,
//   "NOTES" text,
//   "CREATED_BY_ID" text,
//   "CREATED_AT" timestamptz not null default now()
// );
// create index if not exists "web_INVOICE_CANCELLATIONS_FORM_ID_idx" on "web_INVOICE_CANCELLATIONS" ("FORM_ID");
// create index if not exists "web_INVOICE_CANCELLATIONS_INVOICE_ID_idx" on "web_INVOICE_CANCELLATIONS" ("INVOICE_ID");

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, UnauthorizedError } from '@/lib/session';

const TABLE = 'web_INVOICE_CANCELLATIONS';

export interface CancelFormLineInput {
  invoiceId: string;
  customerId?: string;
  customerName: string;
  amount: number;
}

/** Saves one cancellation form; returns its number (FORM_ID). Errors are returned as values. */
export async function saveInvoiceCancellation(
  lines: CancelFormLineInput[],
  notes?: string,
  reason?: string,
): Promise<{ ok: true; formId: string } | { ok: false; error: string }> {
  try {
    const user = await getSessionUser();
    if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');

    const why = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
    if (!why) return { ok: false, error: 'The cancellation reason is required.' };

    const clean = (Array.isArray(lines) ? lines : [])
      .slice(0, 500)
      .map((l) => ({
        invoiceId: String(l?.invoiceId || '').trim().slice(0, 120),
        customerId: String(l?.customerId || '').trim().slice(0, 120),
        amount: Math.round((Number(l?.amount) || 0) * 100) / 100,
      }))
      .filter((l) => l.invoiceId);
    if (!clean.length) return { ok: false, error: 'No invoices to save.' };

    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date())
      .replace(/-/g, '');
    const formId = `IC-${d}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    const rows = clean.map((l) => ({
      FORM_ID: formId,
      INVOICE_ID: l.invoiceId,
      CUSTOMER_ID: l.customerId || null,
      AMOUNT: l.amount,
      REASON: why,
      NOTES: String(notes || '').trim().slice(0, 2000) || null,
      CREATED_BY_ID: String(user.id),
      CREATED_AT: createdAt,
    }));

    const { error } = await getSupabaseAdmin().from(TABLE).insert(rows);
    if (error) {
      return {
        ok: false,
        error: error.code === '42P01' ? 'The table web_INVOICE_CANCELLATIONS is not created yet.' : error.message,
      };
    }
    return { ok: true, formId };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Could not save the cancellation form.' };
  }
}
