'use client';

import React, { useMemo, useState } from 'react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';
import { Calendar, CalendarDays, CalendarRange, CalendarClock } from 'lucide-react';
import PeriodDetailsView from './PeriodDetailsView';

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function PeriodsTab() {
  const { paymentsData } = usePaymentAnalysis();
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'sortKey', desc: true }]);
  const [selectedPeriod, setSelectedPeriod] = useState<{ sortKey: string, label: string } | null>(null);

  const getWeekNumber = (d: Date) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  const aggregatedData = useMemo(() => {
    const map = new Map<string, { sortKey: string, label: string, collected: number, refunded: number }>();

    paymentsData.forEach(row => {
      if (!row.date) return;
      const d = new Date(row.date);
      if (isNaN(d.getTime())) return;

      const category = getPaymentCategory(row);
      if (category === 'Other') return;

      const isRefund = category === 'Refund';
      const amount = isRefund ? (Number(row.debit) || 0) : (Number(row.credit) || 0);

      let sortKey = '';
      let label = '';

      if (periodType === 'daily') {
        sortKey = d.toISOString().split('T')[0];
        label = d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      } else if (periodType === 'weekly') {
        const w = getWeekNumber(d);
        const y = d.getFullYear();
        sortKey = `${y}-W${w.toString().padStart(2, '0')}`;
        label = `Week ${w}, ${y}`;
      } else if (periodType === 'monthly') {
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        sortKey = `${y}-${m.toString().padStart(2, '0')}`;
        label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      } else if (periodType === 'yearly') {
        sortKey = `${d.getFullYear()}`;
        label = `${d.getFullYear()}`;
      }

      if (!map.has(sortKey)) {
        map.set(sortKey, { sortKey, label, collected: 0, refunded: 0 });
      }

      const entry = map.get(sortKey)!;
      if (isRefund) {
        entry.refunded += amount;
      } else {
        entry.collected += amount;
      }
    });

    return Array.from(map.values()).map(entry => ({
      ...entry,
      netCollection: entry.collected - entry.refunded
    }));
  }, [paymentsData, periodType]);

  const totals = useMemo(() => {
    return aggregatedData.reduce((acc, curr) => ({
      collected: acc.collected + curr.collected,
      refunded: acc.refunded + curr.refunded,
      net: acc.net + curr.netCollection
    }), { collected: 0, refunded: 0, net: 0 });
  }, [aggregatedData]);

  const columns = useMemo(() => [
    {
      accessorKey: 'sortKey',
      header: 'Sort',
    },
    {
      accessorKey: 'label',
      header: 'Period',
      cell: (info: any) => (
        <span className="font-bold text-slate-800 tracking-wide">{info.getValue()}</span>
      )
    },
    {
      accessorKey: 'collected',
      header: 'Collected Amount',
      cell: (info: any) => (
        <span className="font-mono font-semibold text-emerald-600">
          {(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      accessorKey: 'refunded',
      header: 'Refunded / Bounced',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={`font-mono font-semibold ${val > 0 ? 'text-red-500' : 'text-slate-400'}`}>
            {val > 0 ? '-' : ''}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      accessorKey: 'netCollection',
      header: 'Net Collection',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={`font-mono font-black text-lg ${val > 0 ? 'text-emerald-600' : val < 0 ? 'text-red-500' : 'text-slate-800'}`}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    }
  ], []);

  const table = useReactTable({
    data: aggregatedData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      columnVisibility: { sortKey: false }
    }
  });

  const periodOptions = [
    { id: 'daily', label: 'Daily', icon: CalendarDays },
    { id: 'weekly', label: 'Weekly', icon: CalendarRange },
    { id: 'monthly', label: 'Monthly', icon: Calendar },
    { id: 'yearly', label: 'Yearly', icon: CalendarClock },
  ] as const;

  if (selectedPeriod) {
    return (
      <PeriodDetailsView
        periodType={periodType}
        sortKey={selectedPeriod.sortKey}
        periodLabel={selectedPeriod.label}
        onBack={() => setSelectedPeriod(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Periods Analysis</h2>
        
        <div className="flex bg-slate-200/50 p-1 rounded-xl">
          {periodOptions.map(opt => {
            const Icon = opt.icon;
            const isActive = periodType === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPeriodType(opt.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                  isActive 
                    ? 'bg-white text-indigo-700 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-white font-bold tracking-[0.1em] bg-slate-900 text-center">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-6 py-5 cursor-pointer hover:text-[#D4AF37] transition-colors whitespace-nowrap text-center" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="text-center">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No data found for the selected period.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id} 
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedPeriod({ sortKey: row.original.sortKey, label: row.original.label })}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-slate-600 text-center">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {table.getRowModel().rows.length > 0 && (
              <tfoot className="bg-slate-50 border-t border-slate-100 text-center">
                <tr>
                  <td className="px-6 py-4 font-black uppercase text-xs text-slate-500 tracking-wider">
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-emerald-600 text-base">
                    {totals.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-red-500 text-base">
                    {totals.refunded > 0 ? '-' : ''}{totals.refunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 font-mono font-black text-lg text-slate-800">
                    {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
