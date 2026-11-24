// Intercompany Reconciliation form (Al Ain ↔ Dubai): shared types and helpers.
// Nothing is saved in the database: the lines live in the page only.

/** One line read from the Excel file. */
export interface IntercompanyLine {
  ENTRY_DATE: string; // YYYY-MM-DD
  ACCOUNT_NAME: string | null;
  /** the entry reference (one column; the old Al Ain / Dubai entry numbers were merged into it) */
  REFERENCE: string | null;
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

/** forms saved before the change kept the reference in AIN_ENTRY_NUMBER (Dubai's was never filled): read both shapes; the removed Attachment flag is dropped */
export function normalizeLines(lines: any[] | null | undefined): IntercompanyLine[] {
  return (lines || []).map((l: any) => {
    const { AIN_ENTRY_NUMBER, DUBAI_ENTRY_NUMBER, ATTACHMENT: _attachment, ...rest } = l || {};
    return { ...rest, REFERENCE: l?.REFERENCE ?? AIN_ENTRY_NUMBER ?? DUBAI_ENTRY_NUMBER ?? null } as IntercompanyLine;
  });
}

export function compareEntries(a: IntercompanyLine, b: IntercompanyLine): number {
  if (a.ENTRY_DATE !== b.ENTRY_DATE) return a.ENTRY_DATE < b.ENTRY_DATE ? -1 : 1;
  const na = a.REFERENCE || '';
  const nb = b.REFERENCE || '';
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
