'use client';

// Sidebar button: pick the day (or a from / to range) and download the daily sales PDF
// (every salesperson for admins / full data access, otherwise the user himself).

import { useEffect, useState } from 'react';
import { CalendarDays, FileBarChart, Loader2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { GetDailySalesReport } from '../Service/SalespersonService';

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoOf(new Date());
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoOf(d);
};

export default function DailyReportButton() {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy]);

  const valid = !!from && !!to && from <= to;

  const generate = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const data = await GetDailySalesReport({ start: from, end: to });
      if (!data.lines.length) {
        toast.warning('No sales in this period');
        return;
      }
      const { ExportDailySalesReport } = await import('../Pdf/DailySalesReport');
      await ExportDailySalesReport(data);
      setOpen(false);
    } catch (err: any) {
      console.error('Daily sales report failed:', err);
      toast.error(err?.message || 'Could not create the daily sales report');
    } finally {
      setBusy(false);
    }
  };

  const quick = [
    { label: 'Today', from: today(), to: today() },
    { label: 'Yesterday', from: daysAgo(1), to: daysAgo(1) },
    { label: 'Last 7 days', from: daysAgo(6), to: today() },
  ];
  const input =
    'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 outline-none focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Daily Sales Report (PDF)"
        className="flex items-center justify-center w-10 h-10 hover:bg-slate-100 rounded-xl text-slate-500 border border-slate-200 shrink-0"
      >
        <FileBarChart className="w-5 h-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden text-left">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center shadow-lg shadow-[#D4AF37]/30">
                <CalendarDays className="w-5 h-5" />
              </span>
              <div className="flex-1">
                <h3 className="text-lg font-black text-slate-900 leading-tight">Daily Sales Report</h3>
                <p className="text-xs font-semibold text-slate-400">Totals and every salesperson, as a PDF</p>
              </div>
              <button
                onClick={() => !busy && setOpen(false)}
                className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-3 gap-2">
                {quick.map((q) => {
                  const active = from === q.from && to === q.to;
                  return (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        setFrom(q.from);
                        setTo(q.to);
                      }}
                      className={`h-9 w-full px-2 rounded-lg text-xs font-bold text-center whitespace-nowrap transition-colors ${
                        active ? 'bg-[#0f0f0f] text-[#D4AF37]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {q.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">From</span>
                  <input
                    type="date"
                    value={from}
                    max={today()}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      if (e.target.value && to && e.target.value > to) setTo(e.target.value);
                    }}
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">To</span>
                  <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className={`${input} mt-1`} />
                </label>
              </div>
              {!valid && <p className="text-xs font-bold text-red-500">The From date must be on or before the To date.</p>}
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 h-11 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider hover:bg-slate-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void generate()}
                disabled={!valid || busy}
                className="flex-1 h-11 rounded-xl bg-[#0f0f0f] text-[#D4AF37] text-xs font-black uppercase tracking-wider hover:bg-black shadow-lg inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart className="w-4 h-4" />}
                {busy ? 'Preparing...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
