// Shared (client + server safe) types and helpers for Petty Cash.

export const PETTY_CASH_SYSTEM_ID = 'petty-cash';
export const MAX_LINES = 50;        // rows per save
export const MAX_OPEN_LINES = 200;  // rows in one petty cash

/** OPEN: employee still adding rows · SUBMITTED: handed for settlement · SETTLED: admin settled it */
export type PettyCashStatus = 'OPEN' | 'SUBMITTED' | 'SETTLED';

export const STATUS_META: Record<PettyCashStatus, { label: string; badge: string; dot: string }> = {
  OPEN: { label: 'Open', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  SUBMITTED: { label: 'Submitted', badge: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  SETTLED: { label: 'Settled', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

export type PettyCashTabId = 'new' | 'records' | 'analysis'; // analysis: admin only

export interface PettyCashPermissions {
  tabs: PettyCashTabId[];
  viewAll: boolean; // admin: sees every employee's petty cash
}

export interface PettyCashLine {
  ID: number;
  PETTY_CASH_ID: string;
  LINE_NO: number;
  INVOICE_DATE: string;     // yyyy-mm-dd
  DESCRIPTION: string;      // البيان
  BENEFICIARY: string;      // المستفيد
  AMOUNT: number;
  IS_TAX_INVOICE: boolean;  // فاتورة ضريبية
  HAS_INVOICE: boolean;     // معاه فاتورة أصلية
  ACCOUNT?: string | null;  // admin only — never sent to employees
  UPDATED_BY?: string | null;
  UPDATED_AT?: string | null;
}

export interface PettyCash {
  ID: string;               // PC-0001
  LINES_COUNT: number;
  TOTAL_AMOUNT: number;
  TAX_AMOUNT_TOTAL: number;
  NOTES: string | null;
  CREATED_BY: string;       // who recorded it (he sees / edits / submits it)
  CREATED_BY_ID: string;
  EMPLOYEE_NAME: string;    // the employee it is for - any name (old ones = CREATED_BY)
  CREATED_AT: string;
  UPDATED_BY?: string | null;
  UPDATED_AT?: string | null;
  STATUS: PettyCashStatus;
  SUBMITTED_AT?: string | null;
  SETTLED_BY?: string | null;
  SETTLED_AT?: string | null;
  MINE: boolean;            // created by the logged-in user (set by the server)
  LINES: PettyCashLine[];
}

export type PettyCashLineInput = {
  INVOICE_DATE: string;
  DESCRIPTION: string;
  BENEFICIARY: string;
  AMOUNT: number;
  IS_TAX_INVOICE: boolean;
  HAS_INVOICE: boolean;
  ACCOUNT?: string;         // admin edit only
  LINE_ID?: number;         // edit: the saved row this came from (keeps its account)
};

export type PettyCashInput = {
  NOTES?: string;
  EMPLOYEE_NAME?: string;   // admin only: record it for another employee (default: himself)
  LINES: PettyCashLineInput[];
};

export const COMPANY_NAME = 'ALMARAI ALARABIA TRADING';

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatAmount(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
}

/** Today in the UAE as yyyy-mm-dd. */
export function uaeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** CREATED_AT (timestamp) → UAE date yyyy-mm-dd. */
export function uaeDateOf(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts).slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function linesTotal(lines: { AMOUNT: number }[]): number {
  return round2(lines.reduce((s, l) => s + (Number(l.AMOUNT) || 0), 0));
}

export function taxTotal(lines: { AMOUNT: number; IS_TAX_INVOICE: boolean }[]): number {
  return round2(lines.reduce((s, l) => s + (l.IS_TAX_INVOICE ? Number(l.AMOUNT) || 0 : 0), 0));
}

export function missingInvoices(lines: { HAS_INVOICE: boolean }[]): number {
  return lines.filter((l) => !l.HAS_INVOICE).length;
}

/** Rows with an account set / all rows. */
export function accountsSet(lines: { ACCOUNT?: string | null }[]): number {
  return lines.filter((l) => String(l.ACCOUNT || '').trim()).length;
}

/** Display / export order: beneficiary (A→Z), then invoice date (oldest first), then entry order. */
export function compareLines(
  a: { BENEFICIARY: string; INVOICE_DATE: string; LINE_NO?: number },
  b: { BENEFICIARY: string; INVOICE_DATE: string; LINE_NO?: number },
): number {
  return (
    a.BENEFICIARY.trim().localeCompare(b.BENEFICIARY.trim(), undefined, { sensitivity: 'base' }) ||
    (a.INVOICE_DATE < b.INVOICE_DATE ? -1 : a.INVOICE_DATE > b.INVOICE_DATE ? 1 : 0) ||
    (a.LINE_NO ?? 0) - (b.LINE_NO ?? 0)
  );
}
