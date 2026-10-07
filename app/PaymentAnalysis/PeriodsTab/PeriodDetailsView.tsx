import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, Info, X } from 'lucide-react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';

interface PeriodDetailsViewProps {
  periodType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  sortKey: string;
  periodLabel: string;
  onBack: () => void;
}

const getWeekNumber = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export default function PeriodDetailsView({ periodType, sortKey, periodLabel, onBack }: PeriodDetailsViewProps) {
  const { paymentsData } = usePaymentAnalysis();
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [selectedDesc, setSelectedDesc] = useState<string | null>(null);

  const tableData = useMemo(() => {
    return paymentsData
      .filter(row => {
        if (!row.date) return false;
        const d = new Date(row.date);
        if (isNaN(d.getTime())) return false;

        let rowSortKey = '';
        if (periodType === 'daily') {
          rowSortKey = d.toISOString().split('T')[0];
        } else if (periodType === 'weekly') {
          const w = getWeekNumber(d);
          const y = d.getFullYear();
          rowSortKey = `${y}-W${w.toString().padStart(2, '0')}`;
        } else if (periodType === 'monthly') {
          const m = d.getMonth() + 1;
          const y = d.getFullYear();
          rowSortKey = `${y}-${m.toString().padStart(2, '0')}`;
        } else if (periodType === 'yearly') {
          rowSortKey = `${d.getFullYear()}`;
        }
        return rowSortKey === sortKey && getPaymentCategory(row) !== 'Other';
      })
      .map(row => {
        const category = getPaymentCategory(row);
        const isRefund = category === 'Refund';
        const amount = isRefund ? -(Number(row.debit) || 0) : (Number(row.credit) || 0);

        return {
          id: row.id,
          date: row.date ? String(row.date).split('T')[0] : '',
          customerName: row.customerName || 'Unknown Customer',
          description: [row.number, row.matching].filter(Boolean).join(' | '),
          amount,
        };
      });
  }, [paymentsData, periodType, sortKey]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return tableData;
    const q = searchTerm.toLowerCase();
    return tableData.filter(item => 
      item.customerName.toLowerCase().includes(q) || 
      item.description.toLowerCase().includes(q) || 
      item.date.includes(q)
    );
  }, [tableData, searchTerm]);

  const stats = useMemo(() => {
    let totalCollected = 0;
    let paymentCount = 0;
    const daysSet = new Set<string>();

    tableData.forEach(item => {
      if (item.amount > 0) {
        totalCollected += item.amount;
        paymentCount++;
      } else {
        totalCollected += item.amount; // Refunds reduce total
      }
      if (item.date) {
        daysSet.add(item.date);
      }
    });

    const numDays = Math.max(1, daysSet.size);
    const dailyAverage = totalCollected / numDays;
    const averagePayment = paymentCount > 0 ? totalCollected / paymentCount : 0;

    return {
      totalCollected,
      dailyAverage,
      averagePayment
    };
  }, [tableData]);

  const columns = useMemo(() => [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: (info: any) => (
        <span className="font-semibold text-slate-700">{info.getValue() || '-'}</span>
      )
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: (info: any) => (
        <span className="font-bold text-slate-800">{info.getValue()}</span>
      )
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={`font-mono font-black text-sm ${val < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      accessorKey: 'description',
      header: 'Info',
      cell: (info: any) => {
        const desc = info.getValue() as string;
        if (!desc) return <span className="text-slate-400">-</span>;
        return (
          <button 
            onClick={() => setSelectedDesc(desc)}
            className="p-1.5 bg-slate-100 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 rounded-full transition-colors mx-auto block"
            title="View Details"
          >
            <Info className="w-4 h-4" />
          </button>
        );
      }
    }
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{periodLabel}</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Period Transactions Detail</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-sm">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-1">Total Collections</span>
          <span className="font-black text-2xl text-slate-800">
            {stats.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-sm">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-1">Daily Average</span>
          <span className="font-black text-2xl text-indigo-600">
            {stats.dailyAverage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col justify-center shadow-sm">
          <span className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-1">Average Payment</span>
          <span className="font-black text-2xl text-emerald-600">
            {stats.averagePayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="relative w-full sm:w-80">
          <input 
            type="text" 
            placeholder="Search customer, date or description..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
            <tbody className="text-center divide-y divide-slate-50">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No transactions match your search.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className={`px-6 py-4 text-slate-600 text-center ${cell.column.id === 'description' ? 'whitespace-normal max-w-xs' : 'whitespace-nowrap'}`}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
      </div>
    </div>

      {selectedDesc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Transaction Details</h3>
              <button 
                onClick={() => setSelectedDesc(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                {selectedDesc}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
