// Shared (client + server safe) types and helpers for Credit Notes.

export const CREDIT_NOTES_SYSTEM_ID = 'credit-notes';
export const MAX_LINES = 15;

export type CreditNotesTabId = 'new' | 'notes';

export interface CreditNotePermissions {
  tabs: CreditNotesTabId[];
  admin: boolean; // sees every user's notes, edits and deletes
}

export interface CreditNoteLine {
  description: string;
  amount: number;
}

export interface CreditNote {
  ID: string;               // CN-2026-001
  NOTE_DATE: string;        // yyyy-mm-dd
  BODY_TEXT: string;
  LINES: CreditNoteLine[];
  TOTAL: number;
  AMOUNT_IN_WORDS: string;
  CREATED_BY: string;       // bhs_USERS.ID
  CREATED_BY_NAME?: string; // looked up on the server
  CREATED_AT: string;
  UPDATED_BY?: string | null;
  UPDATED_AT?: string | null;
}

export type CreditNoteInput = {
  ID?: string;              // set = edit (admin)
  NOTE_DATE: string;
  BODY_TEXT: string;
  LINES: CreditNoteLine[];
};

// ── Fixed parties (Al Marai Al Ain → Al Marai Dubai FMCG) ─────────
// Credit notes go the other way: Al Ain issues, Dubai FMCG is credited.
export const ISSUED_BY = {
  name: 'ALMARAI ALARABIA TRADING - SOLE PROPRIETORSHIP L.L.C',
  branch: 'Al Marai – Al Ain',
  license: 'CN-1130585',
};

export const ISSUED_TO = {
  name: 'ALMARAI ALARABIA TRADING',
  branch: 'Al Marai – Dubai FMCG',
  license: '811080',
};

/** Company name in the PDF header (BHS rule: always this short name). */
export const HEADER_NAME = 'ALMARAI ALARABIA TRADING';

export const DEFAULT_BODY =
  'Please note that we have credited your account with the amount below, as per the attached documents.';

export const SUPPORTING_TEXT = 'Supporting documents attached; they form an integral part of this credit note.';

// ── Helpers ─────────────────────────────────────────────────────────────
export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatAmount(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 2026-10-06 → "6 October 2026" */
export function formatLongDate(iso: string | null | undefined): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso || '');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** 2026-10-06 → "06/10/2026" */
export function formatDate(iso: string | null | undefined): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso || '');
}

export function uaeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function linesTotal(lines: { amount: number }[]): number {
  return round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
}

export function formatNoteNumber(year: number, num: number): string {
  return `CN-${year}-${String(num).padStart(3, '0')}`;
}

export function parseNoteNumber(id: string): { year: number; num: number } | null {
  const m = String(id || '').match(/^CN-(\d{4})-(\d+)$/);
  return m ? { year: Number(m[1]), num: Number(m[2]) } : null;
}

// ── Amount in words: "UAE Dirhams Six Hundred Twenty-Four Thousand Three Hundred Nine and Fifteen Fils Only"
const UNITS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h) parts.push(`${UNITS[h]} Hundred`);
  if (r >= 20) parts.push(TENS[Math.floor(r / 10)] + (r % 10 ? `-${UNITS[r % 10]}` : ''));
  else if (r >= 10) parts.push(TEENS[r - 10]);
  else if (r > 0) parts.push(UNITS[r]);
  return parts.join(' ');
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero';
  const scales: [number, string][] = [
    [1_000_000_000, 'Billion'],
    [1_000_000, 'Million'],
    [1_000, 'Thousand'],
  ];
  const parts: string[] = [];
  let rest = n;
  for (const [value, name] of scales) {
    if (rest >= value) {
      parts.push(`${belowThousand(Math.floor(rest / value))} ${name}`);
      rest %= value;
    }
  }
  if (rest) parts.push(belowThousand(rest));
  return parts.join(' ');
}

export function amountToWords(amount: number): string {
  const value = Math.abs(round2(amount));
  if (!Number.isFinite(value)) return '';
  const whole = Math.floor(value);
  const fils = Math.round((value - whole) * 100);
  return `UAE Dirhams ${integerToWords(whole)}${fils ? ` and ${integerToWords(fils)} Fils` : ''} Only`;
}
