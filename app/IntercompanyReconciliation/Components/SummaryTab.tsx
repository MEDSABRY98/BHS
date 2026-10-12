'use client';

import { useMemo } from 'react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { formatAmount, round2, type IntercompanyEntry } from '../Utils/IntercompanyTypes';

interface MonthRow {
  key: string; // YYYY-MM
  lines: number;
  debit: number;
  credit: number;
  matched: number;
  missing: number; // no Dubai no
  missingAin: number; // no Al Ain no
  missingAmount: number;
  withFiles: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(key: string) {
  const [y, m] = key.split('-');
  return `${MONTHS[Number(m) - 1] || m} ${y}`;
}

export default function SummaryTab({ entries }: { entries: IntercompanyEntry[] }) {
  const { rows, total } = useMemo(() => {
    const map = new Map<string, MonthRow>();
    const total: MonthRow = { key: 'total', lines: 0, debit: 0, credit: 0, matched: 0, missing: 0, missingAin: 0, missingAmount: 0, withFiles: 0 };
    for (const e of entries) {
      const key = e.ENTRY_DATE.slice(0, 7);
      const row = map.get(key) || { key, lines: 0, debit: 0, credit: 0, matched: 0, missing: 0, missingAin: 0, missingAmount: 0, withFiles: 0 };
      for (const r of [row, total]) {
        r.lines++;
        r.debit += e.DEBIT;
        r.credit += e.CREDIT;
        if (!e.DUBAI_ENTRY_NUMBER) r.missing++;
        if (!e.AIN_ENTRY_NUMBER) r.missingAin++;
        if (e.DUBAI_ENTRY_NUMBER && e.AIN_ENTRY_NUMBER) r.matched++;
        else r.missingAmount += e.DEBIT + e.CREDIT;
        if (e.ATTACHMENTS_COUNT > 0) r.withFiles++;
      }
      map.set(key, row);
    }
    const rows = Array.from(map.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
    return { rows, total };
  }, [entries]);

  const pct = (part: number, all: number) => (all ? Math.round((part / all) * 100) : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Monthly Summary</h1>
        <p className="text-sm font-semibold text-slate-400">Al Ain ↔ Dubai</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.15em] text-[#D4AF37] text-center">
                <th className="py-4 px-3">Month</th>
                <th className="py-4 px-3">Lines</th>
                <th className="py-4 px-3">Debit</th>
                <th className="py-4 px-3">Credit</th>
                <th className="py-4 px-3">Net</th>
                <th className="py-4 px-3">Matched</th>
                <th className="py-4 px-3">Missing Dubai No</th>
                <th className="py-4 px-3">Missing Al Ain No</th>
                <th className="py-4 px-3">Unmatched Amount</th>
                <th className="py-4 px-3">With Attachments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.length === 0 ? (
                <NoData isTable colSpan={10} title="NO ENTRIES YET" />
              ) : (
                rows.map((r) => <SummaryRow key={r.key} row={r} label={monthLabel(r.key)} pct={pct} />)
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <SummaryRow row={total} label="Total" pct={pct} isTotal />
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ row, label, pct, isTotal = false }: { row: MonthRow; label: string; pct: (a: number, b: number) => number; isTotal?: boolean }) {
  const net = round2(row.debit - row.credit);
  const matchedPct = pct(row.matched, row.lines);
  const filesPct = pct(row.withFiles, row.lines);
  return (
    <tr className={`text-center ${isTotal ? 'bg-slate-50 border-t-2 border-slate-200 font-black' : 'hover:bg-slate-50/70'}`}>
      <td className={`py-3.5 px-3 whitespace-nowrap ${isTotal ? 'text-xs uppercase tracking-[0.15em] text-slate-500' : 'font-bold text-slate-900'}`}>{label}</td>
      <td className="py-3.5 px-3 font-bold text-slate-700">{row.lines.toLocaleString('en-US')}</td>
      <td className="py-3.5 px-3 font-bold text-emerald-700 whitespace-nowrap">{formatAmount(row.debit)}</td>
      <td className="py-3.5 px-3 font-bold text-rose-700 whitespace-nowrap">{formatAmount(row.credit)}</td>
      <td className={`py-3.5 px-3 font-black whitespace-nowrap ${net === 0 ? 'text-slate-900' : 'text-amber-600'}`}>{formatAmount(net)}</td>
      <td className="py-3.5 px-3">
        <div className="flex items-center justify-center gap-2">
          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full ${matchedPct === 100 ? 'bg-emerald-500' : 'bg-[#D4AF37]'}`} style={{ width: `${matchedPct}%` }} />
          </div>
          <span className="text-xs font-black text-slate-700 w-10">{matchedPct}%</span>
        </div>
      </td>
      <td className="py-3.5 px-3">
        {row.missing ? (
          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-black">{row.missing.toLocaleString('en-US')}</span>
        ) : (
          <span className="text-emerald-600 font-black text-xs">✓</span>
        )}
      </td>
      <td className="py-3.5 px-3">
        {row.missingAin ? (
          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-black">{row.missingAin.toLocaleString('en-US')}</span>
        ) : (
          <span className="text-emerald-600 font-black text-xs">✓</span>
        )}
      </td>
      <td className="py-3.5 px-3 font-bold text-amber-700 whitespace-nowrap">{row.missingAmount ? formatAmount(row.missingAmount) : '—'}</td>
      <td className="py-3.5 px-3 text-xs font-black text-slate-600 whitespace-nowrap">
        {row.withFiles.toLocaleString('en-US')} <span className="text-slate-400">({filesPct}%)</span>
      </td>
    </tr>
  );
}
