'use client';

import { FileDown, ListChecks, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/app/Components/Notification';
import type { RoiResult } from './Types';

export const money = (n: number) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const shortMoney = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 10_000) return `${(n / 1_000).toFixed(0)}K`;
  return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export function RoiBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">ROI N/A</span>;
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${value >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      ROI {value > 0 ? '+' : ''}
      {value.toFixed(1)}%
    </span>
  );
}

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</div>
      <div className="font-mono font-black text-sm text-slate-900 truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

/** Round PDF button used on every card. `results` = pages (one per customer), in the order wanted. */
export function PdfIconButton({
  results,
  fileName,
  title = 'Download PDF',
}: {
  results: RoiResult[];
  fileName?: string;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      title={title}
      disabled={busy || !results.length}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          const { ExportRoiReport } = await import('../Pdf/ExportRoiReport');
          await ExportRoiReport(results, { fileName });
        } catch (err) {
          console.error('ROI report failed:', err);
          toast.error('Could not create the PDF report');
        } finally {
          setBusy(false);
        }
      }}
      className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#B8860B] hover:border-[#D4AF37] hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" /> : <FileDown className="w-4 h-4" />}
    </button>
  );
}

/** One-page summary PDF button (all the given customers in one table). */
export function SummaryIconButton({
  results,
  title,
  subtitle,
  fileName,
  hint = 'Summary PDF (one table)',
}: {
  results: RoiResult[];
  title: string;
  subtitle?: string;
  fileName?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      title={hint}
      disabled={busy || !results.length}
      onClick={async (e) => {
        e.stopPropagation();
        setBusy(true);
        try {
          const { ExportRoiSummary } = await import('../Pdf/ExportRoiSummary');
          await ExportRoiSummary(results, { title, subtitle, fileName });
        } catch (err) {
          console.error('ROI summary failed:', err);
          toast.error('Could not create the summary PDF');
        } finally {
          setBusy(false);
        }
      }}
      className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#B8860B] hover:border-[#D4AF37] hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin text-[#D4AF37]" /> : <ListChecks className="w-4 h-4" />}
    </button>
  );
}

export function sumOf(results: RoiResult[]) {
  const support = results.reduce((a, r) => a + r.totalSupport, 0);
  const net = results.reduce((a, r) => a + r.net, 0);
  const costed = results.filter((r) => r.profit !== null);
  const profit = costed.length ? costed.reduce((a, r) => a + (r.profit as number), 0) : null;
  const costedSupport = costed.reduce((a, r) => a + r.totalSupport, 0);
  return {
    support,
    net,
    profit,
    roi: profit !== null && costedSupport > 0 ? ((profit - costedSupport) / costedSupport) * 100 : null,
  };
}
