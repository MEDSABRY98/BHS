'use server';

// Signatories (web_SIGNATORIES): the list everyone picks from when exporting a PDF.
// Read: any logged-in user. Add / edit / delete: the admin or a Data Base editor.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import type { Signatory } from './SignatureTypes';

const TABLE = 'web_SIGNATORIES';

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

/** admin, or Admin Control → Data Base → action Editor / Admin */
async function requireEditor(): Promise<SessionUserRecord> {
  const user = await requireUser();
  if (isAdminUser(user, 'database')) return user;
  try {
    const perms = JSON.parse(String(user.role || '').trim() || '{}');
    const actions = perms?.['database-actions'];
    if (Array.isArray(actions) && (actions.includes('edit') || actions.includes('delete'))) return user;
  } catch {
    // unparsable role: not an editor
  }
  throw new UnauthorizedError("You don't have permission to change the signatories.");
}

const toSignatory = (r: any): Signatory => ({
  ID: String(r.ID),
  NAME: String(r.NAME || ''),
  TITLE: String(r.TITLE || ''),
  IS_ACTIVE: r.IS_ACTIVE !== false,
  SORT_ORDER: Number(r.SORT_ORDER) || 0,
});

/** Every signatory (active and not), in the list order. */
export async function listSignatories(): Promise<Signatory[]> {
  await requireUser();
  const { data, error } = await getSupabaseAdmin().from(TABLE).select('*').order('SORT_ORDER', { ascending: true }).order('TITLE', { ascending: true });
  if (error) {
    if (error.code === '42P01') return []; // table not created yet
    throw new Error(error.message);
  }
  return (data || []).map(toSignatory);
}

export async function saveSignatory(input: { ID?: string; NAME: string; TITLE: string; IS_ACTIVE?: boolean }): Promise<Signatory> {
  await requireEditor();
  const NAME = String(input?.NAME || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const TITLE = String(input?.TITLE || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!TITLE) throw new Error('The position is required');
  const record = { NAME, TITLE, IS_ACTIVE: input?.IS_ACTIVE !== false };
  const db = getSupabaseAdmin();
  if (input?.ID) {
    const { data, error } = await db.from(TABLE).update({ ...record, UPDATED_AT: new Date().toISOString() }).eq('ID', input.ID).select('*').single();
    if (error) throw new Error(error.message);
    return toSignatory(data);
  }
  const { data: last } = await db.from(TABLE).select('SORT_ORDER').order('SORT_ORDER', { ascending: false }).limit(1);
  const SORT_ORDER = (Number(last?.[0]?.SORT_ORDER) || 0) + 1;
  const { data, error } = await db.from(TABLE).insert({ ...record, SORT_ORDER }).select('*').single();
  if (error) throw new Error(error.message);
  return toSignatory(data);
}

export async function deleteSignatory(id: string): Promise<{ success: true }> {
  await requireEditor();
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq('ID', id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Saves the list order (ids from first to last). */
export async function reorderSignatories(ids: string[]): Promise<{ success: true }> {
  await requireEditor();
  const db = getSupabaseAdmin();
  const list = (Array.isArray(ids) ? ids : []).map(String).slice(0, 500);
  for (let i = 0; i < list.length; i++) {
    const { error } = await db.from(TABLE).update({ SORT_ORDER: i + 1 }).eq('ID', list[i]);
    if (error) throw new Error(error.message);
  }
  return { success: true };
}

/** Can the current user change the list (for the Data Base page buttons). */
export async function canEditSignatories(): Promise<boolean> {
  try {
    await requireEditor();
    return true;
  } catch {
    return false;
  }
}
