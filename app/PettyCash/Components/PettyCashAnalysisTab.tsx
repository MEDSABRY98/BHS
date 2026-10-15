'use client';

// Analysis tab (admin): upload an Excel of petty cash rows and download the Analysis PDF.
// Nothing is saved and the rows are not shown — template → upload → PDF.

import { useRef, useState } from 'react';
import { BarChart3, CheckCircle2, Download, FileUp, Loader2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { saveTrackedAs } from '@/app/Audit/Utils/TrackedDownload';
import { generatePettyCashAnalysisPdf } from '../Utils/PettyCashAnalysisPdf';
import { round2, type PettyCash } from '../Utils/PettyCashTypes';

const HEADERS = ['Employee', 'Invoice Date', 'Description', 'Account', 'Beneficiary', 'Amount (AED)'] as const;
type Field = 'employee' | 'date' | 'description' | 'account' | 'beneficiary' | 'amount';
const ALIASES: Record<Field, string[]> = {
  employee: ['employee', 'employeename', 'custodian'],
  date: ['invoicedate', 'date'],
  description: ['description', 'label'],
  account: ['account', 'accountname'],
  beneficiary: ['beneficiary', 'paidto'],
  amount: ['amountaed', 'amount'],
};

// Same look as the other BHS Excel exports
const HEADER_FILL = 'FF000000';
const HEADER_TEXT = 'FFFFFFFF';
const GOLD_BORDER = 'FFC9A84C';
const NUM_FMT = '#,##0.00;-#,##0.00;"-"';

type Row = { employee: string; date: string; description: string; account: string; beneficiary: string; amount: number };
type Loaded = { fileName: string; rows: Row[]; errors: { row: number; message: string }[] };

const key = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = (n: number) => String(n).padStart(2, '0');

function plain(v: any): any {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in v) return plain(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((p: any) => p.text).join('');
    if ('text' in v) return v.text;
    if ('error' in v) return null;
  }
  return v;
}

const text = (v: any) => {
  const p = plain(v);
  return p instanceof Date ? '' : String(p ?? '').replace(/\s+/g, ' ').trim();
};

function isoDate(v: any): string | null {
  const p = plain(v);
  if (p === null || p === '') return null;
  const ok = (y: number, m: number, d: number) => {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    const dt = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null;
  };
  if (p instanceof Date) return Number.isNaN(p.getTime()) ? null : ok(p.getUTCFullYear(), p.getUTCMonth() + 1, p.getUTCDate());
  if (typeof p === 'number') {
    const d = new Date(Math.round((p - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(p).trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
  if (m) return ok(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return null;
}

function amountOf(v: any): number | null {
  const p = plain(v);
  if (p === null || p === '') return null;
  const n = typeof p === 'number' ? p : Number(String(p).replace(/,/g, '').trim());
  return Number.isFinite(n) ? round2(n) : null;
}

async function downloadTemplate() {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Petty Cash', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  const widths = [22, 16, 42, 26, 28, 18];
  ws.columns = HEADERS.map((h, i) => ({ header: h, width: widths[i] }));
  const head = ws.getRow(1);
  head.height = 25;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD_BORDER } } };
  });
  for (let r = 2; r <= 300; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= HEADERS.length; c++) row.getCell(c).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.getCell(2).numFmt = 'dd/mm/yyyy';
    row.getCell(6).numFmt = NUM_FMT;
  }
  const buffer = await wb.xlsx.writeBuffer();
  saveTrackedAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'PettyCash_Analysis_Template.xlsx');
}

async function readFile(file: File): Promise<Loaded> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());

  for (const ws of wb.worksheets) {
    let headerRow = 0;
    let cols: Partial<Record<Field, number>> = {};
    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !headerRow; r++) {
      const found: Partial<Record<Field, number>> = {};
      ws.getRow(r).eachCell((cell, col) => {
        const k = key(plain(cell.value));
        (Object.keys(ALIASES) as Field[]).forEach((f) => {
          if (found[f] === undefined && ALIASES[f].includes(k)) found[f] = col;
        });
      });
      if (found.date && found.amount && (found.description || found.beneficiary)) {
        headerRow = r;
        cols = found;
      }
    }
    if (!headerRow) continue;

    const get = (row: any, f: Field) => (cols[f] ? row.getCell(cols[f]!).value : null);
    const rows: Row[] = [];
    const errors: Loaded['errors'] = [];
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rawDate = get(row, 'date');
      const description = text(get(row, 'description'));
      const beneficiary = text(get(row, 'beneficiary'));
      const rawAmount = get(row, 'amount');
      if (!text(rawDate) && !(plain(rawDate) instanceof Date) && !description && !beneficiary && amountOf(rawAmount) === null) continue; // empty row

      const date = isoDate(rawDate);
      const amount = amountOf(rawAmount);
      if (!date) { errors.push({ row: r, message: 'Invalid or missing invoice date' }); continue; }
      if (amount === null || amount <= 0) { errors.push({ row: r, message: 'Amount must be a number greater than zero' }); continue; }
      rows.push({
        employee: text(get(row, 'employee')) || 'Unspecified',
        date,
        description: description || '-',
        account: text(get(row, 'account')),
        beneficiary: beneficiary || 'Unspecified',
        amount,
      });
    }
    return { fileName: file.name, rows, errors };
  }
  throw new Error(`No sheet with the template columns was found (${HEADERS.join(', ')})`);
}

