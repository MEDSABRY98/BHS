// Shared helpers for every form (company name, amounts, dates, amount in words).

export const COMPANY_NAME = 'ALMARAI ALARABIA TRADING';

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
