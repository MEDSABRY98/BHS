'use client';

import { Trash2, Calendar } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

export interface MoveMonthSummary {
  year: number;
  month: number;
  count: number;
}

const englishMonths: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
  7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December',
};

interface Props {
  months: MoveMonthSummary[];
  isLoading: boolean;
  canDelete: boolean;
  onOpenMonth: (year: number, month: number) => void;
  onDeleteMonth: (year: number, month: number) => void;
}

export default function InventoryMovesMonthsGrid({
  months,
  isLoading,
  canDelete,
  onOpenMonth,
  onDeleteMonth,
}: Props) {
  if (isLoading && months.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {Array(8).fill(0).map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-3xl p-6 border border-gray-100 h-[180px] flex flex-col justify-between">
            <div className="space-y-3">
              <div className="h-4 bg-gray-100 rounded w-1/4" />
              <div className="h-6 bg-gray-100 rounded w-3/4" />
            </div>
            <div className="h-10 bg-gray-100 rounded-xl w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm flex items-center justify-center">
        <NoData title="NO INVENTORY MOVES FOUND" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {months.map((m) => (
        <div
          key={`${m.year}-${m.month}`}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-black/5 transition-all duration-300 flex flex-col justify-between h-[180px] cursor-pointer"
          onClick={() => onOpenMonth(m.year, m.month)}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 tracking-wider font-mono">{m.year}</span>
              <h3 className="text-xl font-black text-black mt-1 leading-none">{englishMonths[m.month]}</h3>
            </div>
            <div className="bg-gray-50 border border-gray-100/50 px-3 py-1.5 rounded-2xl text-center shrink-0">
              <span className="text-sm font-black text-black">{m.count.toLocaleString()}</span>
              <p className="text-[8px] font-black text-gray-400 uppercase tracking-wider mt-0.5">Rows</p>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
              <Calendar className="w-3.5 h-3.5 text-gray-300" />
              <span>Inventory Moves</span>
            </div>
            {canDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteMonth(m.year, m.month);
                }}
                className="p-2.5 bg-red-50 hover:bg-red-500 rounded-xl text-red-500 hover:text-white transition-all border border-transparent hover:border-red-100"
                title="Delete Month Moves"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export { englishMonths };
