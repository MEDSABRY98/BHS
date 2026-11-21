export const REPORTS_SYSTEM_ID = 'analytic-reports';
export type ReportTabId = 'upload' | 'regions' | 'hq' | 'accounts';
export const REPORT_TABS: ReportTabId[] = ['upload', 'regions', 'hq', 'accounts'];
export type AccountKind = 'location' | 'hq';

export interface ReportPermissions { tabs: ReportTabId[]; admin: boolean }
export interface AnalyticType { id: string; name: string; kind: AccountKind; region: string | null; channel: string | null; notes: string | null }
/** One GL line of one analytic account in one month. Income positive, expenses negative (as in Odoo). */
export interface ReportLine { analytic: string; code: string; glName: string; month: string; amount: number }
export interface ReportMeta { id: string; name: string; months: string[]; closed: string[]; fileName: string | null; lineCount: number; createdBy: string | null; createdAt: string }

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const fmt = (n: number) => (Math.abs(n) < 0.5 ? '0' : Math.round(n).toLocaleString('en-US'));
export const pct = (n: number | null) => (n === null || !isFinite(n) ? '—' : `${(n * 100).toFixed(1)}%`);
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const monthLabel = (m: string) => `${MN[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`;
