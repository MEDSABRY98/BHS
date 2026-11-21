'use client';

// Report: Suppliers Payables. Pop-up content: pick the year + month (and whether to count only that month or everything up to it),
// then download the PDF: supplier name · payment term · the open amount owed to him.

import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import type { ReportComponentProps } from '../Utils/ReportsRegistry';
import { MONTH_NAMES, loadPayables, type PayablesScope } from './SuppliersPayablesData';

const LABEL = 'text-[11px] font-black uppercase tracking-widest text-slate-400';

export default function SuppliersPayablesReport({ onClose }: ReportComponentProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 0 = whole year
  const [scope, setScope] = useState<PayablesScope>('upto');
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const period = { year, month, scope };
      const rows = await loadPayables(period);
      if (!rows.length) return toast.error('No open payables for this period');
      const { generateSuppliersPayablesPdf } = await import('./SuppliersPayablesPdf');
      await generateSuppliersPayablesPdf(rows, period);
      toast.success(`${rows.length} supplier${rows.length === 1 ? '' : 's'}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the report');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Year</span>
        <div className="flex items-center h-11 rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button type="button" disabled={busy} onClick={() => setYear((y) => y - 1)} className="w-10 h-full rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
          <span className="flex-1 text-center text-base font-black text-slate-900">{year}</span>
          <button type="button" disabled={busy} onClick={() => setYear((y) => y + 1)} className="w-10 h-full rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Month</span>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, ...Array.from({ length: 12 }, (_, i) => i + 1)].map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => setMonth(m)}
              className={`h-10 rounded-xl text-xs font-black transition-all ${m === 0 ? 'col-span-4' : ''} ${month === m ? 'bg-[#0a0f1d] text-[#D4AF37] shadow' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:border-amber-300 hover:text-slate-900'}`}
            >
              {m === 0 ? 'Whole year' : MONTH_NAMES[m - 1].slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Count</span>
        <div className="flex h-11 rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          {([['upto', 'Up to this period'], ['only', 'Only this period']] as const).map(([id, label]) => (
            <button key={id} type="button" disabled={busy} onClick={() => setScope(id)} className={`flex-1 rounded-lg text-sm font-black transition-all ${scope === id ? 'bg-[#0a0f1d] text-[#D4AF37] shadow' : 'text-slate-500 hover:text-slate-800'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-semibold text-slate-400">
          {scope === 'upto' ? 'Every open invoice dated up to the end of the period' : 'Only open invoices dated inside the period'} — the amount still unpaid today.
        </p>
      </div>

      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        className="h-12 w-full rounded-xl bg-[#0a0f1d] text-[#D4AF37] text-sm font-black inline-flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} {busy ? 'Working…' : 'Download PDF'}
      </button>
    </div>
  );
}
