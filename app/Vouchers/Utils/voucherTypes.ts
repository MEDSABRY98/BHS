// Shared (client + server safe) types and helpers for cash vouchers.

export type VoucherType = 'IN' | 'OUT';

export type VoucherLine = {
  ref: string;          // invoice / receipt number
  party?: string;       // customer name (optional)
  amount?: number | null;
};

export type CashVoucher = {
  ID: string;                 // voucher number: RV-0001 / PV-0001 (or legacy CAH-001 / CH-0001)
  TYPE: VoucherType;          // IN = cash received, OUT = cash paid / handed over
  DATE: string;               // yyyy-mm-dd
  PARTY: string;              // IN: received from — OUT: paid to
  VIA: string | null;         // optional: delivered by / sent by
  AMOUNT: number;
  AMOUNT_IN_WORDS: string;
  PAYMENT_METHOD: string;     // Cash / Cheque / Bank Transfer
  REFERENCE: string | null;   // cheque or transfer reference
  DESCRIPTION: string | null;
  LINES: VoucherLine[];       // invoice numbers (+ optional customer / amount)
  CREATED_BY: string | null;
  CREATED_BY_ID: string | null;
  CREATED_AT?: string;
  UPDATED_AT?: string | null;
  LEGACY_SOURCE?: string | null;
};

export type VoucherInput = Omit<CashVoucher, 'ID' | 'CREATED_BY' | 'CREATED_BY_ID' | 'CREATED_AT' | 'UPDATED_AT' | 'LEGACY_SOURCE' | 'AMOUNT_IN_WORDS'> & {
  ID?: string;
};

export const VOUCHER_PREFIX: Record<VoucherType, string> = { IN: 'RV', OUT: 'PV' };

export const VOUCHER_LABELS: Record<VoucherType, { title: string; short: string; party: string; via: string; signLeft: string; signRight: string }> = {
  IN: {
    title: 'RECEIPT VOUCHER',
    short: 'Cash In',
    party: 'Received From',
    via: 'Delivered By',
    signLeft: 'Received By',
    signRight: 'Paid By',
  },
  OUT: {
    title: 'PAYMENT VOUCHER',
    short: 'Cash Out',
    party: 'Paid To',
    via: 'Collected By',
    signLeft: 'Paid By',
    signRight: 'Received By',
  },
};

export const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer'] as const;

export const COMPANY = {
  name: 'Al Marai Al Arabia Trading Sole Proprietorship L.L.C',
  shortName: 'AL MARAI AL ARABIA',
  location: 'Al Ain, United Arab Emirates',
  currency: 'AED',
};

export function formatVoucherNumber(type: VoucherType, num: number): string {
  return `${VOUCHER_PREFIX[type]}-${String(num).padStart(4, '0')}`;
}

export function parseVoucherNumber(type: VoucherType, id: string): number | null {
  const m = String(id || '').trim().toUpperCase().match(new RegExp(`^${VOUCHER_PREFIX[type]}-(\\d+)$`));
  return m ? parseInt(m[1], 10) : null;
}

export function linesTotal(lines: VoucherLine[]): number {
  return round2((lines || []).reduce((sum, l) => sum + (Number(l.amount) || 0), 0));
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function formatAED(n: number | string | null | undefined): string {
  const v = Number(n);
  return `${COMPANY.currency} ${(Number.isFinite(v) ? v : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Split pasted text ("INV-1, INV-2\nINV-3") into clean, unique invoice numbers. */
export function splitInvoiceInput(text: string): string[] {
  return Array.from(
    new Set(
      String(text || '')
        .split(/[\n,;\t]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

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

/** 1234.5 -> "One Thousand Two Hundred and Thirty Four UAE Dirhams and Fifty Fils Only" */
export function amountToWords(amount: number): string {
  const value = Math.abs(round2(amount));
  if (!Number.isFinite(value)) return '';
  const whole = Math.floor(value);
  const fils = Math.round((value - whole) * 100);
  let out = `${integerToWords(whole)} UAE Dirhams`;
  if (fils > 0) out += ` and ${integerToWords(fils)} Fils`;
  return `${out} Only`;
}
