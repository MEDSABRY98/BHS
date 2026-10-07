'use client';

import React, { useMemo, useState } from 'react';
import NoData from '../../Components/DataState/NoDataTab';
import { useSuppliersData } from '../Context/SuppliersDataContext';
import { Search, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import { exportStyledExcel } from '../../Components/Export/ExcelExport';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';

export default function AgingTab() {
  const { suppliers, transactions, loading, error } = useSuppliersData();
  const [searchTerm, setSearchTerm] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'SUPPLIER NAME', desc: false }]);

  const agingData = useMemo(() => {
    const dataMap: Record<string, any> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    suppliers.forEach(supp => {
      dataMap[supp['SUPPLIER ID']] = {
        supplier: supp,
        balance: 0,
        notDue: 0,
        bucket_1_30: 0,
        bucket_31_60: 0,
        bucket_61_90: 0,
        bucket_91_120: 0,
        bucket_over_120: 0,
      };
    });

    // Group transactions by supplier
    const supplierTx: Record<string, any[]> = {};
    transactions.forEach(t => {
      if (!t['SUPPLIER ID']) return;
      if (!supplierTx[t['SUPPLIER ID']]) supplierTx[t['SUPPLIER ID']] = [];
      supplierTx[t['SUPPLIER ID']].push(t);
    });

    Object.keys(supplierTx).forEach(suppId => {
      const entry = dataMap[suppId];
      if (!entry) return;

      const supp = entry.supplier;
      const paymentTerm = Number(supp?.['PAYMENT TERM']) || 0;
      
      let unappliedPayments = 0;
      let invoices: { amount: number, dueDate: Date }[] = [];

      supplierTx[suppId].forEach(t => {
        const residual = Number(t['RESIDUAL AMOUNT']) || 0;
        if (residual === 0) return;

        entry.balance += residual;

        if (residual > 0) {
          unappliedPayments += residual;
        } else {
          // Negative residual means an invoice (debt)
          let dueDate = new Date();
          if (t.DATE) {
            const [year, month, day] = String(t.DATE).split('T')[0].split('-');
            const invDate = new Date(Number(year), Number(month) - 1, Number(day));
            if (!isNaN(invDate.getTime())) {
              dueDate = invDate;
              if (paymentTerm > 0) {
                const monthsToAdd = Math.round(paymentTerm / 30);
                dueDate = new Date(invDate.getFullYear(), invDate.getMonth() + monthsToAdd + 1, 1);
              }
              dueDate.setHours(0, 0, 0, 0);
            }
          }
          invoices.push({ amount: -residual, dueDate });
        }
      });

      // Sort invoices by due date (oldest first)
      invoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      // Apply payments to oldest invoices
      for (const inv of invoices) {
        if (unappliedPayments > 0) {
          if (unappliedPayments >= inv.amount) {
            unappliedPayments -= inv.amount;
            inv.amount = 0;
          } else {
            inv.amount -= unappliedPayments;
            unappliedPayments = 0;
          }
        }
      }

      // Distribute remaining invoice amounts to buckets
      invoices.forEach(inv => {
        if (inv.amount <= 0) return;
        
        if (inv.dueDate.getTime() > today.getTime()) {
          entry.notDue -= inv.amount; // Store as negative for debt
        } else {
          const diffTime = today.getTime() - inv.dueDate.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 30) entry.bucket_1_30 -= inv.amount;
          else if (diffDays <= 60) entry.bucket_31_60 -= inv.amount;
          else if (diffDays <= 90) entry.bucket_61_90 -= inv.amount;
          else if (diffDays <= 120) entry.bucket_91_120 -= inv.amount;
          else entry.bucket_over_120 -= inv.amount;
        }
      });

      // If there are still unapplied payments, offset them against the "not due" bucket (or leave as positive balance)
      if (unappliedPayments > 0) {
        entry.notDue += unappliedPayments;
      }
      
      // Round everything to 2 decimals
      ['balance', 'notDue', 'bucket_1_30', 'bucket_31_60', 'bucket_61_90', 'bucket_91_120', 'bucket_over_120'].forEach(k => {
        entry[k] = Math.round(entry[k] * 100) / 100;
      });
    });

    return dataMap;
  }, [transactions, suppliers]);

  const filteredData = useMemo(() => {
    let list = Object.values(agingData);
    if (hideZero) {
      list = list.filter(item => item.balance <= -0.01);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(item => 
        item.supplier['SUPPLIER NAME']?.toLowerCase().includes(lower) || 
        item.supplier['SUPPLIER ID']?.toLowerCase().includes(lower)
      );
    }
    return list;
  }, [agingData, searchTerm, hideZero]);

  const totals = useMemo(() => {
    return filteredData.reduce((sum, item) => {
      sum.balance += item.balance || 0;
      sum.notDue += item.notDue || 0;
      sum.bucket_1_30 += item.bucket_1_30 || 0;
      sum.bucket_31_60 += item.bucket_31_60 || 0;
      sum.bucket_61_90 += item.bucket_61_90 || 0;
      sum.bucket_91_120 += item.bucket_91_120 || 0;
      sum.bucket_over_120 += item.bucket_over_120 || 0;
      return sum;
    }, {
      balance: 0, notDue: 0, bucket_1_30: 0, bucket_31_60: 0, bucket_61_90: 0, bucket_91_120: 0, bucket_over_120: 0
    });
  }, [filteredData]);

  const columns = useMemo(() => [
    {
      accessorFn: (row: any) => row.supplier['SUPPLIER ID'],
      id: 'SUPPLIER ID',
      header: 'Supplier ID',
      cell: (info: any) => (
        <span className="font-mono text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-2 py-1 rounded-md text-xs">
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorFn: (row: any) => row.supplier['SUPPLIER NAME'],
      id: 'SUPPLIER NAME',
      header: 'Supplier Name',
      cell: (info: any) => (
        <span className="font-bold text-slate-800 tracking-wide text-left">
          {info.getValue() || 'Unknown'}
        </span>
      ),
    },
    {
      accessorKey: 'balance',
      header: 'Total Balance',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={`font-mono font-bold ${val > 0 ? 'text-red-400' : val < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      accessorKey: 'notDue',
      header: 'Not Due',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={`font-mono font-medium ${val > 0 ? 'text-red-400' : val < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      accessorKey: 'bucket_1_30',
      header: '1-30 Days',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return <span className={`font-mono font-medium ${val < 0 ? 'text-orange-400' : 'text-slate-400'}`}>{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    },
    {
      accessorKey: 'bucket_31_60',
      header: '31-60 Days',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return <span className={`font-mono font-medium ${val < 0 ? 'text-orange-500' : 'text-slate-400'}`}>{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    },
    {
      accessorKey: 'bucket_61_90',
      header: '61-90 Days',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return <span className={`font-mono font-medium ${val < 0 ? 'text-red-500' : 'text-slate-400'}`}>{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    },
    {
      accessorKey: 'bucket_91_120',
      header: '91-120 Days',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return <span className={`font-mono font-medium ${val < 0 ? 'text-red-600' : 'text-slate-400'}`}>{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    },
    {
      accessorKey: 'bucket_over_120',
      header: '> 120 Days',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return <span className={`font-mono font-black ${val < 0 ? 'text-red-700' : 'text-slate-400'}`}>{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
      }
    },
  ], []);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const exportToExcel = async () => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const rows: Record<string, unknown>[] = table.getRowModel().rows.map(row => {
      const d = row.original;
      return {
        'Supplier ID': d.supplier['SUPPLIER ID'],
        'Supplier Name': d.supplier['SUPPLIER NAME'] || 'Unknown',
        'Total Balance': round2(d.balance),
        'Not Due': round2(d.notDue),
        '1-30 Days': round2(d.bucket_1_30),
        '31-60 Days': round2(d.bucket_31_60),
        '61-90 Days': round2(d.bucket_61_90),
        '91-120 Days': round2(d.bucket_91_120),
        '> 120 Days': round2(d.bucket_over_120),
      };
    });
    if (rows.length === 0) return;
    rows.push({
      'Supplier ID': '',
      'Supplier Name': 'GRAND TOTALS',
      'Total Balance': round2(totals.balance),
      'Not Due': round2(totals.notDue),
      '1-30 Days': round2(totals.bucket_1_30),
      '31-60 Days': round2(totals.bucket_31_60),
      '61-90 Days': round2(totals.bucket_61_90),
      '91-120 Days': round2(totals.bucket_91_120),
      '> 120 Days': round2(totals.bucket_over_120),
    });
    const date = new Date().toISOString().split('T')[0];
    await exportStyledExcel(rows, `Aging_Of_Suppliers_${date}`, {
      sheetName: 'Aging Report',
      columnWidth: 18,
      numericColumns: ['Total Balance', 'Not Due', '1-30 Days', '31-60 Days', '61-90 Days', '91-120 Days', '> 120 Days'],
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="text-red-400 bg-red-400/10 px-6 py-4 rounded-xl border border-red-400/20 font-bold">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Aging of Suppliers</h2>
          <button
            type="button"
            onClick={() => setHideZero(v => !v)}
            title={hideZero ? 'Show all suppliers' : 'Hide zero & positive balance suppliers'}
            className={`flex items-center justify-center w-9 h-9 rounded-xl border transition-all ${
              hideZero
                ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]'
                : 'bg-white border-slate-200 text-slate-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/30'
            }`}
          >
            {hideZero ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={exportToExcel}
            title="Export to Excel"
            className="flex items-center justify-center w-9 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search suppliers..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center">
            <thead className="text-xs uppercase text-white font-bold tracking-[0.1em] bg-black">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-3 py-4 cursor-pointer hover:text-[#D4AF37] transition-colors whitespace-nowrap" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <NoData isTable colSpan={columns.length} title="NO DATA FOUND" message="No aging records match your criteria." />
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-3 py-4 whitespace-nowrap text-slate-600 group-hover:text-slate-900 transition-colors">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
            {table.getRowModel().rows.length > 0 && (
              <tfoot className="bg-slate-50/50 border-t border-slate-100">
                <tr>
                  <td colSpan={2} className="px-3 py-4 text-right font-black uppercase tracking-widest text-[11px] text-slate-800">
                    
                  </td>
                  <td className="px-3 py-4 text-center font-black text-[15px]">
                    <span className={totals.balance > 0 ? 'text-red-500' : totals.balance < 0 ? 'text-emerald-500' : 'text-slate-800'}>
                      {totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-center font-black text-[15px]">
                    <span className={totals.notDue > 0 ? 'text-red-500' : totals.notDue < 0 ? 'text-emerald-500' : 'text-slate-800'}>
                      {totals.notDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-center font-black text-[15px]">
                    <span className={totals.bucket_1_30 < 0 ? 'text-orange-500' : 'text-slate-800'}>{totals.bucket_1_30.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-3 py-4 text-center font-black text-[15px]">
                    <span className={totals.bucket_31_60 < 0 ? 'text-orange-500' : 'text-slate-800'}>{totals.bucket_31_60.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-3 py-4 text-center font-black text-[15px]">
                    <span className={totals.bucket_61_90 < 0 ? 'text-red-500' : 'text-slate-800'}>{totals.bucket_61_90.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-3 py-4 text-center font-black text-[15px]">
                    <span className={totals.bucket_91_120 < 0 ? 'text-red-600' : 'text-slate-800'}>{totals.bucket_91_120.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                  <td className="px-3 py-4 text-center font-black text-[15px]">
                    <span className={totals.bucket_over_120 < 0 ? 'text-red-700' : 'text-slate-800'}>{totals.bucket_over_120.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
