'use server';

// Intercompany Reconciliation (Al Ain ↔ Dubai)
// Tables : web_INTERCOMPANY_ENTRIES, web_INTERCOMPANY_ATTACHMENTS (RLS on, no public access)
// Bucket : intercompany-attachments (private) — files are uploaded by the browser straight to
//          Supabase with a one-time signed upload URL, and opened with short-lived signed URLs.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import {
  INTERCOMPANY_BUCKET,
  INTERCOMPANY_SYSTEM_ID,
  MAX_ATTACHMENT_BYTES,
  cleanText,
  compareEntries,
  fileExtension,
  isValidIsoDate,
  mimeFromName,
  round2,
  type ImportLine,
  type IntercompanyAttachment,
  type IntercompanyEntry,
  type IntercompanyPermissions,
  type IntercompanyTabId,
} from '../Utils/IntercompanyTypes';

const ENTRIES = 'web_INTERCOMPANY_ENTRIES';
const ATTACHMENTS = 'web_INTERCOMPANY_ATTACHMENTS';
const ALL_TABS: IntercompanyTabId[] = ['entries', 'summary'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_SECONDS = 600;
const MAX_IMPORT_CHUNK = 1000;

// ─────────────────────────────────────────────────────────────
//  Permissions (Admin Control → 'intercompany-reconciliation')
//  Tabs   : 'entries', 'summary'
//  Actions: 'intercompany-reconciliation-actions' → 'edit', 'delete'
//  No actions saved for the user yet → can edit, cannot delete.
// ─────────────────────────────────────────────────────────────
function permissionsOf(user: SessionUserRecord): IntercompanyPermissions {
  const full: IntercompanyPermissions = { tabs: [...ALL_TABS], edit: true, delete: true };
  if (isAdminUser(user)) return full;

  const raw = String(user.role || '').trim();
  if (!raw || raw === 'Admin') return full;

  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return full;
  }

  if (Array.isArray(perms.systems) && !perms.systems.includes(INTERCOMPANY_SYSTEM_ID)) {
    return { tabs: [], edit: false, delete: false };
  }

  const tabList = perms[INTERCOMPANY_SYSTEM_ID];
  const tabs = Array.isArray(tabList) ? ALL_TABS.filter((t) => tabList.includes(t)) : [...ALL_TABS];

  const actions = perms[`${INTERCOMPANY_SYSTEM_ID}-actions`];
  if (!Array.isArray(actions)) return { tabs, edit: true, delete: false };
  return { tabs, edit: actions.includes('edit') || actions.includes('delete'), delete: actions.includes('delete') };
}

async function requireUser(): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return user;
}

async function requireAccess(need: 'view' | 'edit' | 'delete'): Promise<SessionUserRecord> {
  const user = await requireUser();
  const p = permissionsOf(user);
  const ok = need === 'view' ? p.tabs.length > 0 : need === 'edit' ? p.edit : p.delete;
  if (!ok) throw new UnauthorizedError("You don't have permission for this action.");
  return user;
}

function requireUuid(id: string, what = 'ID'): string {
  const v = String(id || '').trim();
  if (!UUID_RE.test(v)) throw new Error(`Invalid ${what}`);
  return v;
}

function normalizeEntry(row: any, count = 0): IntercompanyEntry {
  return {
    ID: row.ID,
    ENTRY_DATE: String(row.ENTRY_DATE || '').slice(0, 10),
    ACCOUNT_NAME: row.ACCOUNT_NAME ? String(row.ACCOUNT_NAME) : null,
    AIN_ENTRY_NUMBER: row.AIN_ENTRY_NUMBER ? String(row.AIN_ENTRY_NUMBER) : null,
    DUBAI_ENTRY_NUMBER: row.DUBAI_ENTRY_NUMBER ? String(row.DUBAI_ENTRY_NUMBER) : null,
    LABEL: row.LABEL ?? null,
    DEBIT: Number(row.DEBIT) || 0,
    CREDIT: Number(row.CREDIT) || 0,
    CREATED_AT: row.CREATED_AT,
    UPDATED_AT: row.UPDATED_AT,
    ATTACHMENTS_COUNT: count,
  };
}

async function fetchAll(table: string, columns: string, orderBy: string): Promise<any[]> {
  const db = getSupabaseAdmin();
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await db.from(table).select(columns).order(orderBy, { ascending: true }).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < size) break;
  }
  return out;
}

