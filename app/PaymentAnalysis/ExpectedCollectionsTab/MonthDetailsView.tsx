'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, Info, X } from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';

interface MonthDetailsViewProps {
  month: any;
  onBack: () => void;
}

export default function MonthDetailsView({ month, onBack }: MonthDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<'source_months' | 'customers'>('source_months');
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'amount', desc: true }]);
  const [popupMonths, setPopupMonths] = useState<string | null>(null);


  const sourceMonthsData = useMemo(() => {
    if (!month.sourceMonthsTotals) return [];
    return Object.entries(month.sourceMonthsTotals)
      .map(([name, amt]) => ({ name, amount: amt as number }))
      .sort((a, b) => {
        if (a.name === 'Unknown') return 1;
        if (b.name === 'Unknown') return -1;
        const [m1, y1] = a.name.split(' ');
        const [m2, y2] = b.name.split(' ');
        const d1 = new Date(`${m1} 1, 20${y1}`);
        const d2 = new Date(`${m2} 1, 20${y2}`);
        return d2.getTime() - d1.getTime();
      });
  }, [month.sourceMonthsTotals]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return month.customers;
    const lower = searchTerm.toLowerCase();
    return month.customers.filter((c: any) => 
      c.customer['CUSTOMER NAME']?.toLowerCase().includes(lower) || 
      c.customer['CUSTOMER ID']?.toLowerCase().includes(lower) ||
      c.customer['CITY']?.toLowerCase().includes(lower)
    );
  }, [month.customers, searchTerm]);

  const totals = useMemo(() => {
    return filteredCustomers.reduce((sum: number, c: any) => sum + c.amount, 0);
  }, [filteredCustomers]);

  const columns = useMemo(() => [
    {
      accessorFn: (row: any) => row.customer['CUSTOMER ID'],
      id: 'CUSTOMER ID',
      header: 'Customer ID',
      cell: (info: any) => (
        <span className="font-mono text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-md text-xs border border-indigo-100">
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorFn: (row: any) => row.customer['CUSTOMER NAME'],
      id: 'CUSTOMER NAME',
      header: 'Customer Name',
      cell: (info: any) => (
        <span className="font-bold text-slate-800 tracking-wide">
          {info.getValue() || 'Unknown'}
        </span>
      ),
    },
    {
      accessorFn: (row: any) => row.customer['CITY'],
      id: 'CITY',
      header: 'City',
      cell: (info: any) => (
        <span className="font-medium text-slate-600">
          {info.getValue() || '-'}
        </span>
      ),
    },
    {
      accessorFn: (row: any) => Number(row.customer['PAYMENT TERM']) || 0,
      id: 'PAYMENT TERM',
      header: 'Payment Term',
      cell: (info: any) => (
        <span className="font-mono font-medium text-slate-500">
          {info.getValue()} Days
        </span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Expected Collection',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={`font-mono font-black text-lg ${val > 0 ? 'text-indigo-600' : val < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      accessorFn: (row: any) => row.sourceMonths,
      id: 'sourceMonths',
      header: 'Billed In',
      cell: (info: any) => {
        const val = info.getValue();
        if (!val) return <span className="text-slate-400">-</span>;
        return (
          <button 
            onClick={() => setPopupMonths(val)}
            title="View Source Months"
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex items-center justify-center"
          >
            <Info className="w-5 h-5" />
          </button>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data: filteredCustomers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] border border-slate-200 w-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2.5 flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl transition-all border border-transparent hover:border-indigo-100 bg-white shadow-sm"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                Expected Collections in {month.monthName}
              </h3>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {filteredCustomers.length} customer(s) to pay
              </p>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('source_months')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'source_months' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Billed Months
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'customers' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Customers List
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-48 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <div className="flex-1 bg-slate-50/20 relative">
        {activeTab === 'source_months' ? (
          <div className="p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {sourceMonthsData.map(sm => (
                <div key={sm.name} className="bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className="text-slate-400 font-bold uppercase tracking-[0.15em] text-sm mb-4">
                    {sm.name}
                  </div>
                  <div className="text-2xl font-black text-indigo-600">
                    {sm.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-2 bg-slate-50 px-2 py-1 rounded-full uppercase tracking-wider">
                    Billed Amount
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <table className="w-full text-sm text-center">
          <thead className="text-xs uppercase text-slate-500 font-bold bg-slate-100 sticky top-0 z-10 shadow-sm">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-indigo-50/30 transition-colors bg-white">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      
      <div className="bg-slate-100 p-6 border-t border-slate-200 flex items-center justify-between shrink-0">
        <span className="font-black uppercase text-slate-800 text-sm tracking-widest">
          Total for {month.monthName}
        </span>
        <span className={`font-black text-2xl ${totals > 0 ? 'text-indigo-600' : totals < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
          {totals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
        </span>
      </div>

      {popupMonths && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setPopupMonths(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Info className="w-5 h-5 text-indigo-500" />
                Source Invoices
              </h4>
              <button onClick={() => setPopupMonths(null)} className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-slate-700 font-medium leading-relaxed">
              
              <div className="mt-4 flex flex-wrap gap-2">
                {popupMonths.split(',').map((m, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 font-bold text-sm rounded-lg border border-indigo-100">
                    {m.trim()}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