/** One group per employee, shaped like saved petty cash so the same Analysis PDF is used. */
function toGroups(rows: Row[]): PettyCash[] {
  const byEmployee = new Map<string, Row[]>();
  for (const r of rows) byEmployee.set(r.employee, [...(byEmployee.get(r.employee) || []), r]);
  let id = 0;
  return Array.from(byEmployee, ([employee, list]) => ({
    ID: employee,
    LINES_COUNT: list.length,
    TOTAL_AMOUNT: round2(list.reduce((s, r) => s + r.amount, 0)),
    TAX_AMOUNT_TOTAL: 0,
    NOTES: null,
    CREATED_BY: employee,
    CREATED_BY_ID: '',
    CREATED_AT: '',
    STATUS: 'SUBMITTED' as const,
    MINE: false,
    LINES: list.map((r, i) => ({
      ID: ++id,
      PETTY_CASH_ID: employee,
      LINE_NO: i + 1,
      INVOICE_DATE: r.date,
      DESCRIPTION: r.description,
      BENEFICIARY: r.beneficiary,
      AMOUNT: r.amount,
      IS_TAX_INVOICE: false,
      HAS_INVOICE: true,
      ACCOUNT: r.account || null,
    })),
  }));
}

export default function PettyCashAnalysisTab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState<'template' | 'pdf' | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) return toast.error('Please choose an .xlsx file');
    setReading(true);
    try {
      const result = await readFile(file);
      if (!result.rows.length) throw new Error('No valid rows in this file');
      setLoaded(result);
      if (result.errors.length) toast.warning(`${result.errors.length} row(s) skipped`);
    } catch (err: any) {
      setLoaded(null);
      toast.error(err?.message || 'Could not read the file');
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const run = async (kind: 'template' | 'pdf') => {
    setBusy(kind);
    try {
      if (kind === 'template') await downloadTemplate();
      else if (loaded) await generatePettyCashAnalysisPdf(toGroups(loaded.rows), { groupLabel: 'Employee' });
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the file');
    } finally {
      setBusy(null);
    }
  };

  const card = 'h-40 rounded-3xl border flex flex-col items-center justify-center gap-3 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Petty Cash Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Template */}
        <button onClick={() => void run('template')} disabled={!!busy} className={`${card} bg-white border-slate-100 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40`}>
          <span className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            {busy === 'template' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Download className="w-6 h-6" />}
          </span>
          <span className="text-base font-black text-slate-900">Download Template</span>
        </button>

        {/* 2. Upload */}
        <div
          onClick={() => !reading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!reading) void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`${card} relative cursor-pointer border-2 border-dashed ${
            loaded ? 'bg-emerald-50/50 border-emerald-300' : dragOver ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
          }`}
        >
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${loaded ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
            {reading ? <Loader2 className="w-6 h-6 animate-spin" /> : loaded ? <CheckCircle2 className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
          </span>
          {loaded ? (
            <span className="px-6 min-w-0 max-w-full">
              <span className="block text-base font-black text-slate-900 truncate">{loaded.fileName}</span>
              <span className="block text-xs font-bold text-slate-500 mt-0.5">
                {loaded.rows.length} row{loaded.rows.length === 1 ? '' : 's'}
                {loaded.errors.length ? <span className="text-red-600"> · {loaded.errors.length} skipped</span> : null}
              </span>
            </span>
          ) : (
            <span className="text-base font-black text-slate-900">{reading ? 'Reading...' : 'Upload Excel'}</span>
          )}
          {loaded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLoaded(null);
              }}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
        </div>

        {/* 3. PDF */}
        <button
          onClick={() => void run('pdf')}
          disabled={!loaded || !!busy}
          className={`${card} bg-[#0a0f1d] border-[#0a0f1d] shadow-lg shadow-black/10 hover:brightness-125`}
        >
          <span className="w-12 h-12 rounded-2xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center">
            {busy === 'pdf' ? <Loader2 className="w-6 h-6 animate-spin" /> : <BarChart3 className="w-6 h-6" />}
          </span>
          <span className="text-base font-black text-[#D4AF37]">Download Analysis PDF</span>
        </button>
      </div>

      {loaded && loaded.errors.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs font-semibold text-amber-800 space-y-0.5 max-h-32 overflow-y-auto">
          {loaded.errors.slice(0, 50).map((e) => (
            <p key={e.row}>
              Row {e.row}: {e.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