function cleanImportLine(l: any, index: number): ImportLine {
  const row = index + 1;
  const date = String(l?.ENTRY_DATE || '').slice(0, 10);
  if (!isValidIsoDate(date)) throw new Error(`Line ${row}: invalid date`);
  const ain = cleanText(l?.AIN_ENTRY_NUMBER) || null;
  const dubai = cleanText(l?.DUBAI_ENTRY_NUMBER) || null;
  if (!ain && !dubai) throw new Error(`Line ${row}: enter the Al Ain or the Dubai entry number`);
  const debit = round2(Number(l?.DEBIT) || 0);
  const credit = round2(Number(l?.CREDIT) || 0);
  if (debit < 0 || credit < 0) throw new Error(`Line ${row}: debit and credit can't be negative`);
  return {
    ENTRY_DATE: date,
    ACCOUNT_NAME: cleanText(l?.ACCOUNT_NAME) || null,
    AIN_ENTRY_NUMBER: ain,
    DUBAI_ENTRY_NUMBER: dubai,
    LABEL: cleanText(l?.LABEL) || null,
    DEBIT: debit,
    CREDIT: credit,
  };
}

// ─────────────────────────────────────────────────────────────
//  Entries
// ─────────────────────────────────────────────────────────────
export async function getIntercompanyPermissions(): Promise<IntercompanyPermissions> {
  return permissionsOf(await requireUser());
}

/** All lines sorted by date then entry number, with their attachments count. */
export async function listIntercompanyEntries(): Promise<IntercompanyEntry[]> {
  await requireAccess('view');
  const [rows, files] = await Promise.all([
    fetchAll(ENTRIES, '*', 'ID'),
    fetchAll(ATTACHMENTS, 'ID, ENTRY_ID', 'ID'),
  ]);
  const counts = new Map<string, number>();
  for (const f of files) counts.set(f.ENTRY_ID, (counts.get(f.ENTRY_ID) || 0) + 1);
  return rows.map((r) => normalizeEntry(r, counts.get(r.ID) || 0)).sort(compareEntries);
}

/** New lines from the Excel upload (the browser sends them in chunks). */
export async function insertIntercompanyEntries(lines: ImportLine[]): Promise<number> {
  await requireAccess('edit');
  if (!Array.isArray(lines) || lines.length === 0) return 0;
  if (lines.length > MAX_IMPORT_CHUNK) throw new Error(`Send at most ${MAX_IMPORT_CHUNK} lines at a time`);
  const records = lines.map(cleanImportLine);
  const { error } = await getSupabaseAdmin().from(ENTRIES).insert(records);
  if (error) throw new Error(error.message);
  return records.length;
}

/**
 * Excel upload for lines that already exist: fills the Al Ain number when it is empty,
 * sets / changes the Dubai number and the account name.
 */
