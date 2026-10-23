// Scheduled Reports — shared pieces of the report files (server only).

import { listAllSalespersons } from '@/app/SalespersonAnalysis/Service/DailyReportData';
import { dubaiNow } from '../Server/Dubai';

export async function salespersonNames(): Promise<Map<string, string>> {
  const list = await listAllSalespersons();
  return new Map(list.map((s) => [s.id.trim().toUpperCase(), s.name]));
}

/** Email attachment name: "<salesperson>_<send date>_<report>.pdf" (e.g. Ahmed_Ali_2026-10-22_Daily_Sales.pdf). */
export function attachmentName(who: string, report: string): string {
  const safe = (v: string) => v.replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\s+/g, '_');
  return `${safe(who) || 'Salesperson'}_${dubaiNow().date}_${report}.pdf`;
}

/** scope: what this copy covers ("All salespersons" or the salesperson's name) — shown in the log. */
export type BuiltReport =
  | { scope: string; skip: string }
  | {
      scope: string;
      fileName: string;
      pdf: Buffer;
      /** more PDFs after the first one (same email) */
      extraPdfs?: { fileName: string; pdf: Buffer }[];
      subject: string;
      html: string;
      text: string;
    };

/** salespersonId null = every salesperson; otherwise only that salesperson's sales. */
export type Builder = (range: { start: string; end: string }, reportName: string, salespersonId: string | null) => Promise<BuiltReport>;

export const money = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
export const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
export const periodText = (r: { start: string; end: string }) => (r.start === r.end ? fmtDay(r.start) : `${fmtDay(r.start)} – ${fmtDay(r.end)}`);
export const change = (now: number, before: number) => {
  if (!before) return '';
  const pct = ((now - before) / Math.abs(before)) * 100;
  return `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`;
};
