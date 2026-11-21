'use client';

import NoData from '@/app/Components/DataState/NoDataTab';
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { regionAnalysis, regionExpenseDetail, regionMonthly } from '../Utils/ReportEngine';
import { fmt, monthLabel, pct, type AnalyticType, type ReportLine } from '../Utils/ReportTypes';
import { CARD, TD, TH, THEAD, TITLE, tone } from './ui';

const COLS = ['Region', 'Revenue', 'COGS', 'GM', 'GM %', 'Direct exp.', 'Shared pool', 'Net (booked)', 'Contribution', 'Pool re-spread', 'Net (re-spread)', 'Break-even rev.'];

export default function RegionsTab({ lines, types, months, all }: { lines: ReportLine[]; types: AnalyticType[]; months: string[]; all: string[] }) {
  const res = useMemo(() => regionAnalysis(lines, types, months), [lines, types, months]);
  const monthly = useMemo(() => regionMonthly(lines, types, all), [lines, types, all]);
  const [detail, setDetail] = useState('');
  const det = useMemo(() => (detail ? regionExpenseDetail(lines, types, months, detail) : []), [lines, types, months, detail]);

  const row = (r: typeof res.total, total = false) => (
    <tr key={r.region} onClick={() => !total && setDetail(r.region)} className={total ? 'bg-slate-50 font-black' : 'cursor-pointer hover:bg-amber-50/40'}>
      <td className={`${TD} font-bold text-slate-900`}>{r.region}</td>
      <td className={TD}>{fmt(r.revenue)}</td><td className={TD}>{fmt(r.cogs)}</td><td className={TD}>{fmt(r.gm)}</td><td className={TD}>{pct(r.gmPct)}</td>
      <td className={TD}>{fmt(r.direct)}</td><td className={TD}>{fmt(r.pool)}</td>
      <td className={`${TD} font-bold ${tone(r.netBooked)}`}>{fmt(r.netBooked)}</td>
      <td className={`${TD} ${tone(r.contribution)}`}>{fmt(r.contribution)}</td>
      <td className={TD}>{fmt(r.poolShare)}</td>
      <td className={`${TD} font-bold ${tone(r.netRespread)}`}>{fmt(r.netRespread)}</td>
      <td className={TD}>{r.breakEven ? fmt(r.breakEven) : '—'}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <h1 className={TITLE}>Regions Analysis</h1>
      <p className="text-xs font-semibold text-slate-500">
        Closed months: {months.map(monthLabel).join(' + ')} · income positive, expenses negative · “Shared pool” = costs the system split equally across accounts; “re-spread” distributes it by revenue share · click a region for its expense detail.
      </p>

      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead><tr className={THEAD}>{COLS.map((c) => <th key={c} className={TH}>{c}</th>)}</tr></thead>
            <tbody>
              {res.rows.length === 0 && <NoData isTable colSpan={COLS.length} message="No location accounts in this report — classify them in Analytic Accounts" />}
              {res.rows.map((r) => row(r))}
              {res.rows.length > 0 && row(res.total, true)}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className={CARD}>
          <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100">
            <span className="text-base font-black text-slate-900">{detail} — expenses by GL</span>
            <button onClick={() => setDetail('')} className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead><tr className={THEAD}>{['Code', 'Expense', 'Direct', 'Shared pool', 'Total'].map((c) => <th key={c} className={TH}>{c}</th>)}</tr></thead>
              <tbody>
                {det.length === 0 && <NoData isTable colSpan={5} />}
                {det.map((d) => <tr key={d.code}><td className={TD}>{d.code}</td><td className={TD}>{d.name}</td><td className={TD}>{fmt(d.direct)}</td><td className={TD}>{fmt(d.pool)}</td><td className={`${TD} font-bold`}>{fmt(d.direct + d.pool)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className={CARD}>
        <div className="px-5 py-3 text-base font-black text-slate-900 border-b border-slate-100">Monthly net by region (as booked, all months)</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className={THEAD}><th className={TH}>Region</th>{all.map((m) => <th key={m} className={TH}>{monthLabel(m)}</th>)}</tr></thead>
            <tbody>
              {monthly.length === 0 && <NoData isTable colSpan={all.length + 1} />}
              {monthly.map((r) => <tr key={r.region}><td className={`${TD} font-bold text-slate-900`}>{r.region}</td>{r.byMonth.map((x) => <td key={x.month} className={`${TD} ${tone(x.net)}`}>{fmt(x.net)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
