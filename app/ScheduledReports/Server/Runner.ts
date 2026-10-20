// Scheduled Reports — runs the reports (server only, no 'use server' on purpose).
// • runDueReports(): called every 5 minutes by Supabase pg_cron → /api/ScheduledReports
// • runReport():     builds one report, emails it, writes the log

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { EMAIL_RE, TIME_RE, type ReportLogRow, type ScheduledReport } from '../Utils/Types';
import { dubaiNow, periodRange, toMinutes } from './Dubai';
import { REPORT_BUILDERS } from './Builders';
import { mailConfigured, sendMail } from './Mailer';

export const REPORTS_TABLE = 'app_SCHEDULED_REPORTS';
export const LOG_TABLE = 'app_SCHEDULED_REPORTS_LOG';

/** A report is still sent up to 3 hours after its time (e.g. if a run was missed); later it waits for the next day. */
const LATE_WINDOW_MIN = 180;
/** Failed automatic sends are retried on the next runs, at most this many times a day. */
const MAX_TRIES_PER_DAY = 3;

export function reportFromRow(r: any): ScheduledReport {
  return {
    id: Number(r.ID),
    name: String(r.NAME || ''),
    reportType: String(r.REPORT_TYPE || ''),
    emails: Array.isArray(r.EMAILS) ? r.EMAILS.map(String) : [],
    sendTime: String(r.SEND_TIME || '09:00'),
    days: Array.isArray(r.DAYS) ? r.DAYS.map(Number) : [],
    period: r.PERIOD || 'yesterday',
    enabled: r.ENABLED !== false,
    lastRunDate: r.LAST_RUN_DATE ? String(r.LAST_RUN_DATE).slice(0, 10) : null,
    updatedBy: r.UPDATED_BY ?? null,
    updatedAt: r.UPDATED_AT ?? null,
  };
}

export function logFromRow(r: any): ReportLogRow {
  return {
    id: Number(r.ID),
    reportId: r.REPORT_ID == null ? null : Number(r.REPORT_ID),
    reportName: String(r.REPORT_NAME || ''),
    reportType: String(r.REPORT_TYPE || ''),
    periodStart: r.PERIOD_START ? String(r.PERIOD_START).slice(0, 10) : null,
    periodEnd: r.PERIOD_END ? String(r.PERIOD_END).slice(0, 10) : null,
    emails: Array.isArray(r.EMAILS) ? r.EMAILS.map(String) : [],
    status: r.STATUS,
    message: r.MESSAGE ?? null,
    trigger: r.TRIGGER === 'manual' ? 'manual' : 'schedule',
    sentBy: r.SENT_BY ?? null,
    createdAt: String(r.CREATED_AT || ''),
  };
}

async function writeLog(entry: {
  report: ScheduledReport;
  range: { start: string; end: string } | null;
  emails: string[];
  status: ReportLogRow['status'];
  message: string | null;
  trigger: 'schedule' | 'manual';
  sentBy: string | null;
}): Promise<ReportLogRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from(LOG_TABLE)
    .insert({
      REPORT_ID: entry.report.id || null,
      REPORT_NAME: entry.report.name,
      REPORT_TYPE: entry.report.reportType,
      PERIOD_START: entry.range?.start ?? null,
      PERIOD_END: entry.range?.end ?? null,
      EMAILS: entry.emails,
      STATUS: entry.status,
      MESSAGE: entry.message ? entry.message.slice(0, 1000) : null,
      TRIGGER: entry.trigger,
      SENT_BY: entry.sentBy,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[ScheduledReports] log failed:', error);
    return null;
  }
  return logFromRow(data);
}

/** Builds one report for the period of `today` (Dubai) and emails it. Never throws. */
export async function runReport(
  report: ScheduledReport,
  opts: { trigger: 'schedule' | 'manual'; sentBy?: string | null; today?: string },
): Promise<{ status: ReportLogRow['status']; message: string | null; log: ReportLogRow | null }> {
  const today = opts.today || dubaiNow().date;
  const range = periodRange(report.period, today);
  const emails = [...new Set(report.emails.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
  const base = { report, range, emails, trigger: opts.trigger, sentBy: opts.sentBy ?? null };

  const finish = async (status: ReportLogRow['status'], message: string | null) => ({
    status,
    message,
    log: await writeLog({ ...base, status, message }),
  });

  const builder = REPORT_BUILDERS[report.reportType];
  if (!builder) return finish('failed', `Unknown report type: ${report.reportType}`);
  if (!emails.length) return finish('failed', 'No email addresses');
  if (!mailConfigured()) return finish('failed', 'Email is not set up yet (SMTP settings in Vercel)');

  try {
    const built = await builder(range, report.name);
    if ('skip' in built) return finish('skipped', built.skip);
    await sendMail({
      to: emails,
      subject: built.subject,
      html: built.html,
      text: built.text,
      attachments: [{ filename: built.fileName, content: built.pdf, contentType: 'application/pdf' }],
    });
    return finish('sent', `${built.fileName} → ${emails.length} recipient${emails.length === 1 ? '' : 's'}`);
  } catch (e: unknown) {
    console.error(`[ScheduledReports] report ${report.id} failed:`, e);
    return finish('failed', e instanceof Error ? e.message : String(e));
  }
}

/** Sends every enabled report whose day and time have come and that was not sent today (Dubai time). */
export async function runDueReports(at: Date = new Date()) {
  const now = dubaiNow(at);
  const db = getSupabaseAdmin();
  const { data, error } = await db.from(REPORTS_TABLE).select('*').eq('ENABLED', true);
  if (error) throw new Error(error.message);

  const result = { now: `${now.date} ${now.hhmm}`, checked: 0, sent: 0, failed: 0, skipped: 0 };
  for (const row of data || []) {
    const report = reportFromRow(row);
    result.checked++;
    if (!TIME_RE.test(report.sendTime) || !report.days.includes(now.weekday)) continue;
    const late = now.minutes - toMinutes(report.sendTime);
    if (late < 0 || late > LATE_WINDOW_MIN) continue;
    if (report.lastRunDate && report.lastRunDate >= now.date) continue;

    // claim it for today in one statement, so two runs at the same time can't both send it
    const { data: claimed, error: claimError } = await db
      .from(REPORTS_TABLE)
      .update({ LAST_RUN_DATE: now.date })
      .eq('ID', report.id)
      .or(`LAST_RUN_DATE.is.null,LAST_RUN_DATE.lt.${now.date}`)
      .select('ID');
    if (claimError || !claimed?.length) continue;

    const out = await runReport(report, { trigger: 'schedule', today: now.date });
    result[out.status]++;

    if (out.status === 'failed') {
      // let the next run try again (a few times a day at most)
      const { count } = await db
        .from(LOG_TABLE)
        .select('ID', { count: 'exact', head: true })
        .eq('REPORT_ID', report.id)
        .eq('STATUS', 'failed')
        .eq('TRIGGER', 'schedule')
        .gte('CREATED_AT', `${now.date}T00:00:00+04:00`);
      if ((count || 0) < MAX_TRIES_PER_DAY) {
        await db.from(REPORTS_TABLE).update({ LAST_RUN_DATE: report.lastRunDate }).eq('ID', report.id);
      }
    }
  }
  return result;
}
