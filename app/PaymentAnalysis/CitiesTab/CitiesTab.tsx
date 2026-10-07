'use client';

import React, { useMemo, useState } from 'react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { Search, MapPin } from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';
import CityDetailsView from './CityDetailsView';

export default function CitiesTab() {
  const { paymentsData } = usePaymentAnalysis();
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'netCollection', desc: true }]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const aggregatedData = useMemo(() => {
    const map = new Map<string, { 
      city: string, 
      netCollection: number, 
      monthsSet: Set<string>, 
      paymentCount: number,
      customerMonthsSet: Set<string> 
    }>();

    paymentsData.forEach(row => {
      const city = (row.city || 'UNKNOWN').trim();
      if (!city) return;

      const category = getPaymentCategory(row);
      
      if (!map.has(city)) {
        map.set(city, { city, netCollection: 0, monthsSet: new Set(), paymentCount: 0, customerMonthsSet: new Set() });
      }
      
      const entry = map.get(city)!;
      
      const amount = category === 'Payment' ? (Number(row.credit) || 0) : category === 'Refund' ? -(Number(row.debit) || 0) : 0;
      if (amount === 0 && category !== 'Payment') return;

      entry.netCollection += amount;
      
      if (category === 'Payment') {
        entry.paymentCount += 1;
      }

      if (row.date) {
        const d = new Date(row.date);
        if (!isNaN(d.getTime())) {
          const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
          entry.monthsSet.add(monthKey);
          
          if (row.customerId) {
            entry.customerMonthsSet.add(`${row.customerId}-${monthKey}`);
          }
        }
      }
    });

    return Array.from(map.values()).map(entry => {
      const months = entry.monthsSet.size || 1;
      return {
        city: entry.city,
        netCollection: entry.netCollection,
        monthlyAverage: entry.netCollection / months,
        averagePayment: entry.paymentCount > 0 ? entry.netCollection / entry.paymentCount : 0,
        avgCustomersPerMonth: entry.customerMonthsSet.size / months
      };
    });
  }, [paymentsData]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return aggregatedData;
    const q = searchTerm.toLowerCase();
    return aggregatedData.filter(item => 
      item.city.toLowerCase().includes(q)
    );
  }, [aggregatedData, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      netCollection: acc.netCollection + curr.netCollection,
      monthlyAverage: acc.monthlyAverage + curr.monthlyAverage,
      averagePayment: acc.averagePayment + curr.averagePayment,
      avgCustomersPerMonth: acc.avgCustomersPerMonth + curr.avgCustomersPerMonth
    }), { netCollection: 0, monthlyAverage: 0, averagePayment: 0, avgCustomersPerMonth: 0 });
  }, [filteredData]);

  const columns = useMemo(() => [
    {
      accessorKey: 'city',
      header: 'City',
      cell: (info: any) => (
        <div className="flex items-center gap-2 justify-center">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-800">{info.getValue()}</span>
        </div>
      )
    },
    {
      accessorKey: 'netCollection',
      header: 'Net Collection',
      cell: (info: any) => (
        <span className="font-mono font-black text-[#D4AF37] text-base">
          {(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      accessorKey: 'monthlyAverage',
      header: 'Monthly Average',
      cell: (info: any) => (
        <span className="font-mono font-semibold text-emerald-600">
          {(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      accessorKey: 'averagePayment',
      header: 'Average Payment',
      cell: (info: any) => (
        <span className="font-mono font-semibold text-indigo-600">
          {(info.getValue() as number).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      accessorKey: 'avgCustomersPerMonth',
      header: 'Avg Customers/Month',
      cell: (info: any) => (
        <span className="font-mono font-bold text-slate-700">
          {Math.round(info.getValue() as number).toLocaleString()}
        </span>
      )
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

  if (selectedCity) {
    return (
      <CityDetailsView 
        cityName={selectedCity} 
        onBack={() => setSelectedCity(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Cities Collections</h2>
        
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search cities..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-80 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
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
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No cities found for this search.
                  </td>
                </tr>
              ) : (
                <>
                  {table.getRowModel().rows.map(row => (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedCity(row.original.city)}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 text-slate-600 text-center group-hover:text-slate-900 transition-colors">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-50 font-black border-t-2 border-slate-200 text-sm">
                    <td className="px-6 py-5 text-slate-800 uppercase tracking-wider text-center">Total</td>
                    <td className="px-6 py-5 font-mono text-slate-900 text-center">
                      {totals.netCollection.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 font-mono text-emerald-700 text-center">
                      {totals.monthlyAverage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 font-mono text-indigo-700 text-center">
                      {totals.averagePayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 font-mono text-slate-700 text-center">
                      {Math.round(totals.avgCustomersPerMonth).toLocaleString()}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
