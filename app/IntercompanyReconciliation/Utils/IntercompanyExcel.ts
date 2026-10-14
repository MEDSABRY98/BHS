'use client';

// Excel template / export / upload parsing for Intercompany Reconciliation (browser only).

import ExcelJS from 'exceljs';
import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import {
  cleanText,
  compareEntries,
  isValidIsoDate,
  baseKey,
  sameNumber,
  round2,
  type ImportLine,
  type IntercompanyEntry,
} from './IntercompanyTypes';

export const TEMPLATE_HEADERS = ['Date', 'Account Name', 'Al Ain Entry No', 'Dubai Entry No', 'Label', 'Debit', 'Credit'] as const;

// Same look as the other BHS Excel exports (app/Components/Export/ExcelExport.ts)
const HEADER_FILL = 'FF000000';
const HEADER_TEXT = 'FFFFFFFF';
const GOLD_BORDER = 'FFC9A84C';
const LIGHT_ROW_BORDER = 'FFEEEEEE';
const NUM_FMT = '#,##0.00;-#,##0.00;"-"';

// Header names accepted when reading (the template's and Odoo's own export names)
const HEADER_ALIASES: Record<keyof ImportLine, string[]> = {
  ENTRY_DATE: ['date', 'entrydate', 'accountingdate'],
  ACCOUNT_NAME: ['accountname', 'account', 'accounttitle'],
  AIN_ENTRY_NUMBER: ['alainentryno', 'alainentrynumber', 'alainentry', 'ainentryno', 'ainentrynumber', 'entryno', 'entrynumber', 'number', 'journalentry', 'journalentrynumber'],
  DUBAI_ENTRY_NUMBER: ['dubaientryno', 'dubaientrynumber', 'dubaientry', 'dubaino'],
  LABEL: ['label', 'description', 'memo', 'narration'],
  DEBIT: ['debit'],
  CREDIT: ['credit'],
};

function headerKey(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─────────────────────────────────────────────────────────────
//  Download: template (empty) or current data in the same layout
// ─────────────────────────────────────────────────────────────
export async function downloadIntercompanyExcel(entries: IntercompanyEntry[] = [], fileName = 'Intercompany_Template.xlsx') {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'BHS Analysis';
  const ws = wb.addWorksheet('Entries', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });

  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Account Name', key: 'account', width: 30 },
    { header: 'Al Ain Entry No', key: 'ain', width: 22 },
    { header: 'Dubai Entry No', key: 'dubai', width: 22 },
    { header: 'Label', key: 'label', width: 55 },
    { header: 'Debit', key: 'debit', width: 16 },
    { header: 'Credit', key: 'credit', width: 16 },
  ];

  const header = ws.getRow(1);
  header.height = 25;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD_BORDER } } };
  });

  const sorted = [...entries].sort(compareEntries);
  for (const e of sorted) {
    const [y, m, d] = e.ENTRY_DATE.split('-').map(Number);
    ws.addRow({
      date: new Date(Date.UTC(y, m - 1, d)),
      account: e.ACCOUNT_NAME || '',
      ain: e.AIN_ENTRY_NUMBER || '',
      dubai: e.DUBAI_ENTRY_NUMBER || '',
      label: e.LABEL || '',
      debit: e.DEBIT || 0,
      credit: e.CREDIT || 0,
    });
  }

  // Formats for the filled rows plus some empty rows ready for typing
  const lastRow = Math.max(sorted.length + 1, 200);
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    const filled = r <= sorted.length + 1;
    if (filled) row.height = 25;
    for (let c = 1; c <= 7; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      if (filled) cell.border = { bottom: { style: 'thin', color: { argb: LIGHT_ROW_BORDER } } };
    }
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(6).numFmt = NUM_FMT;
    row.getCell(7).numFmt = NUM_FMT;
  }
  ws.autoFilter = { from: 'A1', to: 'G1' };

  const buffer = await wb.xlsx.writeBuffer();
  saveTrackedAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}

