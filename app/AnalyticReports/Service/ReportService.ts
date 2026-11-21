'use server';

// Analytic Reports — tables (RLS on, reachable only through these actions): see Plan/AnalyticReports.sql
//   web_AR_ANALYTIC_TYPES  analytic account → kind (location | hq), region, channel
//   web_AR_REPORTS         uploaded reports (meta)
//   web_AR_REPORT_LINES    GL lines per analytic / month of each report

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { REPORTS_SYSTEM_ID, REPORT_TABS, round2, type AnalyticType, type ReportLine, type ReportMeta, type ReportPermissions, type ReportTabId } from '../Utils/ReportTypes';

const TYPES = 'web_AR_ANALYTIC_TYPES';
const REPORTS = 'web_AR_REPORTS';
const LINES = 'web_AR_REPORT_LINES';

function permissionsOf(user: SessionUserRecord): ReportPermissions {
  if (isAdminUser(user, REPORTS_SYSTEM_ID)) return { tabs: [...REPORT_TABS], admin: true };
  const raw = String(user.role || '').trim();
  if (!raw) return { tabs: [...REPORT_TABS], admin: false };
  let perms: Record<string, unknown>;
  try { perms = JSON.parse(raw); } catch { return { tabs: [...REPORT_TABS], admin: false }; }
  if (Array.isArray(perms.systems) && !perms.systems.includes(REPORTS_SYSTEM_ID)) return { tabs: [], admin: false };
  const list = perms[REPORTS_SYSTEM_ID];
  return { tabs: Array.isArray(list) ? REPORT_TABS.filter((t) => list.includes(t)) : [...REPORT_TABS], admin: false };
}

async function requireTab(...tabs: ReportTabId[]) {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  const perms = permissionsOf(user);
  if (!tabs.some((t) => perms.tabs.includes(t))) throw new UnauthorizedError("You don't have permission for this action.");
  return { user, perms };
}

const clean = (s: unknown, max = 160) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const mapType = (r: any): AnalyticType => ({ id: r.ID, name: r.NAME, kind: r.KIND, region: r.REGION, channel: r.CHANNEL, notes: r.NOTES });
const mapReport = (r: any): ReportMeta => ({ id: r.ID, name: r.NAME, months: r.MONTHS || [], closed: r.CLOSED || [], fileName: r.FILE_NAME, lineCount: r.LINE_COUNT, createdBy: r.CREATED_BY, createdAt: r.CREATED_AT });

export async function getReportPermissions(): Promise<ReportPermissions> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  return permissionsOf(user);
}

// ── Analytic account types ──────────────────────────────────
export async function listAnalyticTypes(): Promise<AnalyticType[]> {
  await requireTab(...REPORT_TABS);
  const { data, error } = await getSupabaseAdmin().from(TYPES).select('*').order('NAME');
  if (error) throw new Error(error.message);
  return (data || []).map(mapType);
}

export async function saveAnalyticType(input: { id?: string; name: string; kind: 'location' | 'hq'; region?: string | null; channel?: string | null; notes?: string | null }): Promise<AnalyticType> {
  await requireTab('accounts');
  const name = clean(input.name);
  if (!name) throw new Error('Name is required');
  if (input.kind !== 'location' && input.kind !== 'hq') throw new Error('Invalid type');
  const kind = input.kind;
  const row = { NAME: name, KIND: kind, REGION: kind === 'location' ? clean(input.region) || null : null, CHANNEL: clean(input.channel) || null, NOTES: clean(input.notes, 500) || null };
  if (kind === 'location' && !row.REGION) throw new Error('A location account needs a region');
  const db = getSupabaseAdmin();
  const q = input.id ? db.from(TYPES).update(row).eq('ID', input.id) : db.from(TYPES).insert(row);
  const { data, error } = await q.select('*').single();
  if (error) throw new Error(error.code === '23505' ? 'This analytic account already exists' : error.message);
  return mapType(data);
}

export async function deleteAnalyticType(id: string): Promise<void> {
  await requireTab('accounts');
  const { error } = await getSupabaseAdmin().from(TYPES).delete().eq('ID', id);
  if (error) throw new Error(error.message);
}

// ── Reports ─────────────────────────────────────────────────
export async function listReports(): Promise<ReportMeta[]> {
  await requireTab(...REPORT_TABS);
  const { data, error } = await getSupabaseAdmin().from(REPORTS).select('*').order('CREATED_AT', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapReport);
}

/** Saves an uploaded report and registers unknown analytic accounts as 'hq' (to be classified in the Accounts tab). */
export async function saveReport(input: { name: string; fileName?: string; months: string[]; closed: string[]; lines: ReportLine[] }): Promise<{ report: ReportMeta; newAccounts: string[] }> {
  const { user } = await requireTab('upload');
  const name = clean(input.name);
  if (!name) throw new Error('Report name is required');
  if (!Array.isArray(input.lines) || !input.lines.length) throw new Error('The report has no lines');
  if (input.lines.length > 50000) throw new Error('Too many lines');
  const db = getSupabaseAdmin();

  const { data: rep, error: e1 } = await db.from(REPORTS).insert({ NAME: name, MONTHS: input.months, CLOSED: input.closed, FILE_NAME: clean(input.fileName) || null, LINE_COUNT: input.lines.length, CREATED_BY: user.name || null }).select('*').single();
  if (e1) throw new Error(e1.message);

  const rows = input.lines.map((l) => ({ REPORT_ID: rep.ID, ANALYTIC: clean(l.analytic), CODE: clean(l.code, 20), GL_NAME: clean(l.glName), MONTH: l.month, AMOUNT: round2(Number(l.amount)) }));
  for (let i = 0; i < rows.length; i += 1000) {
    const { error } = await db.from(LINES).insert(rows.slice(i, i + 1000));
    if (error) { await db.from(REPORTS).delete().eq('ID', rep.ID); throw new Error(error.message); }
  }

  const known = new Set(((await db.from(TYPES).select('NAME')).data || []).map((r: any) => r.NAME));
  const newAccounts = [...new Set(rows.map((r) => r.ANALYTIC))].filter((n) => !known.has(n));
  if (newAccounts.length) await db.from(TYPES).insert(newAccounts.map((n) => ({ NAME: n, KIND: 'hq' })));
  return { report: mapReport(rep), newAccounts };
}

export async function getReportLines(reportId: string): Promise<ReportLine[]> {
  await requireTab('regions', 'hq');
  const db = getSupabaseAdmin();
  const out: ReportLine[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(LINES).select('ANALYTIC,CODE,GL_NAME,MONTH,AMOUNT').eq('REPORT_ID', reportId).order('ID').range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data || []) out.push({ analytic: r.ANALYTIC, code: r.CODE, glName: r.GL_NAME, month: r.MONTH, amount: Number(r.AMOUNT) });
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function setReportClosedMonths(reportId: string, closed: string[]): Promise<void> {
  await requireTab('upload', 'regions');
  const { error } = await getSupabaseAdmin().from(REPORTS).update({ CLOSED: closed }).eq('ID', reportId);
  if (error) throw new Error(error.message);
}

export async function deleteReport(reportId: string): Promise<void> {
  const { perms } = await requireTab('upload');
  if (!perms.admin) throw new UnauthorizedError('Only the admin can delete a report.');
  const { error } = await getSupabaseAdmin().from(REPORTS).delete().eq('ID', reportId);
  if (error) throw new Error(error.message);
}
