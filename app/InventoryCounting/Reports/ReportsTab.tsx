'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileSpreadsheet, FileText, Upload, Plus, Trash2, X, AlertCircle } from 'lucide-react';
import {
  type CountRow,
  type CoverInfo,
  DEFAULT_COVER,
  loadCover,
  parseCountExcel,
  saveCover,
} from './ReportTypes';
import { downloadTemplate, exportCountReportExcel, exportCountReportPdf } from './ReportExports';

type SubTab = 'report' | 'cover';

export default function ReportsTab({ active = true }: { active?: boolean }) {
  const [subTab, setSubTab] = useState<SubTab>('report');
  const [rows, setRows] = useState<CountRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'upload' | 'pdf' | 'excel'>('');
  const [cover, setCover] = useState<CoverInfo>(DEFAULT_COVER);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  // the sub-tabs live in the page header (beside the title) when that slot is visible
  useEffect(() => {
    const el = document.getElementById('ic-header-slot');
    setSlot(el && el.offsetParent !== null ? el : null);
  }, [active]);

  useEffect(() => {
    setCover(loadCover());
    setCoverLoaded(true);
  }, []);

  useEffect(() => {
    if (coverLoaded) saveCover(cover);
  }, [cover, coverLoaded]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    setError('');
    try {
      const parsed = await parseCountExcel(file);
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const run = async (kind: 'pdf' | 'excel') => {
    setBusy(kind);
    setError('');
    try {
      if (kind === 'pdf') await exportCountReportPdf(rows, cover);
      else await exportCountReportExcel(rows, cover);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy('');
    }
  };

  const updateCover = (patch: Partial<CoverInfo>) => setCover((c) => ({ ...c, ...patch }));
  const updateMember = (id: string, patch: { name?: string; role?: string }) =>
    setCover((c) => ({ ...c, committee: c.committee.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const addMember = () =>
    setCover((c) => ({ ...c, committee: [...c.committee, { id: `m${Date.now()}`, name: '', role: '' }] }));
  const removeMember = (id: string) =>
    setCover((c) => ({ ...c, committee: c.committee.length > 1 ? c.committee.filter((m) => m.id !== id) : c.committee }));

  const inputCls =
    'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400 transition-all';
  const btnCls =
    'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';


  const subTabs = (
      <div className="flex w-[460px] max-w-full bg-slate-100 p-1.5 rounded-2xl">
        {([
          ['report', 'Count Report'],
          ['cover', 'Report Cover'],
        ] as [SubTab, string][]).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              subTab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
  );

  return (
    <div className="space-y-6">
      {active && (slot ? createPortal(subTabs, slot) : subTabs)}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl px-5 py-4 text-sm font-bold">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {subTab === 'report' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 max-w-4xl mx-auto text-center space-y-8">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <div>
            <h2 className="text-lg font-black text-slate-900">Inventory Count Report</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {fileName ? `${fileName} - ${rows.length.toLocaleString()} products` : 'Download the template, fill it, upload it, then print the report'}
            </p>
          </div>

          <div className="flex flex-wrap xl:flex-nowrap items-center justify-center gap-3">
            <button type="button" onClick={() => void downloadTemplate()} className={`${btnCls} w-44 justify-center bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              <Download className="w-4 h-4" /> Template
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== ''}
              className={`${btnCls} w-44 justify-center bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200/50`}
            >
              <Upload className="w-4 h-4" /> {busy === 'upload' ? 'Reading...' : 'Upload Excel'}
            </button>
            <button
              type="button"
              onClick={() => void run('pdf')}
              disabled={!rows.length || busy !== ''}
              className={`${btnCls} w-44 justify-center bg-slate-900 text-white hover:bg-black`}
            >
              <FileText className="w-4 h-4" /> {busy === 'pdf' ? 'Building...' : 'PDF Report'}
            </button>
            <button
              type="button"
              onClick={() => void run('excel')}
              disabled={!rows.length || busy !== ''}
              className={`${btnCls} w-44 justify-center bg-emerald-600 text-white hover:bg-emerald-700`}
            >
              <FileSpreadsheet className="w-4 h-4" /> {busy === 'excel' ? 'Building...' : 'Excel Report'}
            </button>
          </div>
        </div>
      )}

      {subTab === 'cover' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
          <div>
            <h2 className="text-lg font-black text-slate-900">Report Cover</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Count Date</label>
              <input type="date" value={cover.countDate} onChange={(e) => updateCover({ countDate: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Serial Number</label>
              <input type="text" value={cover.serialNo} onChange={(e) => updateCover({ serialNo: e.target.value })} className={inputCls} />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Store</label>
              <input type="text" value={cover.store} onChange={(e) => updateCover({ store: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                Counting Committee (printed in this order)
              </label>
              <button type="button" onClick={addMember} className={`${btnCls} bg-slate-100 text-slate-700 hover:bg-slate-200 !py-2`}>
                <Plus className="w-4 h-4" /> Add Member
              </button>
            </div>
            {cover.committee.map((m, i) => (
              <div key={m.id} className="grid grid-cols-[28px_1fr_1fr_40px] gap-3 items-center">
                <span className="text-xs font-black text-slate-400 text-center">{i + 1}</span>
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) => updateMember(m.id, { name: e.target.value })}
                  placeholder="Name"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={m.role}
                  onChange={(e) => updateMember(m.id, { role: e.target.value })}
                  placeholder="Role"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => removeMember(m.id)}
                  disabled={cover.committee.length <= 1}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-all"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
