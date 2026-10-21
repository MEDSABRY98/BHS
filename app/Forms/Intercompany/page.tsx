'use client';

// Intercompany Reconciliation (Al Ain ↔ Dubai): download the Excel template, upload the filled file,
// download the analysis PDF. Nothing is saved in the database — the lines stay in this page only.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileDown, FileSpreadsheet, FileText, Loader2, Upload, X } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import { getAllowedForms } from '../Shared/FormsAccess';
import { compareEntries, formatAmount, formatDate, round2, type IntercompanyLine } from './IntercompanyTypes';

const FORM_ID = 'intercompany';

export default function IntercompanyFormPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  useModuleTabAudit('Intercompany Reconciliation');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const loadAccess = useCallback(async () => {
    try {
      setAllowed((await getAllowedForms()).includes(FORM_ID));
    } catch {
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadAccess();
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, [loadAccess]);

  if (isChecking) return <MainLoader message="Loading Intercompany Reconciliation..." />;
  if (!isAuthenticated)
    return (
      <Login
        onLogin={async (user: any) => {
          setIsAuthenticated(true);
          setCurrentUser(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
          await loadAccess();
        }}
      />
    );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window.location.href = '/Forms')}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center transition-colors"
            title="All Forms"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl sm:text-3xl font-normal text-black tracking-tighter">Intercompany Reconciliation</h1>
        </div>
        {allowed === null ? (
          <TabLoader className="!min-h-[60vh]" />
        ) : !allowed ? (
          <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use this form.</div>
        ) : (
          <IntercompanyTool />
        )}
      </div>
    </div>
  );
}

const CARD = 'bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]';

function IntercompanyTool() {
  const [lines, setLines] = useState<IntercompanyLine[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [busy, setBusy] = useState<'template' | 'upload' | 'pdf' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    setBusy('template');
    try {
      const { downloadIntercompanyTemplate } = await import('./IntercompanyExcel');
      await downloadIntercompanyTemplate();
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the template');
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    try {
      const { readIntercompanyFile } = await import('./IntercompanyExcel');
      const parsed = await readIntercompanyFile(file);
      const list = parsed.lines.map(({ ROW: _row, ...l }) => l).sort(compareEntries);
      setLines(list);
      setErrors(parsed.errors);
      setFileName(file.name);
      if (!list.length) toast.warning('No valid lines in this file');
      else toast.success(`${list.length} line${list.length === 1 ? '' : 's'} loaded${parsed.errors.length ? ` — ${parsed.errors.length} skipped` : ''}`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not read the file');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadPdf = async () => {
    if (!lines?.length) return;
    setBusy('pdf');
    try {
      const { exportIntercompanyPdf } = await import('./IntercompanyPdf');
      await exportIntercompanyPdf(lines);
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the PDF');
    } finally {
      setBusy(null);
    }
  };

  const clear = () => {
    setLines(null);
    setErrors([]);
    setFileName('');
  };

  const debit = round2((lines || []).reduce((s, l) => s + l.DEBIT, 0));
  const credit = round2((lines || []).reduce((s, l) => s + l.CREDIT, 0));
  const dates = (lines || []).map((l) => l.ENTRY_DATE).sort();
  const missing = (lines || []).filter((l) => !l.AIN_ENTRY_NUMBER || !l.DUBAI_ENTRY_NUMBER).length;
  const hasLines = !!lines?.length;

  const step = (n: number, title: string, text: string, icon: React.ReactNode, button: React.ReactNode, disabled = false) => (
    <div className={`${CARD} p-6 flex flex-col gap-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Step {n}</p>
          <p className="text-base font-black text-slate-900">{title}</p>
        </div>
      </div>
      <p className="text-sm font-semibold text-slate-500 flex-1">{text}</p>
      {button}
    </div>
  );

  const btn =
    'h-11 w-full rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {step(
          1,
          'Excel Template',
          'Download the empty template and fill in the lines (or use the Odoo export with the same columns).',
          <FileSpreadsheet className="w-5 h-5" />,
          <button type="button" onClick={downloadTemplate} disabled={!!busy} className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            {busy === 'template' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download Template
          </button>,
        )}
        {step(
          2,
          'Upload Excel',
          hasLines ? `${fileName}` : 'Upload the filled file. It is only read here — nothing is saved.',
          <Upload className="w-5 h-5" />,
          <>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!!busy} className={`${btn} bg-[#0a0f1d] text-[#D4AF37] hover:shadow-lg`}>
              {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {hasLines ? 'Upload Another File' : 'Upload Excel'}
            </button>
          </>,
        )}
        {step(
          3,
          'Analysis PDF',
          hasLines ? `${lines!.length} line${lines!.length === 1 ? '' : 's'} ready.` : 'Upload the Excel file first.',
          <FileText className="w-5 h-5" />,
          <button
            type="button"
            onClick={downloadPdf}
            disabled={!hasLines || !!busy}
            className={`${btn} bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-lg shadow-[#D4AF37]/25 hover:shadow-xl`}
          >
            {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
          </button>,
          !hasLines,
        )}
      </div>

      {lines && (
        <div className={`${CARD} p-6 space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <p className="text-sm font-black text-slate-900 truncate">{fileName}</p>
            </div>
            <button type="button" onClick={clear} className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center" title="Clear">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Lines', value: String(lines.length) },
              { label: 'Period', value: dates.length ? (dates[0] === dates[dates.length - 1] ? formatDate(dates[0]) : `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`) : '-' },
              { label: 'Total Debit', value: formatAmount(debit), cls: 'text-emerald-700' },
              { label: 'Total Credit', value: formatAmount(credit), cls: 'text-rose-700' },
              { label: 'Balance', value: formatAmount(round2(debit - credit)) },
            ].map((c) => (
              <div key={c.label} className="p-3 rounded-2xl bg-slate-50 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{c.label}</p>
                <p className={`text-sm font-black mt-1 ${c.cls || 'text-slate-900'}`}>{c.value}</p>
              </div>
            ))}
          </div>
          {missing > 0 && (
            <p className="text-xs font-bold text-amber-700">
              {missing} line{missing === 1 ? '' : 's'} without an Al Ain or Dubai entry number (marked MISSING in the PDF).
            </p>
          )}
          {errors.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-amber-800">
                <AlertTriangle className="w-4 h-4" /> {errors.length} row{errors.length === 1 ? '' : 's'} skipped
              </p>
              <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto text-xs font-semibold text-amber-900">
                {errors.map((e) => (
                  <li key={e.row}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