// ─────────────────────────────────────────────────────────────
//  Upload: read the file
// ─────────────────────────────────────────────────────────────
function cellPlain(value: any): any {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return cellPlain(value.result); // formula
    if (Array.isArray(value.richText)) return value.richText.map((p: any) => p.text).join('');
    if ('text' in value) return value.text; // hyperlink
    if ('error' in value) return null;
  }
  return value;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function toIsoDate(raw: any): string | null {
  const v = cellPlain(raw);
  if (v === null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  if (typeof v === 'number') {
    // Excel serial date
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = cleanText(v);
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) {
    const iso = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s); // dd/mm/yyyy
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${year}-${pad(+m[2])}-${pad(+m[1])}`;
    return isValidIsoDate(iso) ? iso : null;
  }
  return null;
}

function toAmount(raw: any): number | null {
  const v = cellPlain(raw);
  if (v === null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : null;
  const s = cleanText(v).replace(/,/g, '');
  if (!s || s === '-') return 0;
  const neg = /^\(.*\)$/.test(s);
  const n = Number(s.replace(/[()]/g, ''));
  if (!Number.isFinite(n)) return null;
  return round2(neg ? -n : n);
}

function toText(raw: any): string {
  const v = cellPlain(raw);
  if (v instanceof Date) return toIsoDate(v) || '';
  return cleanText(v);
}

export interface ParsedExcel {
  lines: (ImportLine & { ROW: number })[];
  errors: { row: number; message: string }[];
  sheetName: string;
}

export async function readIntercompanyExcel(file: File): Promise<ParsedExcel> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  // First sheet that has a header row with at least Date, entry number, Debit and Credit
  for (const ws of wb.worksheets) {
    let headerRow = 0;
    let cols: Partial<Record<keyof ImportLine, number>> = {};

    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !headerRow; r++) {
      const found: Partial<Record<keyof ImportLine, number>> = {};
      ws.getRow(r).eachCell((cell, col) => {
        const key = headerKey(cellPlain(cell.value));
        (Object.keys(HEADER_ALIASES) as (keyof ImportLine)[]).forEach((field) => {
          if (found[field] === undefined && HEADER_ALIASES[field].includes(key)) found[field] = col;
        });
      });
      if (found.ENTRY_DATE && (found.AIN_ENTRY_NUMBER || found.DUBAI_ENTRY_NUMBER) && found.DEBIT && found.CREDIT) {
        headerRow = r;
        cols = found;
      }
    }
    if (!headerRow) continue;

    const lines: ParsedExcel['lines'] = [];
    const errors: ParsedExcel['errors'] = [];
    const get = (row: ExcelJS.Row, field: keyof ImportLine) => (cols[field] ? row.getCell(cols[field]!).value : null);

    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rawDate = get(row, 'ENTRY_DATE');
      const ain = toText(get(row, 'AIN_ENTRY_NUMBER'));
      const dubai = toText(get(row, 'DUBAI_ENTRY_NUMBER'));
      const label = toText(get(row, 'LABEL'));
      const account = toText(get(row, 'ACCOUNT_NAME'));
      const date = toIsoDate(rawDate);
      const debit = toAmount(get(row, 'DEBIT'));
      const credit = toAmount(get(row, 'CREDIT'));

      // Empty rows and total rows (no date and no entry number) are skipped
      if (!toText(rawDate) && !ain && !dubai) continue;

      if (!date) { errors.push({ row: r, message: 'Invalid or missing date' }); continue; }
      if (!ain && !dubai) { errors.push({ row: r, message: 'Missing entry number (Al Ain or Dubai)' }); continue; }
      if (debit === null || credit === null) { errors.push({ row: r, message: 'Debit / Credit is not a number' }); continue; }
      if (debit < 0 || credit < 0) { errors.push({ row: r, message: 'Negative debit / credit' }); continue; }
      if (debit === 0 && credit === 0) { errors.push({ row: r, message: 'Debit and credit are both zero' }); continue; }

      lines.push({
        ROW: r,
        ENTRY_DATE: date,
        ACCOUNT_NAME: account || null,
        AIN_ENTRY_NUMBER: ain || null,
        DUBAI_ENTRY_NUMBER: dubai || null,
        LABEL: label || null,
        DEBIT: debit,
        CREDIT: credit,
      });
    }
    return { lines, errors, sheetName: ws.name };
  }

  throw new Error('No sheet with the columns Date, Al Ain / Dubai Entry No, Debit and Credit was found');
}

// ─────────────────────────────────────────────────────────────
//  Upload plan: match the file against the saved lines
//  Same line = same date, label, debit and credit AND
//    • same Al Ain no  → the Dubai no is set / changed if the file has a different one
//    • or same Dubai no (and the saved line has no other Al Ain no) → the Al Ain no is filled
//  The account name from the file is saved on the matched line when it is different.
//  Identical lines repeated N times are matched one by one.
//  Anything else → new line. Nothing is ever deleted.
// ─────────────────────────────────────────────────────────────
export interface ImportPlan {
  inserts: ImportLine[];
  updates: { ID: string; AIN_ENTRY_NUMBER?: string; DUBAI_ENTRY_NUMBER?: string; ACCOUNT_NAME?: string; ROW: number }[];
  unchanged: number;
}

export function planIntercompanyImport(lines: ParsedExcel['lines'], existing: IntercompanyEntry[]): ImportPlan {
  const pool = new Map<string, IntercompanyEntry[]>();
  for (const e of [...existing].sort(compareEntries)) {
    const k = baseKey(e);
    pool.set(k, [...(pool.get(k) || []), e]);
  }

  const plan: ImportPlan = { inserts: [], updates: [], unchanged: 0 };
  for (const l of lines) {
    const ain = cleanText(l.AIN_ENTRY_NUMBER);
    const dubai = cleanText(l.DUBAI_ENTRY_NUMBER);
    const account = cleanText(l.ACCOUNT_NAME);
    const candidates = pool.get(baseKey(l)) || [];

    let idx = ain ? candidates.findIndex((c) => sameNumber(c.AIN_ENTRY_NUMBER, ain)) : -1;
    if (idx < 0 && dubai) idx = candidates.findIndex((c) => sameNumber(c.DUBAI_ENTRY_NUMBER, dubai) && (!c.AIN_ENTRY_NUMBER || !ain));

    if (idx < 0) {
      const { ROW: _row, ...line } = l;
      plan.inserts.push(line);
      continue;
    }

    const match = candidates.splice(idx, 1)[0];
    const update: ImportPlan['updates'][number] = { ID: match.ID, ROW: l.ROW };
    if (ain && !match.AIN_ENTRY_NUMBER) update.AIN_ENTRY_NUMBER = ain;
    if (dubai && !sameNumber(match.DUBAI_ENTRY_NUMBER, dubai)) update.DUBAI_ENTRY_NUMBER = dubai;
    if (account && !sameNumber(match.ACCOUNT_NAME, account)) update.ACCOUNT_NAME = account;
    if (update.AIN_ENTRY_NUMBER || update.DUBAI_ENTRY_NUMBER || update.ACCOUNT_NAME) plan.updates.push(update);
    else plan.unchanged++;
  }
  return plan;
}
