'use client';

// One card per month; the PDF icon downloads that month's customers (salesperson first, then customer).

import NoData from '@/app/Components/DataState/NoDataTab';
import { UseRoi } from '../Context/RoiContext';
import { FullMonthLabel, bySalespersonThenCustomer } from '../Utils/RoiCalc';
import { PdfIconButton, Stat, money, shortMoney, sumOf } from '../Utils/Mini';

export default function MonthsTab() {
  const { months } = UseRoi();

  if (!months.length) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <NoData title="ADD A CUSTOMER FIRST" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {months.map(({ month, results }) => {
        const s = sumOf(results);
        const spCount = new Set(results.map((r) => r.support.salespersonId)).size;
        const sorted = [...results].sort(bySalespersonThenCustomer);
        return (
          <div key={month} className="bg-white p-5 rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-black text-slate-900 text-lg tracking-tight">{FullMonthLabel(month)}</h4>
                <p className="text-xs font-semibold text-slate-400">
                  {spCount} salesperson{spCount > 1 ? 's' : ''} • {results.length} customer{results.length > 1 ? 's' : ''}
                </p>
              </div>
              <PdfIconButton results={sorted} fileName={`ROI_${month}`} title={`PDF - ${FullMonthLabel(month)} (by salesperson, then customer)`} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 mt-4 border-t border-slate-100">
              <Stat label="Support" value={money(s.support)} />
              <Stat label="Net sales" value={shortMoney(s.net)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
