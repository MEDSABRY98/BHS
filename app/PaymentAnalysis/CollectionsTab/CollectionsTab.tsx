'use client';

import React, { useMemo, useState } from 'react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { Search, Tags, Users, UserX } from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';
import CustomerDetailsView from './CustomerDetailsView';
import { ExportExcelButton, exportCollectionsExcel } from '../Export/ExportExcel';

export default function CollectionsTab() {
  const { paymentsData } = usePaymentAnalysis();
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'netCollection', desc: true }]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string, name: string } | null>(null);
  const [viewMode, setViewMode] = useState<'DEFAULT' | 'NO TAGS' | 'TAGS ONLY'>('DEFAULT');

  const aggregatedData = useMemo(() => {
    const map = new Map<string, { customerId: string, customerName: string, city: string, collected: number, refunded: number, tags: string[], paymentDates: string[] }>();

    paymentsData.forEach(row => {
      const category = getPaymentCategory(row);
      const customerId = row.customerId || 'UNKNOWN';
      const customerName = row.customerName || 'Unknown Customer';
      const city = row.city || 'Unknown';

      if (!map.has(customerId)) {
        const tags = row.customerTag ? row.customerTag.split(',').map(t => t.trim()).filter(Boolean) : [];
        map.set(customerId, { customerId, customerName, city, collected: 0, refunded: 0, tags, paymentDates: [] });
      }

      const entry = map.get(customerId)!;

      if (category === 'Payment') {
        entry.collected += (Number(row.credit) || 0);
        if (row.date) entry.paymentDates.push(row.date);
      } else if (category === 'Refund') {
        entry.refunded += (Number(row.debit) || 0);
      }
    });

    return Array.from(map.values()).map(entry => {
      let freqDays: number | null = null;
      if (entry.paymentDates.length > 1) {
        const sorted = entry.paymentDates.map(d => new Date(d).getTime()).sort((a,b) => a - b);
        const diffMs = sorted[sorted.length - 1] - sorted[0];
        freqDays = diffMs / (1000 * 60 * 60 * 24) / (sorted.length - 1);
      }
      return {
        ...entry,
        netCollection: entry.collected - entry.refunded,
        paymentFrequencyDays: freqDays
      };
    });
  }, [paymentsData]);

  const filteredData = useMemo(() => {
    let data = aggregatedData;
    
    if (viewMode === 'NO TAGS') {
      data = data.filter(item => item.tags.length === 0);
    } else if (viewMode === 'TAGS ONLY') {
      data = data.filter(item => item.tags.length > 0);
    }

    if (!searchTerm.trim()) return data;
    const q = searchTerm.toLowerCase();
    return data.filter(item => 
      item.customerName.toLowerCase().includes(q) || 
      item.customerId.toLowerCase().includes(q)
    );
  }, [aggregatedData, searchTerm, viewMode]);

  const groupedTags = useMemo(() => {
    if (viewMode !== 'TAGS ONLY') return [];
    
    const taggedCustomers = filteredData; // Already filtered above
    const groups: Record<string, typeof taggedCustomers> = {};

    taggedCustomers.forEach(c => {
      c.tags.forEach(tag => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(c);
      });
    });

    return Object.keys(groups).sort().map(tag => {
      const rows = groups[tag];
      rows.sort((a, b) => b.netCollection - a.netCollection);
      return { tag, rows };
    });
  }, [filteredData, viewMode]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      collected: acc.collected + curr.collected,
      refunded: acc.refunded + curr.refunded,
      net: acc.net + curr.netCollection
    }), { collected: 0, refunded: 0, net: 0 });
  }, [filteredData]);

  const columns = useMemo(() => [
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: (info: any) => (
        <div className="flex flex-col items-center justify-center">
          <span className="font-bold text-slate-800 text-center">{info.row.original.customerName}</span>
        </div>
      )
    },
    {
      accessorKey: 'city',
      header: 'City',
      cell: (info: any) => (
        <span className="text-sm font-semibold text-slate-500">{info.getValue() || 'Unknown'}</span>
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
    },
    {
      accessorKey: 'paymentFrequencyDays',
      header: 'Pay Frequency',
      cell: (info: any) => {
        const val = info.getValue() as number | null;
        if (val === null) return <span className="text-slate-400 text-xs">-</span>;
        
        let colorClass = 'text-emerald-600';
        if (val > 30) colorClass = 'text-orange-500';
        if (val > 60) colorClass = 'text-red-500';

        return (
          <span className={`font-mono font-semibold text-sm ${colorClass}`}>
            Every {Math.round(val)} Days
          </span>
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

  if (selectedCustomer) {
    return (
      <CustomerDetailsView 
        customerId={selectedCustomer.id}
        customerName={selectedCustomer.name}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Customer Collections</h2>
          
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setViewMode('DEFAULT')}
              className={`flex justify-center items-center gap-2 w-32 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'DEFAULT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>All</span>
            </button>
            <button
              onClick={() => setViewMode('NO TAGS')}
              className={`flex justify-center items-center gap-2 w-32 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'NO TAGS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <UserX className="w-4 h-4" />
              <span>No Tags</span>
            </button>
            <button
              onClick={() => setViewMode('TAGS ONLY')}
              className={`flex justify-center items-center gap-2 w-32 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'TAGS ONLY' ? 'bg-white text-[#D4AF37] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Tags className="w-4 h-4" />
              <span>By Tag</span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 relative">
          <ExportExcelButton
            onExport={() => exportCollectionsExcel(filteredData)}
            disabled={filteredData.length === 0}
            title="Export Collections to Excel"
          />
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex flex-col justify-center">
          <span className="font-bold text-emerald-600 uppercase tracking-wider text-xs mb-1">Total Collected</span>
          <span className="font-black text-2xl text-emerald-700">
            {totals.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex flex-col justify-center">
          <span className="font-bold text-red-600 uppercase tracking-wider text-xs mb-1">Total Refunded/Bounced</span>
          <span className="font-black text-2xl text-red-700">
            {totals.refunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-center shadow-lg">
          <span className="font-bold text-slate-300 uppercase tracking-wider text-xs mb-1">Net Collections</span>
          <span className="font-black text-3xl text-white">
            {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          {viewMode === 'TAGS ONLY' ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-white font-bold tracking-[0.1em] bg-slate-900 text-center">
                <tr>
                  <th className="px-6 py-5 whitespace-nowrap">Customer Name</th>
                  <th className="px-6 py-5 whitespace-nowrap">City</th>
                  <th className="px-6 py-5 whitespace-nowrap">Collected Amount</th>
                  <th className="px-6 py-5 whitespace-nowrap">Refunded / Bounced</th>
                  <th className="px-6 py-5 whitespace-nowrap">Net Collection</th>
                  <th className="px-6 py-5 whitespace-nowrap">Pay Frequency</th>
                </tr>
              </thead>
              <tbody className="text-center divide-y divide-slate-50">
                {groupedTags.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No tagged customers found.
                    </td>
                  </tr>
                ) : (
                  groupedTags.map(({ tag, rows }) => {
                    const tagTotalCollected = rows.reduce((sum, r) => sum + r.collected, 0);
                    const tagTotalRefunded = rows.reduce((sum, r) => sum + r.refunded, 0);
                    const tagTotalNet = rows.reduce((sum, r) => sum + r.netCollection, 0);

                    return (
                      <React.Fragment key={tag}>
                        {/* Tag Header */}
                        <tr className="bg-slate-100 border-y border-slate-200">
                          <td colSpan={2} className="px-6 py-3 text-left">
                            <div className="flex items-center gap-2">
                              <Tags className="w-4 h-4 text-slate-500" />
                              <span className="font-black text-slate-800">{tag}</span>
                              <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{rows.length} Customers</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 font-mono font-bold text-emerald-700">
                            {tagTotalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-3 font-mono font-bold text-red-600">
                            {tagTotalRefunded > 0 ? '-' : ''}{tagTotalRefunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-3 font-mono font-black text-[#D4AF37]">
                            {tagTotalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-3"></td>
                        </tr>
                        {/* Tag Customers */}
                        {rows.map(row => (
                          <tr 
                            key={row.customerId} 
                            onClick={() => setSelectedCustomer({ id: row.customerId, name: row.customerName })}
                            className="hover:bg-slate-50/50 transition-colors cursor-pointer group border-b border-slate-50"
                          >
                            <td className="px-6 py-4 text-slate-800 font-bold text-left pl-12 group-hover:text-[#D4AF37] transition-colors">
                              <span>{row.customerName}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-semibold text-center text-sm">
                              {row.city}
                            </td>
                            <td className="px-6 py-4 font-mono font-semibold text-emerald-600 text-center">
                              {row.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 font-mono font-semibold text-center text-red-500">
                              {row.refunded > 0 ? '-' : ''}{row.refunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 font-mono font-black text-center text-slate-900 group-hover:text-[#D4AF37] transition-colors">
                              {row.netCollection.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {(() => {
                                const val = row.paymentFrequencyDays;
                                if (val === null) return <span className="text-slate-400 text-xs">-</span>;
                                let colorClass = 'text-emerald-600';
                                if (val > 30) colorClass = 'text-orange-500';
                                if (val > 60) colorClass = 'text-red-500';
                                return (
                                  <span className={`font-mono font-semibold text-sm ${colorClass}`}>
                                    Every {Math.round(val)} Days
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
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
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-medium">
                      No collection data found.
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map(row => (
                    <tr 
                      key={row.id} 
                      className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedCustomer({ id: row.original.customerId, name: row.original.customerName })}
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
                    <td colSpan={2} className="px-6 py-4 font-black uppercase text-xs text-slate-500 tracking-wider">
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
                    <td className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
