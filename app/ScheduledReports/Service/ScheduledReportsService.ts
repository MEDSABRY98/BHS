'use server';

// Scheduled Reports — server actions for the module screen.
// Admins only (or an admin of the module: Admin Control → Module Admins; Edit = add / change, Delete = delete).

import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import {
  EMAIL_RE,
  REPORT_PERIODS,
  REPORT_TYPES,
  TIME_RE,
  type ReportLogRow,
  type ScheduledReport,
  type ScheduledReportInput,
} from '../Utils/Types';
import { LOG_TABLE, REPORTS_TABLE, logFromRow, reportFromRow, runReport } from '../Server/Runner';
import { mailStatus } from '../Server/Mailer';
import { listAllSalespersons } from '@/app/SalespersonAnalysis/Service/DailyReportData';
import { connectZoho, disconnectZoho, getZohoConnection, zohoClientReady, zohoScopes } from '../Server/ZohoMail';

const MODULE_ID = 'scheduled-reports';

async function requireReportsAdmin(action?: 'edit' | 'delete'): Promise<SessionUserRecord> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  if (!isAdminUser(user, MODULE_ID, action)) {
    throw new UnauthorizedError(action ? `You don't have permission to ${action} scheduled reports.` : "You don't have access to Scheduled Reports.");
  }
  return user;
}

export async function getScheduledReportsAccess(): Promise<{ canEdit: boolean; canDelete: boolean }> {
  const user = await requireReportsAdmin();
  return { canEdit: isAdminUser(user, MODULE_ID, 'edit'), canDelete: isAdminUser(user, MODULE_ID, 'delete') };
}

export async function listScheduledReports(): Promise<{
  reports: ScheduledReport[];
  mailReady: boolean;
  mailFrom: string | null;
  cronReady: boolean;
}> {
  await requireReportsAdmin();
  const { data, error } = await getSupabaseAdmin().from(REPORTS_TABLE).select('*').order('NAME', { ascending: true });
  if (error) throw new Error(error.message);
  const mail = await mailStatus();
  return {
    reports: (data || []).map(reportFromRow),
    mailReady: mail.ready,
    mailFrom: mail.from,
    cronReady: !!process.env.CRON_SECRET,
  };
}