export async function updateIntercompanyNumbers(
  updates: { ID: string; AIN_ENTRY_NUMBER?: string | null; DUBAI_ENTRY_NUMBER?: string | null; ACCOUNT_NAME?: string | null }[],
): Promise<number> {
  await requireAccess('edit');
  if (!Array.isArray(updates) || updates.length === 0) return 0;
  if (updates.length > MAX_IMPORT_CHUNK) throw new Error(`Send at most ${MAX_IMPORT_CHUNK} lines at a time`);
  const db = getSupabaseAdmin();

  const jobs = updates
    .map((u) => {
      const patch: Record<string, string> = {};
      const ain = cleanText(u?.AIN_ENTRY_NUMBER);
      const dubai = cleanText(u?.DUBAI_ENTRY_NUMBER);
      if (ain) patch.AIN_ENTRY_NUMBER = ain;
      if (dubai) patch.DUBAI_ENTRY_NUMBER = dubai;
      const account = cleanText(u?.ACCOUNT_NAME);
      if (account) patch.ACCOUNT_NAME = account;
      return { id: requireUuid(u?.ID), patch };
    })
    .filter((j) => Object.keys(j.patch).length > 0);

  let done = 0;
  for (let i = 0; i < jobs.length; i += 25) {
    const results = await Promise.all(jobs.slice(i, i + 25).map((j) => db.from(ENTRIES).update(j.patch).eq('ID', j.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    done += results.length;
  }
  return done;
}

/**
 * Excel re-upload of exported lines (matched by their Line ID): every field of the line is replaced
 * with the file's values. Attachments stay. Lines missing from the file are not touched.
 */
export async function updateIntercompanyEntries(updates: (ImportLine & { ID: string })[]): Promise<number> {
  await requireAccess('edit');
  if (!Array.isArray(updates) || updates.length === 0) return 0;
  if (updates.length > MAX_IMPORT_CHUNK) throw new Error(`Send at most ${MAX_IMPORT_CHUNK} lines at a time`);
  const db = getSupabaseAdmin();

  const jobs = updates.map((u, i) => {
    const line = cleanImportLine(u, i);
    if (line.DEBIT === 0 && line.CREDIT === 0) throw new Error(`Line ${i + 1}: enter a debit or a credit amount`);
    return { id: requireUuid(u?.ID), line };
  });

  let done = 0;
  for (let i = 0; i < jobs.length; i += 25) {
    const results = await Promise.all(jobs.slice(i, i + 25).map((j) => db.from(ENTRIES).update(j.line).eq('ID', j.id)));
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
    done += results.length;
  }
  return done;
}

/** Add one line by hand (from the Add popup). */
export async function createIntercompanyEntry(input: ImportLine): Promise<IntercompanyEntry> {
  await requireAccess('edit');
  let line: ImportLine;
  try {
    line = cleanImportLine(input, 0);
  } catch (err: any) {
    throw new Error(String(err?.message || 'Invalid data').replace(/^Line 1: /, ''));
  }
  if (line.DEBIT === 0 && line.CREDIT === 0) throw new Error('Enter a debit or a credit amount');
  const { data, error } = await getSupabaseAdmin().from(ENTRIES).insert(line).select('*').single();
  if (error) throw new Error(error.message);
  return normalizeEntry(data);
}

/** Edit all the details of one line (from the Edit popup). */
export async function updateIntercompanyEntry(id: string, input: ImportLine): Promise<IntercompanyEntry> {
  await requireAccess('edit');
  const entryId = requireUuid(id);
  let line: ImportLine;
  try {
    line = cleanImportLine(input, 0);
  } catch (err: any) {
    throw new Error(String(err?.message || 'Invalid data').replace(/^Line 1: /, ''));
  }
  if (line.DEBIT === 0 && line.CREDIT === 0) throw new Error('Enter a debit or a credit amount');
  const { data, error } = await getSupabaseAdmin().from(ENTRIES).update(line).eq('ID', entryId).select('*').single();
  if (error) throw new Error(error.message);
  return normalizeEntry(data);
}

/** Bulk delete: several lines, their attachment rows (cascade) and their files. */
export async function deleteIntercompanyEntries(ids: string[]): Promise<number> {
  await requireAccess('delete');
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  if (ids.length > MAX_IMPORT_CHUNK) throw new Error(`Delete at most ${MAX_IMPORT_CHUNK} lines at a time`);
  const entryIds = Array.from(new Set(ids.map((id) => requireUuid(id))));
  const db = getSupabaseAdmin();

  const paths: string[] = [];
  for (let i = 0; i < entryIds.length; i += 200) {
    const { data, error } = await db.from(ATTACHMENTS).select('FILE_PATH').in('ENTRY_ID', entryIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
    paths.push(...(data || []).map((f: any) => f.FILE_PATH).filter(Boolean));
  }

  for (let i = 0; i < entryIds.length; i += 200) {
    const { error } = await db.from(ENTRIES).delete().in('ID', entryIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }

  for (let i = 0; i < paths.length; i += 500) {
    const { error } = await db.storage.from(INTERCOMPANY_BUCKET).remove(paths.slice(i, i + 500));
    if (error) console.error('[Intercompany] could not remove files of deleted lines:', error.message);
  }
  return entryIds.length;
}

/** Deletes a line, its attachment rows (cascade) and their files. */
export async function deleteIntercompanyEntry(id: string): Promise<{ success: true }> {
  await requireAccess('delete');
  const entryId = requireUuid(id);
  const db = getSupabaseAdmin();

  const { data: files, error: filesErr } = await db.from(ATTACHMENTS).select('FILE_PATH').eq('ENTRY_ID', entryId);
  if (filesErr) throw new Error(filesErr.message);

  const { error } = await db.from(ENTRIES).delete().eq('ID', entryId);
  if (error) throw new Error(error.message);

  const paths = (files || []).map((f: any) => f.FILE_PATH).filter(Boolean);
  if (paths.length) {
    const { error: rmErr } = await db.storage.from(INTERCOMPANY_BUCKET).remove(paths);
    if (rmErr) console.error('[Intercompany] could not remove files of deleted line:', rmErr.message);
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
//  Attachments
// ─────────────────────────────────────────────────────────────
export async function listIntercompanyAttachments(entryId: string): Promise<IntercompanyAttachment[]> {
  await requireAccess('view');
  const id = requireUuid(entryId);
  const db = getSupabaseAdmin();
  const { data, error } = await db.from(ATTACHMENTS).select('*').eq('ENTRY_ID', id).order('UPLOADED_AT', { ascending: true });
  if (error) throw new Error(error.message);

  const userIds = Array.from(new Set((data || []).map((r: any) => r.UPLOADED_BY).filter(Boolean)));
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await db.from('bhs_USERS').select('ID, NAME').in('ID', userIds);
    for (const u of users || []) names.set(String(u.ID), String(u.NAME || ''));
  }

  return (data || []).map((r: any) => ({
    ...r,
    FILE_SIZE: r.FILE_SIZE === null ? null : Number(r.FILE_SIZE),
    UPLOADED_BY_NAME: r.UPLOADED_BY ? names.get(String(r.UPLOADED_BY)) || null : null,
  }));
}

function safeStorageName(name: string): string {
  const ext = fileExtension(name);
  const base = String(name || '')
    .replace(/\.[^.]+$/, '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'file'}${ext ? `.${ext}` : ''}`;
}

/**
 * Step 1 of an upload: checks the file and returns a one-time signed upload URL.
 * The browser then uploads the file straight to Supabase (no size limit from the website server).
 */
export async function createIntercompanyUpload(
  entryId: string,
  file: { name: string; size: number; type?: string | null },
): Promise<{ path: string; token: string; mime: string }> {
  await requireAccess('edit');
  const id = requireUuid(entryId);
  const name = cleanText(file?.name);
  const size = Number(file?.size) || 0;
  const mime = mimeFromName(name, file?.type);
  if (!name) throw new Error('File name is missing');
  if (!mime) throw new Error('Only PDF, images (JPG / PNG / WEBP), Excel and Word files are allowed');
  if (size <= 0) throw new Error('The file is empty');
  if (size > MAX_ATTACHMENT_BYTES) throw new Error('The file is larger than 20 MB');

  const db = getSupabaseAdmin();
  const { data: entry, error } = await db.from(ENTRIES).select('ENTRY_DATE').eq('ID', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!entry) throw new Error('This line no longer exists');

  // year / month of the entry date / line ID / unique file name
  const [year, month] = String(entry.ENTRY_DATE).slice(0, 7).split('-');
  const path = `${year}/${month}/${id}/${Date.now()}-${safeStorageName(name)}`;

  const { data, error: signErr } = await db.storage.from(INTERCOMPANY_BUCKET).createSignedUploadUrl(path);
  if (signErr || !data) throw new Error(signErr?.message || 'Could not prepare the upload');
  return { path: data.path, token: data.token, mime };
}

/** Step 2 of an upload: after the browser finished uploading, save the attachment row. */
export async function saveIntercompanyAttachment(
  entryId: string,
  file: { path: string; name: string; size: number; mime: string },
): Promise<IntercompanyAttachment> {
  const user = await requireAccess('edit');
  const id = requireUuid(entryId);
  const path = String(file?.path || '');
  if (!new RegExp(`^\\d{4}/\\d{2}/${id}/[^/]+$`, 'i').test(path)) throw new Error('Invalid file path');

  const db = getSupabaseAdmin();
  const folder = path.slice(0, path.lastIndexOf('/'));
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  const { data: found, error: listErr } = await db.storage.from(INTERCOMPANY_BUCKET).list(folder, { search: fileName });
  if (listErr) throw new Error(listErr.message);
  if (!(found || []).some((f: any) => f.name === fileName)) throw new Error('The file was not uploaded, please try again');

  const { data, error } = await db
    .from(ATTACHMENTS)
    .insert({
      ENTRY_ID: id,
      FILE_PATH: path,
      FILE_NAME: cleanText(file?.name) || fileName,
      FILE_SIZE: Number(file?.size) || null,
      MIME_TYPE: mimeFromName(file?.name, file?.mime),
      UPLOADED_BY: user.id,
    })
    .select('*')
    .single();
  if (error) {
    await db.storage.from(INTERCOMPANY_BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return { ...data, FILE_SIZE: data.FILE_SIZE === null ? null : Number(data.FILE_SIZE), UPLOADED_BY_NAME: user.name };
}

/** Short-lived link to open (preview) or download an attachment. */
export async function getIntercompanyAttachmentUrl(attachmentId: string, mode: 'preview' | 'download'): Promise<string> {
  await requireAccess('view');
  const id = requireUuid(attachmentId, 'attachment');
  const db = getSupabaseAdmin();
  const { data: row, error } = await db.from(ATTACHMENTS).select('FILE_PATH, FILE_NAME').eq('ID', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error('Attachment not found');

  const { data, error: signErr } = await db.storage
    .from(INTERCOMPANY_BUCKET)
    .createSignedUrl(row.FILE_PATH, SIGNED_URL_SECONDS, mode === 'download' ? { download: row.FILE_NAME || true } : undefined);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message || 'Could not open the file');
  return data.signedUrl;
}

export async function deleteIntercompanyAttachment(attachmentId: string): Promise<{ success: true }> {
  await requireAccess('delete');
  const id = requireUuid(attachmentId, 'attachment');
  const db = getSupabaseAdmin();
  const { data: row, error } = await db.from(ATTACHMENTS).select('FILE_PATH').eq('ID', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { success: true };

  const { error: rmErr } = await db.storage.from(INTERCOMPANY_BUCKET).remove([row.FILE_PATH]);
  if (rmErr) throw new Error(rmErr.message);
  const { error: delErr } = await db.from(ATTACHMENTS).delete().eq('ID', id);
  if (delErr) throw new Error(delErr.message);
  return { success: true };
}
