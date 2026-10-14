'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileUp, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { downloadIntercompanyExcel, planIntercompanyImport, readIntercompanyExcel, type ImportPlan, type ParsedExcel } from '../Utils/IntercompanyExcel';
import { insertIntercompanyEntries, listIntercompanyEntries, updateIntercompanyEntries, updateIntercompanyNumbers } from '../Service/IntercompanyService';
import type { IntercompanyEntry } from '../Utils/IntercompanyTypes';

const CHUNK = 500;

interface ExcelModalProps {
  open: boolean;
  onClose: () => void;
  entries: IntercompanyEntry[];
  filtered: IntercompanyEntry[];
  canEdit: boolean;
  onImported: () => Promise<void>;
}

export default function ExcelModal({ open, onClose, entries, filtered, canEdit, onImported }: ExcelModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState<ParsedExcel | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);

  if (!open) return null;

  const reset = () => {
    setFileName('');
    setParsed(null);
    setPlan(null);
    setProgress('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      toast.error('Please choose an .xlsx file');
      return;
    }
    setReading(true);
    setFileName(file.name);
    setParsed(null);
    setPlan(null);
    try {
      const result = await readIntercompanyExcel(file);
      // Match against the latest saved lines (someone may have uploaded meanwhile)
      const latest = await listIntercompanyEntries();
      setParsed(result);
      setPlan(planIntercompanyImport(result.lines, latest));
    } catch (err: any) {
      toast.error(err?.message || 'Could not read the file');
      reset();
    } finally {
      setReading(false);
    }
  };

  const runImport = async () => {
    if (!plan) return;
    setImporting(true);
    try {
      let added = 0;
      for (let i = 0; i < plan.inserts.length; i += CHUNK) {
        setProgress(`Adding lines ${i + 1}–${Math.min(i + CHUNK, plan.inserts.length)} of ${plan.inserts.length}`);
        added += await insertIntercompanyEntries(plan.inserts.slice(i, i + CHUNK));
      }
      let updated = 0;
      const edits = plan.edits.map(({ ROW: _row, ...u }) => u);
      for (let i = 0; i < edits.length; i += CHUNK) {
        setProgress(`Updating edited lines ${i + 1}–${Math.min(i + CHUNK, edits.length)} of ${edits.length}`);
        updated += await updateIntercompanyEntries(edits.slice(i, i + CHUNK));
      }
      const updates = plan.updates.map(({ ROW: _row, ...u }) => u);
      for (let i = 0; i < updates.length; i += CHUNK) {
        setProgress(`Updating lines ${i + 1}–${Math.min(i + CHUNK, updates.length)} of ${updates.length}`);
        updated += await updateIntercompanyNumbers(updates.slice(i, i + CHUNK));
      }
      setProgress('Refreshing...');
      await onImported();
      toast.success(`Done: ${added} new line(s), ${updated} line(s) updated`);
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
      await onImported(); // show whatever was saved before the error
      setProgress('');
    } finally {
      setImporting(false);
    }
  };

  const changes = plan ? plan.inserts.length + plan.updates.length + plan.edits.length : 0;
  const nothingToDo = !!plan && changes === 0;
  const skipped = parsed && plan ? [...parsed.errors, ...plan.missing].sort((a, b) => a.row - b.row) : [];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={close}>
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Excel</h3>
              <p className="text-xs font-semibold text-slate-400">Template, export and upload</p>
            </div>
          </div>
          <button onClick={close} disabled={importing} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Downloads */}
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => void downloadIntercompanyExcel([], 'Intercompany_Template.xlsx')}
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition-all"
            >
              <Download className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-black text-slate-900">Download Template</p>
                <p className="text-xs text-slate-400 font-medium">Empty sheet with the right columns</p>
              </div>
            </button>
            <button
              onClick={() => void downloadIntercompanyExcel(filtered, `Intercompany_Entries_${new Date().toISOString().slice(0, 10)}.xlsx`)}
              disabled={filtered.length === 0}
              className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left transition-all disabled:opacity-40"
            >
              <Download className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-black text-slate-900">Export Lines ({filtered.length.toLocaleString('en-US')})</p>
                <p className="text-xs text-slate-400 font-medium">
                  {filtered.length === entries.length ? 'All saved lines' : 'Lines shown with the current filters'} — edit and upload it back to update them
                </p>
              </div>
            </button>
          </div>

          {/* Upload */}
          {canEdit ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (!importing && !reading) void handleFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => !importing && !reading && inputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                  dragOver ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
              >
                {reading ? <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" /> : <FileUp className="w-8 h-8 text-slate-400" />}
                <p className="text-sm font-black text-slate-700">{reading ? 'Reading file...' : fileName || 'Upload the filled template (.xlsx)'}</p>
                <p className="text-xs text-slate-400 font-medium">Click or drop the file here</p>
                <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
              </div>


              {parsed && plan && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat label="Lines in file" value={parsed.lines.length} tone="text-slate-900" />
                    <Stat label="New lines" value={plan.inserts.length} tone="text-emerald-600" />
                    <Stat label="Line updates" value={plan.updates.length + plan.edits.length} tone="text-blue-600" />
                    <Stat label="Already saved" value={plan.unchanged} tone="text-slate-400" />
                  </div>

                  {skipped.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                      <p className="flex items-center gap-2 text-sm font-black text-amber-700 mb-2">
                        <AlertTriangle className="w-4 h-4" /> {skipped.length} row(s) skipped
                      </p>
                      <div className="max-h-32 overflow-y-auto text-xs text-amber-800 space-y-0.5 font-medium">
                        {skipped.slice(0, 100).map((e) => (
                          <p key={e.row}>
                            Row {e.row}: {e.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {nothingToDo && (
                    <p className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" /> Everything in this file is already saved.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 font-semibold text-center py-4">You can download only — uploading needs edit permission.</p>
          )}
        </div>

        {/* Footer */}
        {canEdit && plan && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
            <span className="text-xs font-bold text-slate-400 truncate">{progress}</span>
            <div className="flex gap-3">
              <button onClick={reset} disabled={importing} className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 disabled:opacity-40">
                <RefreshCw className="w-4 h-4" /> Another file
              </button>
              <button
                onClick={() => void runImport()}
                disabled={importing || nothingToDo}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload {changes} change(s)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 p-3 text-center">
      <p className={`text-2xl font-black ${tone}`}>{value.toLocaleString('en-US')}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}
