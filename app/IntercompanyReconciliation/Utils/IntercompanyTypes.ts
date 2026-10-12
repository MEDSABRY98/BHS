// Shared types and helpers for Intercompany Reconciliation (Al Ain ↔ Dubai).
// No server-only imports here: used by both the server actions and the browser.

export const INTERCOMPANY_SYSTEM_ID = 'intercompany-reconciliation';
export const INTERCOMPANY_BUCKET = 'intercompany-attachments';
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB (same as the bucket limit)

export type IntercompanyTabId = 'entries' | 'summary';

export interface IntercompanyEntry {
  ID: string;
  ENTRY_DATE: string; // YYYY-MM-DD
  AIN_ENTRY_NUMBER: string | null;
  DUBAI_ENTRY_NUMBER: string | null;
  LABEL: string | null;
  DEBIT: number;
  CREDIT: number;
  CREATED_AT?: string;
  UPDATED_AT?: string;
  ATTACHMENTS_COUNT: number;
}

export interface IntercompanyAttachment {
  ID: string;
  ENTRY_ID: string;
  FILE_PATH: string;
  FILE_NAME: string;
  FILE_SIZE: number | null;
  MIME_TYPE: string | null;
  UPLOADED_BY: string | null;
  UPLOADED_BY_NAME?: string | null;
  UPLOADED_AT: string;
}

export interface IntercompanyPermissions {
  tabs: IntercompanyTabId[];
  edit: boolean; // Excel upload, Dubai entry number, add attachments
  delete: boolean; // delete lines and attachments
}

/** A line read from the Excel file (already cleaned). */
export interface ImportLine {
  ENTRY_DATE: string;
  AIN_ENTRY_NUMBER: string | null;
  DUBAI_ENTRY_NUMBER: string | null;
  LABEL: string | null;
  DEBIT: number;
  CREDIT: number;
}

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

export const ATTACHMENT_ACCEPT = Object.keys(ALLOWED_MIME_TYPES).map((e) => `.${e}`).join(',');

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ''));
  return m ? m[1].toLowerCase() : '';
}

/** MIME type from the extension (browsers sometimes send an empty type). */
export function mimeFromName(name: string, given?: string | null): string | null {
  const byExt = ALLOWED_MIME_TYPES[fileExtension(name)];
  if (byExt) return byExt;
  const g = String(given || '').trim();
  return Object.values(ALLOWED_MIME_TYPES).includes(g) ? g : null;
}

export function previewKind(mime: string | null | undefined): 'pdf' | 'image' | null {
  if (mime === 'application/pdf') return 'pdf';
  if (mime && mime.startsWith('image/')) return 'image';
  return null;
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function cleanText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/** Date + label + debit + credit (the entry numbers are matched separately). */
export function baseKey(l: Pick<ImportLine, 'ENTRY_DATE' | 'LABEL' | 'DEBIT' | 'CREDIT'>): string {
  return [
    l.ENTRY_DATE,
    cleanText(l.LABEL).toUpperCase(),
    round2(l.DEBIT).toFixed(2),
    round2(l.CREDIT).toFixed(2),
  ].join('|');
}

export function sameNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  return cleanText(a).toUpperCase() === cleanText(b).toUpperCase();
}

type Sortable = Pick<IntercompanyEntry, 'ENTRY_DATE' | 'AIN_ENTRY_NUMBER' | 'DUBAI_ENTRY_NUMBER'>;

/** Date then entry number — Al Ain, or Dubai when there is no Al Ain number (natural order: /9 before /10). */
export function compareEntries(a: Sortable, b: Sortable): number {
  if (a.ENTRY_DATE !== b.ENTRY_DATE) return a.ENTRY_DATE < b.ENTRY_DATE ? -1 : 1;
  const na = a.AIN_ENTRY_NUMBER || a.DUBAI_ENTRY_NUMBER || '';
  const nb = b.AIN_ENTRY_NUMBER || b.DUBAI_ENTRY_NUMBER || '';
  return na.localeCompare(nb, undefined, { numeric: true, sensitivity: 'base' });
}

/** "MISC/2026/10 · Dubai JV/55" — whichever numbers the line has. */
export function entryRef(e: Pick<IntercompanyEntry, 'AIN_ENTRY_NUMBER' | 'DUBAI_ENTRY_NUMBER'>): string {
  return [e.AIN_ENTRY_NUMBER ? `Al Ain ${e.AIN_ENTRY_NUMBER}` : '', e.DUBAI_ENTRY_NUMBER ? `Dubai ${e.DUBAI_ENTRY_NUMBER}` : '']
    .filter(Boolean)
    .join(' · ');
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

export function formatBytes(bytes: number | null | undefined): string {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasArabic(text: string | null | undefined): boolean {
  return /[؀-ۿ]/.test(String(text || ''));
}
