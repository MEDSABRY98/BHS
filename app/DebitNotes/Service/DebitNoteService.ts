'use server';

// Debit Notes (Al Marai Trading → Al Marai Sole Proprietorship)
// Table: web_DEBIT_NOTES (RLS on, no public access) — only reachable through these actions.
// Each user sees only his own notes; the admin sees all, and only the admin edits / deletes.
// Numbering is shared by all users: DN-<year>-001, 002 … (restarts every year).

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import {
  DEBIT_NOTES_SYSTEM_ID,
  MAX_LINES,
  amountToWords,
  cleanSigners,
  formatNoteNumber,
  linesTotal,
  parseNoteNumber,
  round2,
  type DebitNote,
  type DebitNoteInput,
  type DebitNoteLine,
  type DebitNotePermissions,
  type DebitNotesTabId,
} from '../Utils/DebitNoteTypes';

const TABLE = 'web_DEBIT_NOTES';
const ALL_TABS: DebitNotesTabId[] = ['new', 'notes'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─────────────────────────────────────────────────────────────
//  Permissions (Admin Control → 'debit-notes', tabs: new / notes)
// ─────────────────────────────────────────────────────────────
function permissionsOf(user: SessionUserRecord): DebitNotePermissions {
  if (isAdminUser(user)) return { tabs: [...ALL_TABS], admin: true };

  const raw = String(user.role || '').trim();
  if (!raw) return { tabs: [...ALL_TABS], admin: false };

  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return { tabs: [...ALL_TABS], admin: false };
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(DEBIT_NOTES_SYSTEM_ID)) return { tabs: [], admin: false };
  const list = perms[DEBIT_NOTES_SYSTEM_ID];
  const tabs = Array.isArray(list) ? ALL_TABS.filter((t) => list.includes(t)) : [...ALL_TABS];
  return { tabs, admin: false };
}

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

async function requireTab(tab: DebitNotesTabId) {
  const user = await requireUser();
  const perms = permissionsOf(user);
  if (!perms.tabs.includes(tab)) throw new UnauthorizedError("You don't have permission for this action.");
  return { user, perms };
}

function normalize(row: any, names: Map<string, string>): DebitNote {
  return {
    ...row,
    TOTAL: Number(row.TOTAL) || 0,
    LINES: (Array.isArray(row.LINES) ? row.LINES : []).map((l: any) => ({
      description: String(l?.description ?? l?.title ?? ''), // older notes used "title"
      amount: Number(l?.amount) || 0,
    })),
    CREATED_BY_NAME: names.get(String(row.CREATED_BY)) || '',
    EXTRA_SIGNERS: cleanSigners(row.EXTRA_SIGNERS),
  };
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return new Map();
  const { data } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME').in('ID', uniq);
  return new Map((data || []).map((u: any) => [String(u.ID), String(u.NAME || '')]));
}

function cleanInput(input: DebitNoteInput): { NOTE_DATE: string; BODY_TEXT: string; LINES: DebitNoteLine[]; EXTRA_SIGNERS: string[] } {
  const date = String(input?.NOTE_DATE || '').trim();
  if (!DATE_RE.test(date)) throw new Error('Date is required');
  const body = String(input?.BODY_TEXT || '').trim().slice(0, 1500);
  if (!body) throw new Error('The debit note text is required');

  const raw = Array.isArray(input?.LINES) ? input.LINES : [];
  const lines: DebitNoteLine[] = raw
    .map((l: any) => ({
      description: String(l?.description || '').trim().slice(0, 500),
      amount: round2(Number(String(l?.amount ?? '').replace(/,/g, ''))),
    }))
    .filter((l) => l.description || l.amount);
  if (!lines.length) throw new Error('Add at least one line');
  if (lines.length > MAX_LINES) throw new Error(`Maximum ${MAX_LINES} lines per debit note`);
  lines.forEach((l, i) => {
    if (!l.description) throw new Error(`Line ${i + 1}: description is required`);
    if (!(l.amount > 0)) throw new Error(`Line ${i + 1}: amount must be greater than zero`);
  });
  return { NOTE_DATE: date, BODY_TEXT: body, LINES: lines, EXTRA_SIGNERS: cleanSigners(input?.EXTRA_SIGNERS) };
}

async function maxNumber(year: number): Promise<number> {
  const { data, error } = await getSupabaseAdmin().from(TABLE).select('ID').like('ID', `DN-${year}-%`);
  if (error) throw new Error(error.message);
  return (data || []).reduce((max: number, r: any) => Math.max(max, parseNoteNumber(r.ID)?.num || 0), 0);
}

// ─────────────────────────────────────────────────────────────
//  Actions
// ─────────────────────────────────────────────────────────────
export async function getDebitNotePermissions(): Promise<DebitNotePermissions> {
  return permissionsOf(await requireUser());
}

/** Next number for the year of the given date (shown on the form before saving). */
export async function getNextDebitNoteNumber(date: string): Promise<string> {
  await requireTab('new');
  const year = Number(String(date || '').slice(0, 4)) || new Date().getFullYear();
  return formatNoteNumber(year, (await maxNumber(year)) + 1);
}

/** User: his own notes. Admin: all. Newest first. */
export async function listDebitNotes(): Promise<DebitNote[]> {
  const { user, perms } = await requireTab('notes');
  const db = getSupabaseAdmin();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from(TABLE).select('*');
    if (!perms.admin) q = q.eq('CREATED_BY', String(user.id));
    const { data, error } = await q.order('NOTE_DATE', { ascending: false }).order('ID', { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const names = await userNames(rows.map((r) => String(r.CREATED_BY)));
  return rows.map((r) => normalize(r, names));
}

export async function saveDebitNote(input: DebitNoteInput): Promise<DebitNote> {
  const db = getSupabaseAdmin();
  const clean = cleanInput(input);
  const total = linesTotal(clean.LINES);
  const record = { ...clean, TOTAL: total, AMOUNT_IN_WORDS: amountToWords(total) };

  // Edit (admin only). The number stays the same.
  if (input?.ID) {
    const user = await requireUser();
    if (!isAdminUser(user)) throw new UnauthorizedError('Only the admin can edit a saved debit note.');
    const { data, error } = await db
      .from(TABLE)
      .update({ ...record, UPDATED_BY: String(user.id), UPDATED_AT: new Date().toISOString() })
      .eq('ID', String(input.ID))
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return normalize(data, await userNames([String(data.CREATED_BY)]));
  }

  // New: shared numbering per year; retry if someone saved the same number meanwhile
  const { user } = await requireTab('new');
  const year = Number(clean.NOTE_DATE.slice(0, 4));
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = formatNoteNumber(year, (await maxNumber(year)) + 1);
    const { data, error } = await db
      .from(TABLE)
      .insert({ ID: id, ...record, CREATED_BY: String(user.id) })
      .select('*')
      .single();
    if (!error) return normalize(data, new Map([[String(user.id), String(user.name || '')]]));
    if (error.code !== '23505') throw new Error(error.message);
  }
  throw new Error('Could not reserve a debit note number, please try again');
}

export async function deleteDebitNote(id: string): Promise<{ success: true }> {
  const user = await requireUser();
  if (!isAdminUser(user)) throw new UnauthorizedError('Only the admin can delete a debit note.');
  const { error } = await getSupabaseAdmin().from(TABLE).delete().eq('ID', String(id || ''));
  if (error) throw new Error(error.message);
  return { success: true };
}
