'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserCheck, Info } from 'lucide-react';
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender, SortingState } from '@tanstack/react-table';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import TabLoader from '../../Components/Loading/TabLoader';
import TabFetchError from '../../Components/DataState/TabFetchError';
import { ExportExcelButton, exportSalespersonsExcel } from '../Export/ExportExcel';
import SalespersonDetailsView from './SalespersonDetailsView';
import { useRepCollections, type RepAgg } from './useRepCollections';

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SalespersonsTab() {
  const { paymentsData, repAllocation, repAllocationLoading, repAllocationError, loadRepAllocation } = usePaymentAnalysis();
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'net', desc: true }]);
  const [selectedRep, setSelectedRep] = useState<string | null>(null);

  // how payments are split between reps comes from the server (same rules as Salesperson Analysis)
  useEffect(() => {
    if (!repAllocation && !repAllocationLoading && !repAllocationError) void loadRepAllocation();
  }, [repAllocation, repAllocationLoading, repAllocationError, loadRepAllocation]);

  const reps = useRepCollections(paymentsData, repAllocation);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return q ? reps.filter((r) => r.rep.toLowerCase().includes(q)) : reps;
  }, [reps, searchTerm]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => ({ net: acc.net + r.net, payments: acc.payments + r.paymentCount }),
        { net: 0, payments: 0 },
      ),
    [filtered],
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: 'rep',
        header: 'Salesperson',
        cell: (info: any) => (
          <div className="flex items-center gap-2 justify-center">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-800">{info.getValue()}</span>
          </div>
        ),
      },
      {
        accessorKey: 'net',
        header: 'Net Collection',
        cell: (info: any) => <span className="font-mono font-black text-[#D4AF37] text-base">{money(info.getValue())}</span>,
      },
      {
        accessorKey: 'share',
        header: 'Share',
        cell: (info: any) => (
          <div className="flex items-center gap-2 justify-center min-w-[110px]">
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#D4AF37] rounded-full" style={{ width: `${Math.max(0, Math.min(100, info.getValue()))}%` }} />
            </div>
            <span className="font-mono font-semibold text-slate-600 text-xs">{(info.getValue() as number).toFixed(1)}%</span>
          </div>
        ),
      },
      {
        accessorKey: 'paymentCount',
        header: 'Payments',
        cell: (info: any) => <span className="font-mono font-semibold text-emerald-600">{(info.getValue() as number).toLocaleString()}</span>,
      },
      {
        accessorKey: 'customerCount',
        header: 'Customers',
        cell: (info: any) => <span className="font-mono font-bold text-slate-700">{(info.getValue() as number).toLocaleString()}</span>,
      },
      {
        accessorKey: 'averagePayment',
        header: 'Average Payment',
        cell: (info: any) => <span className="font-mono font-semibold text-indigo-600">{money(info.getValue())}</span>,
      },
      {
        accessorKey: 'monthlyAverage',
        header: 'Monthly Average',
        cell: (info: any) => <span className="font-mono font-semibold text-emerald-600">{money(info.getValue())}</span>,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selected: RepAgg | undefined = selectedRep ? reps.find((r) => r.rep === selectedRep) : undefined;
  if (selected) {
    return <SalespersonDetailsView rep={selected} onBack={() => setSelectedRep(null)} />;
  }

  if (repAllocationError && !repAllocation) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <TabFetchError message={repAllocationError} onRetry={() => void loadRepAllocation()} isRetrying={repAllocationLoading} />
      </div>
    );
  }
  if (!repAllocation) return <TabLoader className="!min-h-[50vh]" />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Salesperson Collections</h2>

        <div className="flex items-center gap-2 relative">
          <ExportExcelButton
            onExport={() =>
              exportSalespersonsExcel(
                filtered.map((r) => ({
                  rep: r.rep,
                  netCollection: r.net,
                  share: r.share,
                  payments: r.paymentCount,
                  customers: r.customerCount,
                  averagePayment: r.averagePayment,
                  monthlyAverage: r.monthlyAverage,
                })),
              )
            }
            disabled={filtered.length === 0}
            title="Export Salespersons to Excel"
          />
          <div className="relative">
            <input
              type="text"
              placeholder="Search salespersons..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-80 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {repAllocation.mode === 'self' && (
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-slate-100 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 shrink-0" />
          You see your own share of the collections only.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase text-white font-bold tracking-[0.1em] bg-slate-900 text-center">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-5 cursor-pointer hover:text-[#D4AF37] transition-colors whitespace-nowrap text-center"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="text-center divide-y divide-slate-50">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                    No salespersons found.
                  </td>
                </tr>
              ) : (
                <>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRep(row.original.rep)}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-6 py-4 text-slate-600 text-center group-hover:text-slate-900 transition-colors">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-black border-t-2 border-slate-200 text-sm">
                    <td className="px-6 py-5 text-slate-800 uppercase tracking-wider text-center">Total</td>
                    <td className="px-6 py-5 font-mono text-slate-900 text-center">{money(totals.net)}</td>
                    <td className="px-6 py-5" />
                    <td className="px-6 py-5 font-mono text-emerald-700 text-center">{totals.payments.toLocaleString()}</td>
                    <td className="px-6 py-5" />
                    <td className="px-6 py-5 font-mono text-indigo-700 text-center">
                      {money(totals.payments ? totals.net / totals.payments : 0)}
                    </td>
                    <td className="px-6 py-5" />
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
