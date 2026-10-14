// Shared (client + server safe) types and helpers for Petty Cash.

export const PETTY_CASH_SYSTEM_ID = 'petty-cash';
export const MAX_LINES = 50;

export type PettyCashTabId = 'new' | 'records';

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
}

export interface PettyCash {
  ID: string;               // PC-0001
  LINES_COUNT: number;
  TOTAL_AMOUNT: number;
  TAX_AMOUNT_TOTAL: number;
  NOTES: string | null;
  CREATED_BY: string;
  CREATED_BY_ID: string;
  CREATED_AT: string;
  LINES: PettyCashLine[];
}

export type PettyCashLineInput = {
  INVOICE_DATE: string;
  DESCRIPTION: string;
  BENEFICIARY: string;
  AMOUNT: number;
  IS_TAX_INVOICE: boolean;
  HAS_INVOICE: boolean;
};

export type PettyCashInput = {
  NOTES?: string;
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
