'use client';

import NoData from '@/app/Components/DataState/NoDataTab';
import { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, Save, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { saveReport, deleteReport } from '../Service/ReportService';
import { parseOdooPivot, type ParseResult } from '../Utils/ReportParser';
import { suggestClosedMonths } from '../Utils/ReportEngine';
import { monthLabel, type AnalyticType, type ReportMeta } from '../Utils/ReportTypes';
import { BTN, CARD, INPUT, TD, TH, THEAD, TITLE } from './ui';

export default function UploadTab({ types, reports, canDelete, onSaved, onDeleted }: { types: AnalyticType[]; reports: ReportMeta[]; canDelete: boolean; onSaved: (id: string) => void; onDeleted: (id: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [name, setName] = useState('');
  const [closed, setClosed] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.xlsx?$/i.test(f.name)) return toast.error('Please choose an .xlsx file');
    setReading(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true });
      const p = parseOdooPivot(rows);
      setParsed(p);
      setFileName(f.name);
      setName(f.name.replace(/\.xlsx?$/i, ''));
      setClosed(suggestClosedMonths(p.lines, types, p.months));
    } catch (e: any) {
      setParsed(null);
      toast.error(e?.message || 'Could not read the file');
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const unknown = parsed ? parsed.analytics.filter((a) => !types.some((t) => t.name === a)) : [];

  const save = async () => {
    if (!parsed) return;
    setSaving(true);
    try {
      const { report, newAccounts } = await saveReport({ name, fileName, months: parsed.months, closed, lines: parsed.lines });
      toast.success(newAccounts.length ? `Saved — ${newAccounts.length} new account(s) added as HQ. Classify them in Analytic Accounts.` : 'Report saved');
      setParsed(null);
      onSaved(report.id);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className={TITLE}>Upload Report</h1>

      <div
        onClick={() => !reading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!reading) void handleFile(e.dataTransfer.files?.[0]); }}
        className={`relative h-40 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all ${
          parsed ? 'bg-emerald-50/50 border-emerald-300' : dragOver ? 'bg-amber-50 border-amber-400' : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30'
        }`}
      >
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${parsed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600'}`}>
          {reading ? <Loader2 className="w-6 h-6 animate-spin" /> : parsed ? <CheckCircle2 className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
        </span>
        {parsed ? (
          <span className="px-6 min-w-0 max-w-full">
            <span className="block text-base font-black text-slate-900 truncate">{fileName}</span>
            <span className="block text-xs font-bold text-slate-500 mt-0.5">{parsed.lines.length} lines · {parsed.analytics.length} analytic accounts · {parsed.months.map(monthLabel).join(', ')}</span>
          </span>
        ) : (
          <span className="text-base font-black text-slate-900">{reading ? 'Reading...' : 'Upload Odoo analytic pivot (.xlsx)'}</span>
        )}
        {parsed && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setParsed(null); }} className="absolute top-3 right-3 w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center" title="Remove file">
            <X className="w-4 h-4" />
          </button>
        )}
        <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
      </div>

      {parsed && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
          {unknown.length > 0 && <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">New accounts (will be added as HQ): {unknown.join(', ')}</p>}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Report name" className={`${INPUT} !text-left lg:w-96`} />
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
              <span className="uppercase tracking-wider">Closed months</span>
              {parsed.months.map((m) => (
                <label key={m} className={`h-9 px-3 rounded-lg border flex items-center gap-2 cursor-pointer ${closed.includes(m) ? 'bg-amber-50 border-amber-300 text-slate-900' : 'bg-white border-slate-200'}`}>
                  <input type="checkbox" className="accent-amber-500" checked={closed.includes(m)} onChange={() => setClosed(closed.includes(m) ? closed.filter((x) => x !== m) : [...closed, m])} /> {monthLabel(m)}
                </label>
              ))}
            </div>
            <button onClick={() => void save()} disabled={saving || !name.trim()} className={`${BTN} lg:ml-auto`}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save &amp; Analyse
            </button>
          </div>
        </div>
      )}

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead><tr className={THEAD}>{['Report', 'Months', 'Lines', 'By', 'Date', ''].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {reports.length === 0 && <NoData isTable colSpan={6} message="Upload an Odoo analytic pivot to get started" />}
              {reports.map((r) => (
                <tr key={r.id} className="hover:bg-amber-50/40">
                  <td className={`${TD} font-bold text-slate-900`}>{r.name}</td>
                  <td className={TD}>{r.months.map(monthLabel).join(', ')}</td>
                  <td className={TD}>{r.lineCount}</td>
                  <td className={TD}>{r.createdBy}</td>
                  <td className={TD}>{String(r.createdAt).slice(0, 10)}</td>
                  <td className={TD}>
                    {canDelete && (
                      <button onClick={async () => { if (!confirm('Delete this report?')) return; try { await deleteReport(r.id); onDeleted(r.id); } catch (e: any) { toast.error(e?.message || 'Could not delete'); } }} className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 inline-flex items-center justify-center" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
