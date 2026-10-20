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
import { mailConfigured, mailFrom } from '../Server/Mailer';

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
  return {
    reports: (data || []).map(reportFromRow),
    mailReady: mailConfigured(),
    mailFrom: mailFrom(),
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
  const emails = [...new Set((input.emails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
  const bad = emails.find((e) => !EMAIL_RE.test(e));
  if (bad) throw new Error(`Not a valid email: ${bad}`);
  if (!emails.length) throw new Error('Add at least one email');
  if (emails.length > 50) throw new Error('50 emails at most');
  return { NAME: name, REPORT_TYPE: input.reportType, PERIOD: input.period, SEND_TIME: sendTime, DAYS: days, EMAILS: emails, ENABLED: input.enabled !== false };
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
