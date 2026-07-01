'use client';

import { useMemo } from 'react';
import type { DailySalesCalendar } from '@/app/Sales/Utils/ReportsAggregation';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDayAmount(n: number): string {
  if (!n) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function MonthCalendar({ calendar }: { calendar: DailySalesCalendar }) {
  const gridCells = useMemo(() => {
    const firstDay = new Date(calendar.year, calendar.month - 1, 1);
    const startOffset = firstDay.getDay();
    const cells: Array<{ type: 'empty' } | { type: 'day'; day: DailySalesCalendar['days'][number] }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ type: 'empty' });
    }
    calendar.days.forEach((day) => {
      cells.push({ type: 'day', day });
    });
    return cells;
  }, [calendar]);

  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-slate-600 uppercase tracking-wide">{calendar.monthLabel}</div>

      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-[10px] font-extrabold text-slate-400 uppercase py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {gridCells.map((cell, idx) => {
          if (cell.type === 'empty') {
            return <div key={`empty-${idx}`} className="h-16 sm:h-20 rounded-xl bg-slate-50/40" />;
          }

          const { day } = cell;
          const hasSales = day.inRange && day.amount !== 0;
          const ratio = calendar.maxAmount > 0 ? Math.abs(day.amount) / calendar.maxAmount : 0;

          let boxClass = 'bg-white border border-slate-100';
          let valueClass = 'text-slate-800';

          if (!day.inRange) {
            boxClass = 'bg-slate-50/60 border border-transparent opacity-50';
            valueClass = 'text-slate-300';
          } else if (hasSales) {
            if (day.amount < 0) {
              boxClass = 'bg-rose-50/70 border-rose-100';
              valueClass = 'text-rose-600';
            } else if (ratio < 0.34) {
              boxClass = 'bg-emerald-50/40 border-emerald-100';
              valueClass = 'text-emerald-700';
            } else if (ratio < 0.67) {
              boxClass = 'bg-emerald-50/80 border-emerald-200';
              valueClass = 'text-emerald-700';
            } else {
              boxClass = 'bg-emerald-100/80 border-emerald-300';
              valueClass = 'text-emerald-800';
            }
          }

          return (
            <div
              key={day.date}
              className={`flex flex-col justify-between p-2.5 rounded-xl h-16 sm:h-20 ${boxClass}`}
            >
              <span className="text-[10px] font-black text-slate-400 leading-none">{day.day}</span>
              <span className={`text-xs sm:text-sm font-extrabold leading-none truncate ${valueClass}`}>
                {day.inRange ? fmtDayAmount(day.amount) : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ReportsDailyCalendar({
  calendars,
  amountLabel,
}: {
  calendars: DailySalesCalendar[];
  amountLabel?: string;
}) {
  if (!calendars.length) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-[14px] p-5 shadow-sm">
      <div className="mb-4">
        <div className="text-sm font-bold text-slate-900">Daily Sales</div>
        <div className="text-[11px] text-slate-500">
          {amountLabel ? `${amountLabel} by day` : 'Amount by day'} — calendar view
        </div>
      </div>

      <div className={`grid gap-6 ${calendars.length > 1 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        {calendars.map((calendar) => (
          <MonthCalendar key={`${calendar.year}-${calendar.month}`} calendar={calendar} />
        ))}
      </div>
    </div>
  );
}
