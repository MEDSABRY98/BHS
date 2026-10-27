'use server';

// Saved forms — one table for every form: web_FORMS_ARCHIVE (RLS on, only reachable through these actions).
// New form: bhs_save_form gives the number PREFIX-YEAR-0001 (year of the form date).
// Each user sees his own saved forms; the admin sees all, and only the admin edits / deletes.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { canSeeArchive, formsOf } from './FormsPermissions';
import { FORMS_SYSTEM_ID, formById } from './FormsRegistry';
import type { FormAccess, FormRecord, FormSavePayload } from './FormsArchiveTypes';

const TABLE = 'web_FORMS_ARCHIVE';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DATA = 4_000_000; // characters of JSON

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

function accessOf(user: SessionUserRecord, formId: string): FormAccess {
  return {
    use: formsOf(user).includes(formId),
    archive: canSeeArchive(user, formId),
    admin: isAdminUser(user, FORMS_SYSTEM_ID),
  };
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Map();
  const { data } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME').in('ID', uniq);
  return new Map((data || []).map((u: any) => [String(u.ID), String(u.NAME || '')]));
}

const toRecord = (r: any, names: Map<string, string>): FormRecord => ({
  ID: String(r.ID),
  FORM_ID: String(r.FORM_ID),
  TITLE: String(r.TITLE || ''),
  REF_NO: String(r.REF_NO || ''),
  DOC_DATE: r.DOC_DATE ? String(r.DOC_DATE).slice(0, 10) : null,
  AMOUNT: r.AMOUNT === null || r.AMOUNT === undefined ? null : Number(r.AMOUNT),
  DATA: r.DATA ?? {},
  CREATED_BY: String(r.CREATED_BY || ''),
  CREATED_BY_NAME: names.get(String(r.CREATED_BY)) || '',
  CREATED_AT: String(r.CREATED_AT || ''),
  UPDATED_AT: r.UPDATED_AT || null,
});

function clean(input: FormSavePayload) {
  const TITLE = String(input?.TITLE ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const d = String(input?.DOC_DATE ?? '').trim();
  const DOC_DATE = DATE_RE.test(d) ? d : null;
  const n = input?.AMOUNT === null || input?.AMOUNT === undefined ? null : Math.round(Number(input.AMOUNT) * 100) / 100;
  const AMOUNT = n === null || !Number.isFinite(n) ? null : n;
  const DATA = input?.DATA ?? {};
  if (JSON.stringify(DATA).length > MAX_DATA) throw new Error('This form is too large to save');
  return { TITLE, DOC_DATE, AMOUNT, DATA };
}

/** What the current user can do with this form. */
export async function getFormAccess(formId: string): Promise<FormAccess> {
  return accessOf(await requireUser(), formId);
}

/** Saved forms of one form, newest first (own ones; the admin sees all). */
export async function listFormRecords(formId: string): Promise<FormRecord[]> {
  const user = await requireUser();
  const access = accessOf(user, formId);
  if (!access.archive) throw new UnauthorizedError("You don't have permission to see the saved forms.");
  const db = getSupabaseAdmin();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(TABLE).select('*').eq('FORM_ID', formId);
    if (!access.admin) q = q.eq('CREATED_BY', String(user.id));
    const { data, error } = await q.order('CREATED_AT', { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const names = await userNames(rows.map((r) => String(r.CREATED_BY)));
  return rows.map((r) => toRecord(r, names));
}

/** Saves a new form (gets its number) or, with id, updates a saved one (admin only). */
export async function saveFormRecord(formId: string, input: FormSavePayload, id?: string | null): Promise<FormRecord> {
  const user = await requireUser();
  const access = accessOf(user, formId);
  if (!access.use) throw new UnauthorizedError("You don't have permission to use this form.");
  const form = formById(formId);
  if (!form) throw new Error('Unknown form');
  const rec = clean(input);
  const db = getSupabaseAdmin();

  if (id) {
    if (!isAdminUser(user, FORMS_SYSTEM_ID, 'edit')) throw new UnauthorizedError('Only the admin can edit a saved form.');
    const { data, error } = await db
      .from(TABLE)
      .update({ ...rec, UPDATED_AT: new Date().toISOString() })
      .eq('ID', id)
      .eq('FORM_ID', formId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return toRecord(data, await userNames([String(data.CREATED_BY)]));
  }

  const { data, error } = await db.rpc('bhs_save_form', {
    p_form: formId,
    p_prefix: form.prefix,
    p_title: rec.TITLE,
    p_doc_date: rec.DOC_DATE,
    p_amount: rec.AMOUNT,
    p_data: rec.DATA,
    p_user: String(user.id),
  });
  if (error) {
    if (/bhs_save_form/i.test(error.message) && /(find|exist)/i.test(error.message))
      throw new Error('The saving function is not installed in the database yet (bhs_save_form).');
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return toRecord(row, new Map([[String(user.id), user.name]]));
}

/** Deletes a saved form (admin only). */
export async function deleteFormRecord(formId: string, id: string): Promise<{ success: true }> {
  const user = await requireUser();
  if (!isAdminUser(user, FORMS_SYSTEM_ID, 'delete')) throw new UnauthorizedError('Only the admin can delete a saved form.');
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq('ID', id).eq('FORM_ID', formId);
  if (error) throw new Error(error.message);
  return { success: true };
}