function clean(input: ScheduledReportInput) {
  const name = String(input?.name || '').trim();
  if (!name) throw new Error('Enter a name for the report');
  if (name.length > 120) throw new Error('The name is too long');
  if (!REPORT_TYPES.some((t) => t.id === input.reportType)) throw new Error('Pick a report');
  if (!REPORT_PERIODS.some((p) => p.id === input.period)) throw new Error('Pick a period');
  const sendTime = String(input.sendTime || '').trim();
  if (!TIME_RE.test(sendTime)) throw new Error('Pick the send time');
  const days = [...new Set((input.days || []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (!days.length) throw new Error('Pick at least one day');
  const seen = new Set<string>();
  const recipients: { email: string; salespersonId: string | null }[] = [];
  for (const r of input.recipients || []) {
    const email = String(r?.email || '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) throw new Error(`Not a valid email: ${email}`);
    const salespersonId = r?.salespersonId ? String(r.salespersonId).trim() : null;
    const key = `${email}|${salespersonId || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ email, salespersonId });
  }
  if (!recipients.length) throw new Error('Add at least one email');
  if (recipients.length > 100) throw new Error('100 emails at most');
  const emails = [...new Set(recipients.map((r) => r.email))];
  return { NAME: name, REPORT_TYPE: input.reportType, PERIOD: input.period, SEND_TIME: sendTime, DAYS: days, EMAILS: emails, RECIPIENTS: recipients, ENABLED: input.enabled !== false };
}

export async function saveScheduledReport(input: ScheduledReportInput): Promise<ScheduledReport> {
  const user = await requireReportsAdmin('edit');
  const row = clean(input);
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const query = input.id
    ? db.from(REPORTS_TABLE).update({ ...row, UPDATED_BY: user.name, UPDATED_AT: now }).eq('ID', input.id)
    : db.from(REPORTS_TABLE).insert({ ...row, CREATED_BY: user.name, UPDATED_BY: user.name, UPDATED_AT: now });
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  return reportFromRow(data);
}

export async function setScheduledReportEnabled(id: number, enabled: boolean): Promise<ScheduledReport> {
  const user = await requireReportsAdmin('edit');
  const { data, error } = await getSupabaseAdmin()
    .from(REPORTS_TABLE)
    .update({ ENABLED: !!enabled, UPDATED_BY: user.name, UPDATED_AT: new Date().toISOString() })
    .eq('ID', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return reportFromRow(data);
}

export async function deleteScheduledReport(id: number): Promise<void> {
  await requireReportsAdmin('delete');
  const { error } = await getSupabaseAdmin().from(REPORTS_TABLE).delete().eq('ID', id);
  if (error) throw new Error(error.message);
}

/** Send now (to the report's emails, or only to `onlyTo` for a test). Does not change the daily schedule. */
export async function sendScheduledReportNow(id: number, onlyTo?: string): Promise<{ status: string; message: string | null }> {
  const user = await requireReportsAdmin('edit');
  const { data, error } = await getSupabaseAdmin().from(REPORTS_TABLE).select('*').eq('ID', id).single();
  if (error) throw new Error(error.message);
  const report = reportFromRow(data);
  if (onlyTo !== undefined) {
    const to = String(onlyTo).trim().toLowerCase();
    if (!EMAIL_RE.test(to)) throw new Error('Enter a valid email for the test');
    // a test copy of each different scope (all / each salesperson) to this one email
    const scopes = [...new Set(report.recipients.map((r) => r.salespersonId || ''))];
    report.recipients = scopes.map((s) => ({ email: to, salespersonId: s || null }));
    report.emails = [to];
  }
  const out = await runReport(report, { trigger: 'manual', sentBy: user.name });
  return { status: out.status, message: out.message };
}

export async function listScheduledReportLog(limit = 300): Promise<ReportLogRow[]> {
  await requireReportsAdmin();
  const { data, error } = await getSupabaseAdmin()
    .from(LOG_TABLE)
    .select('*')
    .order('CREATED_AT', { ascending: false })
    .limit(Math.min(Math.max(1, Number(limit) || 300), 1000));
  if (error) throw new Error(error.message);
  return (data || []).map(logFromRow);
}

// ── email connection (Zoho Mail API) ──
export type MailSettings = {
  provider: 'zoho' | 'smtp' | null;
  from: string | null;
  zohoClientReady: boolean;
  zohoConnected: boolean;
  zohoConnectedBy: string | null;
  zohoConnectedAt: string | null;
  zohoScopes: string;
  zohoDc: string;
};

export async function getMailSettings(): Promise<MailSettings> {
  await requireReportsAdmin();
  const [status, zoho] = await Promise.all([mailStatus(), getZohoConnection()]);
  return {
    provider: status.provider,
    from: status.from,
    zohoClientReady: zohoClientReady(),
    zohoConnected: !!zoho,
    zohoConnectedBy: zoho?.connectedBy ?? null,
    zohoConnectedAt: zoho?.connectedAt ?? null,
    zohoScopes: zohoScopes(),
    zohoDc: (process.env.ZOHO_DC || 'com').trim() || 'com',
  };
}

export async function connectZohoMail(code: string): Promise<MailSettings> {
  const user = await requireReportsAdmin('edit');
  if (!String(code || '').trim()) throw new Error('Paste the code from Zoho');
  await connectZoho(String(code), user.name);
  return getMailSettings();
}

export async function disconnectZohoMail(): Promise<MailSettings> {
  await requireReportsAdmin('edit');
  await disconnectZoho();
  return getMailSettings();
}

/** Salespersons that can get their own copy of a report (id + name, A-Z). */
export async function listReportSalespersons(): Promise<{ id: string; name: string }[]> {
  await requireReportsAdmin();
  return listAllSalespersons();
}
