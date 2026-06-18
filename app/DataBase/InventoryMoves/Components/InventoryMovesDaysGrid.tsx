'use client';

import { Trash2, Calendar } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import { englishMonths } from './InventoryMovesMonthsGrid';

export interface MoveDaySummary {
  date: string;
  day: number;
  count: number;
}

interface Props {
  days: MoveDaySummary[];
  month: number;
  isLoading: boolean;
  canDelete: boolean;
  onOpenDay: (date: string) => void;
  onDeleteDay: (date: string) => void;
}

export default function InventoryMovesDaysGrid({
  days,
  month,
  isLoading,
  canDelete,
  onOpenDay,
  onDeleteDay,
}: Props) {
  if (isLoading && days.length === 0) {
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

  if (days.length === 0) {
    return (
      <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 shadow-sm flex items-center justify-center">
        <NoData title="NO MOVES FOR THIS MONTH" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {days.map((d) => (
        <div
          key={d.date}
          className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-black/5 transition-all duration-300 flex flex-col justify-between h-[180px] cursor-pointer"
          onClick={() => onOpenDay(d.date)}
        >
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-gray-400 tracking-wider font-mono">{englishMonths[month]}</span>
              <h3 className="text-xl font-black text-black mt-1 leading-none">{d.day}</h3>
            </div>
            <div className="bg-gray-50 border border-gray-100/50 px-3 py-1.5 rounded-2xl text-center shrink-0">
              <span className="text-sm font-black text-black">{d.count.toLocaleString()}</span>
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
                  onDeleteDay(d.date);
                }}
                className="p-2.5 bg-red-50 hover:bg-red-500 rounded-xl text-red-500 hover:text-white transition-all border border-transparent hover:border-red-100"
                title="Delete Day Moves"
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
