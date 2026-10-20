// Scheduled Reports — Dubai time (UTC+4, no daylight saving) and report periods. Server + browser safe.

import type { ReportPeriodId } from '../Utils/Types';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

export function dubaiNow(at: Date = new Date()) {
  const d = new Date(at.getTime() + 4 * 3600_000);
  return {
    date: iso(d), // YYYY-MM-DD
    weekday: d.getUTCDay(), // 0 = Sunday
    hhmm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return iso(new Date(Date.UTC(y, m - 1, d + n)));
}

/** The dates a report covers when it is sent on `today` (Dubai day). */
export function periodRange(period: ReportPeriodId | string, today: string): { start: string; end: string } {
  const [y, m, d] = today.split('-').map(Number);
  const yesterday = addDays(today, -1);
  const lastMonth = () => {
    const first = iso(new Date(Date.UTC(y, m - 2, 1)));
    const last = iso(new Date(Date.UTC(y, m - 1, 0)));
    return { start: first, end: last };
  };
  switch (period) {
    case 'today':
      return { start: today, end: today };
    case 'last-7-days':
      return { start: addDays(today, -7), end: yesterday };
    case 'month-to-date':
      // on the 1st there is nothing yet this month → the whole last month
      return d === 1 ? lastMonth() : { start: `${y}-${pad(m)}-01`, end: yesterday };
    case 'last-month':
      return lastMonth();
    case 'yesterday':
    default:
      return { start: yesterday, end: yesterday };
  }
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
