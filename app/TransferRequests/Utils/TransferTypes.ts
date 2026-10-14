// Shared types and helpers for Transfer Requests (no server-only imports).

export const TRANSFER_SYSTEM_ID = 'transfer-requests';

export type TransferTabId = 'new' | 'requests' | 'beneficiaries';
export type TransferType = 'INTERNAL' | 'AIN_TO_DUBAI' | 'DUBAI_TO_AIN';

export const TRANSFER_TYPES: { value: TransferType; label: string; short: string }[] = [
  { value: 'INTERNAL', label: 'Internal Transfer', short: 'Internal' },
  { value: 'AIN_TO_DUBAI', label: 'Al Ain → Dubai', short: 'Al Ain → Dubai' },
  { value: 'DUBAI_TO_AIN', label: 'Dubai → Al Ain', short: 'Dubai → Al Ain' },
];

export const CURRENCIES: { code: string; name: string; sub: string }[] = [
  { code: 'AED', name: 'UAE Dirhams', sub: 'Fils' },
  { code: 'USD', name: 'US Dollars', sub: 'Cents' },
  { code: 'EUR', name: 'Euros', sub: 'Cents' },
  { code: 'SAR', name: 'Saudi Riyals', sub: 'Halalas' },
];

export interface TransferBank {
  ID: string;
  NAME: string;
  SWIFT_CODE: string | null;
  IS_ACTIVE: boolean;
}

export interface TransferBeneficiary {
  ID: string;
  NAME: string;
  BANK_ID: string | null;
  IBAN: string | null;
  ACCOUNT_NO: string | null;
  NOTES: string | null;
  IS_ACTIVE: boolean;
}

export interface TransferRequest {
  ID: string;
  REQUEST_NO: string;
  REQUEST_DATE: string; // YYYY-MM-DD
  TRANSFER_TYPE: TransferType;
  BANK_ID: string | null; // internal transfers only
  BENEFICIARY_ID: string;
  AMOUNT: number;
  CURRENCY: string;
  REASON: string;
  CREATED_BY: string;
  CREATED_BY_NAME: string | null;
  CREATED_AT: string;
  UPDATED_AT?: string;
}

export interface TransferRequestInput {
  ID?: string;
  TRANSFER_TYPE: TransferType;
  BANK_ID: string | null;
  BENEFICIARY_ID: string;
  AMOUNT: number;
  CURRENCY: string;
  REASON: string;
}

export interface TransferPermissions {
  tabs: TransferTabId[];
  viewAll: boolean; // admin: sees and edits every request
}

export function typeLabel(t: TransferType): string {
  return TRANSFER_TYPES.find((x) => x.value === t)?.label || t;
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function cleanIban(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, '').toUpperCase();
}

/** AE070331234567890123456 → AE07 0331 2345 6789 0123 456 */
export function formatIban(value: string | null | undefined): string {
  return cleanIban(value).replace(/(.{4})/g, '$1 ').trim();
}

export function formatAmount(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
}

export function hasArabic(text: string | null | undefined): boolean {
  return /[؀-ۿ]/.test(String(text || ''));
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Amount in words ─────────────────────────────────────────────
const UNITS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + UNITS[n % 10] : '');
  return UNITS[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + belowThousand(n % 100) : '');
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

/** 1234.5, 'AED' → "One Thousand Two Hundred and Thirty Four UAE Dirhams and Fifty Fils Only" */
export function amountToWords(amount: number, currency = 'AED'): string {
  const value = Math.abs(round2(amount));
  if (!Number.isFinite(value)) return '';
  const cur = CURRENCIES.find((c) => c.code === currency) || { name: currency, sub: 'Cents' };
  const whole = Math.floor(value);
  const cents = Math.round((value - whole) * 100);
  let out = `${integerToWords(whole)} ${cur.name}`;
  if (cents > 0) out += ` and ${integerToWords(cents)} ${cur.sub}`;
  return `${out} Only`;
}
