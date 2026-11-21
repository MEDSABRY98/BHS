'use client';

import NoData from '@/app/Components/DataState/NoDataTab';
import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { hqAnalysis } from '../Utils/ReportEngine';
import { fmt, monthLabel, type AnalyticType, type ReportLine } from '../Utils/ReportTypes';
import { CARD, TD, TH, THEAD, TITLE, tone } from './ui';

export default function HqTab({ lines, types, months }: { lines: ReportLine[]; types: AnalyticType[]; months: string[] }) {
  const res = useMemo(() => hqAnalysis(lines, types, months), [lines, types, months]);
  const [open, setOpen] = useState('');
  return (
    <div className="space-y-6">
      <h1 className={TITLE}>HQ / Central</h1>
      <p className="text-xs font-semibold text-slate-500">Analytic accounts classified as HQ (not tied to a location) · click a row for its GL breakdown.</p>
      <div className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr className={THEAD}><th className={TH}>Analytic account</th>{months.map((m) => <th key={m} className={TH}>{monthLabel(m)}</th>)}<th className={TH}>Revenue</th><th className={TH}>Costs</th><th className={TH}>Net</th></tr></thead>
            <tbody>
              {res.rows.length === 0 && <NoData isTable colSpan={months.length + 4} message="No HQ accounts in this report" />}
              {res.rows.map((r) => (
                <Fragment key={r.analytic}>
                  <tr className="cursor-pointer hover:bg-amber-50/40" onClick={() => setOpen(open === r.analytic ? '' : r.analytic)}>
                    <td className={`${TD} font-bold text-slate-900`}><span className="inline-flex items-center gap-1">{open === r.analytic ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}{r.analytic}</span></td>
                    {r.byMonth.map((v, i) => <td key={i} className={`${TD} ${tone(v)}`}>{fmt(v)}</td>)}
                    <td className={TD}>{fmt(r.revenue)}</td><td className={TD}>{fmt(r.costs)}</td>
                    <td className={`${TD} font-black ${tone(r.total)}`}>{fmt(r.total)}</td>
                  </tr>
                  {open === r.analytic && r.gl.map((g) => (
                    <tr key={r.analytic + g.code} className="bg-slate-50/70">
                      <td className={`${TD} !text-xs text-slate-600`}>{g.code} · {g.name}</td>
                      <td className={TD} colSpan={months.length + 2} />
                      <td className={`${TD} !text-xs ${tone(g.total)}`}>{fmt(g.total)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {res.rows.length > 0 && (
                <tr className="bg-slate-50 font-black"><td className={TD}>Total</td><td className={TD} colSpan={months.length + 2} /><td className={`${TD} ${tone(res.total)}`}>{fmt(res.total)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
