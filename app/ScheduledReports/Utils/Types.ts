// Scheduled Reports — shared types and lists (browser + server).

export type ReportPeriodId = 'yesterday' | 'today' | 'last-7-days' | 'month-to-date' | 'last-month';

/** One email and what it receives: salespersonId null = every salesperson, otherwise only that salesperson. */
export type Recipient = { email: string; salespersonId: string | null };

export type ScheduledReport = {
  id: number;
  name: string;
  reportType: string;
  recipients: Recipient[];
  emails: string[]; // all the emails (from recipients)
  sendTime: string; // HH:MM, Dubai time
  days: number[]; // 0 = Sunday … 6 = Saturday
  period: ReportPeriodId;
  enabled: boolean;
  lastRunDate: string | null; // Dubai day of the last automatic send
  updatedBy: string | null;
  updatedAt: string | null;
};

export type ScheduledReportInput = Omit<ScheduledReport, 'id' | 'emails' | 'lastRunDate' | 'updatedBy' | 'updatedAt'> & { id?: number };

export type ReportLogStatus = 'sent' | 'failed' | 'skipped';

export type ReportLogRow = {
  id: number;
  reportId: number | null;
  reportName: string;
  reportType: string;
  periodStart: string | null;
  periodEnd: string | null;
  emails: string[];
  scope: string | null; // "All salespersons" or the salesperson's name
  status: ReportLogStatus;
  message: string | null;
  trigger: 'schedule' | 'manual';
  sentBy: string | null;
  createdAt: string;
};

/** Reports that can be scheduled (more will be added here). */
export const REPORT_TYPES: { id: string; label: string; module: string; description: string }[] = [
  {
    id: 'salesperson-daily',
    label: 'Daily Sales Report',
    module: 'Salesperson Analysis',
    description: 'All salespersons: totals, by day, top customers & products, one section per salesperson (PDF).',
  },
  {
    id: 'salesperson-debit-collections',
    label: 'Debit & Collections Report',
    module: 'Salesperson Analysis',
    description: 'Debit aging (as of today) and collections in the period vs last year: summary by salesperson, then one section per salesperson (PDF).',
  },
];

export const REPORT_PERIODS: { id: ReportPeriodId; label: string }[] = [
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'today', label: 'Today (until the send time)' },
  { id: 'last-7-days', label: 'Last 7 days' },
  { id: 'month-to-date', label: 'Month to date' },
  { id: 'last-month', label: 'Last month' },
];

export const WEEK_DAYS: { id: number; short: string; label: string }[] = [
  { id: 0, short: 'Sun', label: 'Sunday' },
  { id: 1, short: 'Mon', label: 'Monday' },
  { id: 2, short: 'Tue', label: 'Tuesday' },
  { id: 3, short: 'Wed', label: 'Wednesday' },
  { id: 4, short: 'Thu', label: 'Thursday' },
  { id: 5, short: 'Fri', label: 'Friday' },
  { id: 6, short: 'Sat', label: 'Saturday' },
];

export const reportTypeLabel = (id: string) => REPORT_TYPES.find((t) => t.id === id)?.label || id;
export const periodLabel = (id: string) => REPORT_PERIODS.find((p) => p.id === id)?.label || id;

export const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "09:00" → "9:00 AM" */
export function formatTime12(hhmm: string): string {
  if (!TIME_RE.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}

export function daysLabel(days: number[]): string {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return 'Every day';
  if (set.length === 6 && !set.includes(5)) return 'Every day except Friday';
  if (set.length === 5 && [0, 1, 2, 3, 4].every((d) => set.includes(d))) return 'Sunday – Thursday';
  return set.map((d) => WEEK_DAYS[d]?.short).filter(Boolean).join(', ') || 'No days';
}
