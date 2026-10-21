// Intercompany Reconciliation form (Al Ain ↔ Dubai): shared types and helpers.
// Nothing is saved in the database: the lines live in the page only.

/** One line read from the Excel file. */
export interface IntercompanyLine {
  ENTRY_DATE: string; // YYYY-MM-DD
  ACCOUNT_NAME: string | null;
  AIN_ENTRY_NUMBER: string | null;
  DUBAI_ENTRY_NUMBER: string | null;
  LABEL: string | null;
  DEBIT: number;
  CREDIT: number;
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function compareEntries(a: IntercompanyLine, b: IntercompanyLine): number {
  if (a.ENTRY_DATE !== b.ENTRY_DATE) return a.ENTRY_DATE < b.ENTRY_DATE ? -1 : 1;
  const na = a.AIN_ENTRY_NUMBER || a.DUBAI_ENTRY_NUMBER || '';
  const nb = b.AIN_ENTRY_NUMBER || b.DUBAI_ENTRY_NUMBER || '';
  return na.localeCompare(nb, undefined, { numeric: true, sensitivity: 'base' });
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : String(iso);
}

export function formatAmount(n: number | null | undefined): string {
  return (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
