'use client';

// Report: Salespersons Debit. Pop-up content: how to age the debit (+ optional "older than N days"),
// then one ZIP: a combined PDF of every salesperson + one PDF per salesperson (the Debit and Collections
// parts of the Salesperson Analysis PDF). Each salesperson comes from the same server call the module uses, so the
// numbers are the module's numbers and the user's rights apply (area managers get their own team).

import { useState } from 'react';
import { FileArchive, Loader2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { saveTrackedAs } from '@/app/AdminControl/Code/Audit/TrackedDownload';
import { GetSalespersonData, ListSalespersons } from '@/app/SalespersonAnalysis/Service/SalespersonService';
import { ComputeDebit, LedgerOverdueAbove } from '@/app/SalespersonAnalysis/Utils/SalespersonAggregations';
import type { AgingMode, LedgerRow, SalespersonData } from '@/app/SalespersonAnalysis/Utils/Types';
import type { ReportComponentProps } from '../Utils/ReportsRegistry';

const LABEL = 'text-[11px] font-black uppercase tracking-widest text-slate-400';
const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Salesperson';

export default function SalespersonsDebitReport({ onClose }: ReportComponentProps) {
  const [mode, setMode] = useState<AgingMode>('days');
  const [minDaysText, setMinDaysText] = useState('');
  const [from, setFrom] = useState(`${localDay().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(localDay());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const minDays = minDaysText.trim() === '' ? 0 : Number(minDaysText);
  const minDaysOk = Number.isFinite(minDays) && minDays >= 0;

  const download = async () => {
    if (!minDaysOk) return toast.error('Enter the days as a number (0 or more), or leave it empty');
    if (!from || !to || from > to) return toast.error('Pick a valid period for the collections');
    setBusy(true);
    try {
      setProgress('Loading the salespersons…');
      const { salespersons } = await ListSalespersons();
      if (!salespersons.length) return toast.error('No salespersons found');

      const [{ default: JSZip }, { ExportSalespersonReport }] = await Promise.all([import('jszip'), import('@/app/SalespersonAnalysis/Pdf/ExportReport')]);
      const zip = new JSZip();
      const today = localDay();
      const period = { start: from, end: to };

      const mergedLedger: LedgerRow[] = [];
      const mergedSales: SalespersonData['sales'] = [];
      const customers: SalespersonData['customers'] = {};
      const products: SalespersonData['products'] = {};
      const customerMeta: NonNullable<SalespersonData['customerMeta']> = {};
      const lastPayment: Record<string, string> = {};
      const tags: Record<string, string[]> = {};
      let windowStart = '';
      let files = 0;
      const usedNames = new Set<string>();

      for (let i = 0; i < salespersons.length; i++) {
        const sp = salespersons[i];
        setProgress(`${sp.name} (${i + 1} of ${salespersons.length})`);
        const full: SalespersonData = await GetSalespersonData({ salespersonId: sp.id, period });
        windowStart = windowStart || full.windowStart;

        // for the combined file (row ids made unique per salesperson)
        full.ledger.forEach((r) => mergedLedger.push({ ...r, id: `${sp.id}|${r.id}` }));
        full.sales.forEach((l) => mergedSales.push(l));
        Object.assign(customers, full.customers);
        Object.assign(products, full.products);
        Object.assign(customerMeta, full.customerMeta || {});
        Object.entries(full.lastPaymentByCustomer || {}).forEach(([k, v]) => {
          if (v && (!lastPayment[k] || v > lastPayment[k])) lastPayment[k] = v;
        });
        Object.entries(full.tagsByCustomer || {}).forEach(([k, v]) => {
          tags[k] = Array.from(new Set([...(tags[k] || []), ...v]));
        });

        const debitData = minDays > 0 ? { ...full, ledger: LedgerOverdueAbove(full, minDays, mode) } : full;
        const hasDebit = ComputeDebit(debitData, mode).openDebit > 0.01;
        const hasCollections = full.ledger.some((r) => r.credit > 0 && r.date >= from && r.date <= to);
        if (!hasDebit && !hasCollections) continue; // nothing to show → no file
        const blob = (await ExportSalespersonReport(full, mode, { debitCollections: true, minDays, asBlob: true })) as Blob;
        let name = fileSafe(sp.name);
        for (let n = 2; usedNames.has(name.toLowerCase()); n++) name = `${fileSafe(sp.name)} (${n})`;
        usedNames.add(name.toLowerCase());
        zip.file(`${name}.pdf`, blob);
        files++;
      }

      if (!files) return toast.error('No debit or collections for any salesperson');

      setProgress('Creating the combined file…');
      const combined: SalespersonData = {
        salesperson: { id: 'ALL', name: 'All Salespersons' },
        period,
        windowStart,
        showCosts: false,
        sales: mergedSales,
        customers,
        products,
        customerMeta,
        ledger: mergedLedger,
        lastPaymentByCustomer: lastPayment,
        tagsByCustomer: tags,
      };
      const combinedBlob = (await ExportSalespersonReport(combined, mode, { debitCollections: true, minDays, asBlob: true })) as Blob;
      zip.file('All Salespersons.pdf', combinedBlob);

      setProgress('Zipping…');
      const content = await zip.generateAsync({ type: 'blob' });
      saveTrackedAs(content, `Salespersons_Debit_${today}.zip`);
      toast.success(`${files} salesperson${files === 1 ? '' : 's'} + the combined file`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the report');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Aging by</span>
        <div className="flex h-11 rounded-xl border border-slate-200 bg-slate-50 p-1 gap-1">
          {([['days', 'Days'], ['months', 'Months']] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              disabled={busy}
              className={`flex-1 rounded-lg text-sm font-black transition-all ${mode === id ? 'bg-[#0a0f1d] text-[#D4AF37] shadow' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-semibold text-slate-400">{mode === 'days' ? 'Days past the due date' : 'Invoice month + payment term'}</p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Only debit older than (days)</span>
        <input
          value={minDaysText}
          onChange={(e) => setMinDaysText(e.target.value)}
          inputMode="numeric"
          placeholder="All debit"
          disabled={busy}
          className={`h-11 w-full rounded-xl border px-4 text-base font-black outline-none focus:ring-2 focus:ring-[#D4AF37]/40 ${minDaysOk ? 'border-slate-200 bg-white' : 'border-rose-300 bg-rose-50'}`}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Collections from</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#D4AF37]/40" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#D4AF37]/40" />
        </label>
      </div>

      <p className="text-xs font-semibold text-slate-400">One ZIP: a combined PDF of all salespersons + a PDF for each salesperson (Debit, then Collections for the period).</p>

      <button
        type="button"
        onClick={() => void download()}
        disabled={busy || !minDaysOk}
        className="h-12 w-full rounded-xl bg-[#0a0f1d] text-[#D4AF37] text-sm font-black inline-flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />} {busy ? progress || 'Working…' : 'Download ZIP'}
      </button>
    </div>
  );
}
