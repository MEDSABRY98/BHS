// Shared (client + server safe) types and helpers for the Employee Charge form.

export const EMPLOYEE_CHARGE_FORM_ID = 'employee-charge';

export type EmployeeChargeTabId = 'new' | 'records';

export interface EmployeeChargePermissions {
  tabs: EmployeeChargeTabId[];
  admin: boolean; // sees every form, edits and deletes
}

export interface EmployeeCharge {
  ID: string;                 // EC-2026-001
  CHARGE_DATE: string;        // yyyy-mm-dd
  EMPLOYEE_NAME: string;
  EMPLOYEE_NO: string | null;
  AMOUNT: number;
  AMOUNT_IN_WORDS: string;
  DESCRIPTION: string;        // full details, payment method included
  CREATED_BY: string;         // bhs_USERS.ID
  CREATED_BY_NAME?: string;   // looked up on the server
  CREATED_AT: string;
  UPDATED_BY?: string | null;
  UPDATED_AT?: string | null;
}

export type EmployeeChargeInput = {
  ID?: string;                // set = edit (admin)
  CHARGE_DATE: string;
  EMPLOYEE_NAME: string;
  EMPLOYEE_NO?: string;
  AMOUNT: number;
  DESCRIPTION: string;
};

export const COMPANY_NAME = 'ALMARAI ALARABIA TRADING';

export const ACKNOWLEDGEMENT =
  'I, the undersigned employee, acknowledge that the amount stated above is charged to me, and I agree to settle it as described in this form.';

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

export function formatChargeNumber(year: number, num: number): string {
  return `EC-${year}-${String(num).padStart(3, '0')}`;
}

export function parseChargeNumber(id: string): { year: number; num: number } | null {
  const m = String(id || '').match(/^EC-(\d{4})-(\d+)$/);
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
