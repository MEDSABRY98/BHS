'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { UseRoi } from '../Context/RoiContext';
import { FullMonthLabel } from '../Utils/RoiCalc';
import { PdfIconButton, SummaryIconButton, Stat, money, shortMoney, sumOf } from '../Utils/Mini';

export default function SalespersonsTab() {
  const { salespersons, months } = UseRoi();
  const [openId, setOpenId] = useState('');
  const open = salespersons.find((s) => s.id === openId);

  // this salesperson's customers, month by month (newest month first)
  const monthCards = useMemo(() => {
    if (!open) return [];
    return months
      .map((g) => ({ month: g.month, results: g.results.filter((r) => r.support.salespersonId === open.id) }))
      .filter((g) => g.results.length > 0);
  }, [open, months]);

  if (!salespersons.length) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <NoData title="ADD A CUSTOMER FIRST" />
      </div>
    );
  }

  // ───────── salesperson → months (details only in the PDF) ─────────
  if (open) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => setOpenId('')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:text-[#B8860B] hover:border-[#D4AF37]"
          >
            <ArrowLeft className="w-4 h-4" />
            Salespersons
          </button>
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">{open.name}</h3>
            <PdfIconButton results={open.results} fileName={`ROI_${open.name}`} title="PDF - all months of this salesperson" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {monthCards.map(({ month, results }) => {
            const s = sumOf(results);
            return (
              <div
                key={month}
                className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] flex flex-col gap-4 min-w-0"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-slate-900 text-lg tracking-tight">{FullMonthLabel(month)}</h4>
                    <p className="text-xs font-semibold text-slate-400">
                      {results.length} customer{results.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <SummaryIconButton
                    results={results}
                    title={`${open.name} - ${FullMonthLabel(month)}`}
                    subtitle={`${results.length} customer${results.length > 1 ? 's' : ''} • summary`}
                    fileName={`ROI_Summary_${open.name}_${month}`}
                    hint={`Summary PDF - ${FullMonthLabel(month)} (one table)`}
                  />
                  <PdfIconButton results={results} fileName={`ROI_${open.name}_${month}`} title={`Download PDF - ${FullMonthLabel(month)} (page per customer)`} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                  <Stat label="Support" value={money(s.support)} />
                  <Stat label="Net sales" value={shortMoney(s.net)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ───────── salespersons ─────────
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {salespersons.map((sp) => {
        const s = sumOf(sp.results);
        return (
          <div
            key={sp.id}
            onClick={() => setOpenId(sp.id)}
            className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] hover:border-[#D4AF37] hover:shadow-lg cursor-pointer transition-all flex flex-col gap-4 min-w-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center font-black shrink-0">
                {sp.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-black text-slate-900 truncate" title={sp.name}>
                  {sp.name}
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  {sp.results.length} customer{sp.results.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <Stat label="Total support" value={money(s.support)} />
              <Stat label="Net sales" value={shortMoney(s.net)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
