// Scheduled Reports — runs the reports (server only, no 'use server' on purpose).
// • runDueReports(): called every 5 minutes by Supabase pg_cron → /api/ScheduledReports
// • runReport():     builds one report, emails it, writes the log

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { EMAIL_RE, TIME_RE, type Recipient, type ReportLogRow, type ScheduledReport } from '../Utils/Types';
import { dubaiNow, periodRange, toMinutes } from './Dubai';
import { REPORT_BUILDERS } from './Builders';
import { mailStatus, sendMail } from './Mailer';

export const REPORTS_TABLE = 'app_SCHEDULED_REPORTS';
export const LOG_TABLE = 'app_SCHEDULED_REPORTS_LOG';

/** A report is still sent up to 3 hours after its time (e.g. if a run was missed); later it waits for the next day. */
const LATE_WINDOW_MIN = 180;
/** Failed automatic sends are retried on the next runs, at most this many times a day. */
const MAX_TRIES_PER_DAY = 3;

export function recipientsFromRow(r: any): Recipient[] {
  const list: Recipient[] = Array.isArray(r.RECIPIENTS) && r.RECIPIENTS.length
    ? r.RECIPIENTS.map((x: any) => ({ email: String(x?.email || '').trim().toLowerCase(), salespersonId: x?.salespersonId ? String(x.salespersonId) : null }))
    : (Array.isArray(r.EMAILS) ? r.EMAILS : []).map((e: any) => ({ email: String(e).trim().toLowerCase(), salespersonId: null }));
  return list.filter((x) => x.email);
}

export function reportFromRow(r: any): ScheduledReport {
  const recipients = recipientsFromRow(r);
  return {
    id: Number(r.ID),
    name: String(r.NAME || ''),
    reportType: String(r.REPORT_TYPE || ''),
    recipients,
    emails: [...new Set(recipients.map((x) => x.email))],
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
    scope: r.SCOPE ?? null,
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
  scope: string | null;
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
      SCOPE: entry.scope,
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

/**
 * Builds the report for the period of `today` (Dubai) and emails it. Never throws.
 * The recipients are grouped by what they receive: one email for "all salespersons",
 * and one email per salesperson (with only his own sales). Each group gets its own log row.
 */
export async function runReport(
  report: ScheduledReport,
  opts: { trigger: 'schedule' | 'manual'; sentBy?: string | null; today?: string },
): Promise<{ status: ReportLogRow['status']; message: string | null }> {
  const today = opts.today || dubaiNow().date;
  const range = periodRange(report.period, today);
  const log = (emails: string[], scope: string | null, status: ReportLogRow['status'], message: string | null) =>
    writeLog({ report, range, emails, scope, status, message, trigger: opts.trigger, sentBy: opts.sentBy ?? null });

  // group the emails: key '' = all salespersons, otherwise the salesperson id
  const groups = new Map<string, Set<string>>();
  for (const r of report.recipients) {
    const email = r.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) continue;
    const key = r.salespersonId || '';
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(email);
  }
  const allEmails = [...new Set([...groups.values()].flatMap((s) => [...s]))];

  const builder = REPORT_BUILDERS[report.reportType];
  const fail = async (message: string) => {
    await log(allEmails, null, 'failed', message);
    return { status: 'failed' as const, message };
  };
  if (!builder) return fail(`Unknown report type: ${report.reportType}`);
  if (!groups.size) return fail('No email addresses');
  if (!(await mailStatus()).ready) return fail('Email is not set up yet');

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const notes: string[] = [];
  for (const [key, set] of groups) {
    const emails = [...set];
    let scope: string | null = key ? key : 'All salespersons';
    try {
      const built = await builder(range, report.name, key || null);
      scope = built.scope;
      if ('skip' in built) {
        skipped++;
        notes.push(`${scope}: ${built.skip}`);
        await log(emails, scope, 'skipped', built.skip);
        continue;
      }
      await sendMail({
        to: emails,
        subject: built.subject,
        html: built.html,
        text: built.text,
        attachments: [{ filename: built.fileName, content: built.pdf, contentType: 'application/pdf' }],
      });
      sent++;
      await log(emails, scope, 'sent', `${built.fileName} → ${emails.length} recipient${emails.length === 1 ? '' : 's'}`);
    } catch (e: unknown) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[ScheduledReports] report ${report.id} (${scope}) failed:`, e);
      notes.push(`${scope}: ${message}`);
      await log(emails, scope, 'failed', message);
    }
  }

  // "failed" only when nothing went out (then the automatic run may try again without sending twice)
  const status: ReportLogRow['status'] = sent ? 'sent' : failed ? 'failed' : 'skipped';
  const parts = [sent && `${sent} sent`, skipped && `${skipped} skipped`, failed && `${failed} failed`].filter(Boolean).join(' · ');
  return { status, message: [parts, ...notes].filter(Boolean).join(' — ') || null };
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
