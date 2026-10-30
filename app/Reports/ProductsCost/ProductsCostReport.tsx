'use client';

// Report: Products Cost. Pop-up content: choose the cost (real / reduced by %), the filter, then download the Excel.

import { useEffect, useState } from 'react';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import type { ReportComponentProps } from '../Utils/ReportsRegistry';
import { fetchProductsForCost, parsePercent } from './ProductsCostData';

const STORAGE_KEY = 'reportProductsCostPercent';
const LABEL = 'text-[11px] font-black uppercase tracking-widest text-slate-400';

export default function ProductsCostReport({ onClose }: ReportComponentProps) {
  const [mode, setMode] = useState<'real' | 'reduced'>('real');
  const [percentText, setPercentText] = useState('10');
  const [activeOnly, setActiveOnly] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPercentText(saved);
    } catch {
      // ignore
    }
  }, []);

  // real cost = exactly the database cost (0%), reduced = lowered by the typed percentage
  const percent = mode === 'real' ? 0 : parsePercent(percentText);

  const onPercent = (v: string) => {
    setPercentText(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // ignore
    }
  };

  const download = async () => {
    if (percent === null) return toast.error('Enter a percentage between 0 and 100');
    setExporting(true);
    try {
      const all = await fetchProductsForCost();
      const list = all.filter((p) => !activeOnly || p.active);
      if (!list.length) return toast.error('No products to export');
      const { exportProductsCostExcel } = await import('./ProductsCostExcel');
      await exportProductsCostExcel(list, percent);
      toast.success(`${list.length.toLocaleString()} products exported`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the Excel file');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Cost</span>
        <div className="flex h-11 rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          {([['real', 'Real cost'], ['reduced', 'Reduced']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`flex-1 rounded-lg text-sm font-black transition-all ${mode === id ? 'bg-[#0a0f1d] text-[#D4AF37] shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'reduced' && (
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Reduce cost by (%)</span>
          <div className="relative">
            <input
              value={percentText}
              onChange={(e) => onPercent(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 12.5"
              autoFocus
              className={`h-11 w-full rounded-xl border px-4 pr-9 text-base font-black outline-none focus:ring-2 focus:ring-[#D4AF37]/40 ${percent === null ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400">%</span>
          </div>
        </label>
      )}

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="w-4 h-4 accent-[#B8860B]" />
        <span className="text-sm font-bold text-slate-700">Active products only</span>
      </label>

      <button
        type="button"
        onClick={() => void download()}
        disabled={exporting || percent === null}
        className="h-12 w-full rounded-xl bg-[#0a0f1d] text-[#D4AF37] text-sm font-black inline-flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Download Excel
      </button>
    </div>
  );
}
