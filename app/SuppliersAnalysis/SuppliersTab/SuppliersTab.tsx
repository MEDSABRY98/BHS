'use client';

import React, { useMemo, useState } from 'react';
import NoData from '../../Components/DataState/NoDataTab';
import { useSuppliersData } from '../Context/SuppliersDataContext';
import { Search, Loader2, Eye, EyeOff, FileSpreadsheet, FileText } from 'lucide-react';
import { exportStyledExcel } from '../../Components/Export/ExcelExport';
import { buildSupplierStatement } from './Statement/StatementData';
import { generateSupplierStatementPDF } from './Statement/StatementPdf';
import { generateSupplierStatementExcel } from './Statement/StatementExcel';
import { toast } from '../../Components/Notification';
import SupplierMonthlyModal from './Modal/SupplierMonthlyModal';
import { SupplierRecord } from '../Service/suppliers_service';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';

export default function SuppliersTab() {
  const { suppliers, transactions, loading, error } = useSuppliersData();
  const [busy, setBusy] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<SupplierRecord | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'SUPPLIER NAME', desc: false }]);
  const [exportModal, setExportModal] = useState<{ id: string; name: string; kind: 'excel' | 'pdf' } | null>(null);
  const [exportYear, setExportYear] = useState('');
  const [exportMonth, setExportMonth] = useState('');

  // Calculate balances per supplier
  const supplierBalances = useMemo(() => {
    const dataMap: Record<string, { balance: number; dueAmount: number; notDueAmount: number }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    transactions.forEach(t => {
      if (!t['SUPPLIER ID']) return;
      
      const supp = suppliers.find(s => s['SUPPLIER ID'] === t['SUPPLIER ID']);
      const paymentTerm = Number(supp?.['PAYMENT TERM']) || 0;
      const residual = Number(t['RESIDUAL AMOUNT']) || 0;
      
      if (residual === 0) return;

      if (!dataMap[t['SUPPLIER ID']]) {
        dataMap[t['SUPPLIER ID']] = { balance: 0, dueAmount: 0, notDueAmount: 0 };
      }
      
      const entry = dataMap[t['SUPPLIER ID']];
      entry.balance += residual;

      // Positive residuals (payments / credit notes) are never "not due":
      // they offset the debt directly (handled after the loop).
      if (residual > 0) return;

      // Invoices (negative residuals): due on the 1st of the month after
      // adding the payment term in 30-day blocks (block / end-of-month logic).
      let isNotDue = false;
      if (t.DATE) {
        const [year, month, day] = String(t.DATE).split('T')[0].split('-');
        const invDate = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(invDate.getTime())) {
          let dueDate = invDate;
          if (paymentTerm > 0) {
            const monthsToAdd = Math.round(paymentTerm / 30);
            dueDate = new Date(invDate.getFullYear(), invDate.getMonth() + monthsToAdd + 1, 1);
          }
          dueDate.setHours(0, 0, 0, 0);
          isNotDue = dueDate.getTime() > today.getTime();
        }
      }

      if (isNotDue) entry.notDueAmount += residual;
    });

    // Due = Balance - Not Due  (payments offset the oldest / due debt first).
    // If credits exceed the due part, the excess reduces the not-due part.
    Object.values(dataMap).forEach(entry => {
      entry.balance = Math.round(entry.balance * 100) / 100;
      let due = entry.balance - entry.notDueAmount;
      if (due > 0 && entry.notDueAmount < 0) {
        const offset = Math.min(due, -entry.notDueAmount);
        entry.notDueAmount += offset;
        due -= offset;
      }
      entry.dueAmount = Math.round(due * 100) / 100;
      entry.notDueAmount = Math.round(entry.notDueAmount * 100) / 100;
    });
    return dataMap;
  }, [transactions, suppliers]);

  const filteredSuppliers = useMemo(() => {
    let list = suppliers;
    if (hideZero) {
      // Keep only suppliers with a negative (payable) balance
      list = list.filter(s => (supplierBalances[s['SUPPLIER ID']]?.balance || 0) <= -0.01);
    }
    if (!searchTerm) return list;
    const lower = searchTerm.toLowerCase();
    return list.filter(s => 
      s['SUPPLIER NAME']?.toLowerCase().includes(lower) || 
      s['SUPPLIER ID']?.toLowerCase().includes(lower)
    );
  }, [suppliers, searchTerm, hideZero, supplierBalances]);

  const totals = useMemo(() => {
    return filteredSuppliers.reduce((sum, supplier) => {
      const data = supplierBalances[supplier['SUPPLIER ID']];
      if (data) {
        sum.balance += data.balance;
        sum.dueAmount += data.dueAmount;
        sum.notDueAmount += data.notDueAmount;
      }
      return sum;
    }, { balance: 0, dueAmount: 0, notDueAmount: 0 });
  }, [filteredSuppliers, supplierBalances]);

  const handleExport = async (filterType: 'all' | 'open' | 'closed') => {
    if (!exportModal) return;
    const { id, name, kind } = exportModal;
    const key = `${kind}-${id}`;
    if (busy) return;
    try {
      setExportModal(null);
      setBusy(key);
      const rows = buildSupplierStatement(id, transactions, filterType, exportYear, exportMonth);
      if (rows.length === 0) {
        toast.warning(`No ${filterType === 'all' ? '' : filterType + ' '}transactions for ${name}.`);
        return;
      }
      if (kind === 'excel') await generateSupplierStatementExcel(name, rows);
      else await generateSupplierStatementPDF(name, rows);
      toast.success(`${kind === 'excel' ? 'Excel' : 'PDF'} statement downloaded for ${name}.`);
    } catch (err) {
      console.error('Statement export failed:', err);
      toast.error('Failed to generate statement.');
    } finally {
      setBusy(null);
    }
  };

  const columns = useMemo(() => [
    {
      accessorKey: 'SUPPLIER ID',
      header: 'Supplier ID',
      cell: (info: any) => (
        <span className="font-mono text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-2 py-1 rounded-md text-xs">
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorKey: 'SUPPLIER NAME',
      header: 'Supplier Name',
      cell: (info: any) => {
        const name = info.getValue() || 'Unknown';
        const supplier = info.row.original;
        return (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSupplierForModal(supplier);
            }}
            className="font-bold text-slate-800 tracking-wide text-left hover:text-[#D4AF37] hover:underline decoration-[#D4AF37]/50 underline-offset-4 transition-all"
          >
            {name}
          </button>
        );
      },
    },
    {
      accessorKey: 'PAYMENT TERM',
      header: 'Payment Term',
      cell: (info: any) => (
        <span className="font-mono font-medium text-slate-500">
          {Number(info.getValue()) || 0} Days
        </span>
      ),
    },
    {
      id: 'balance',
      header: 'Total Balance',
      cell: (info: any) => {
        const id = info.row.original['SUPPLIER ID'];
        const bal = supplierBalances[id]?.balance || 0;
        return (
          <span className={`font-mono font-bold ${bal > 0 ? 'text-red-400' : bal < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {bal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      id: 'dueAmount',
      header: 'Due Amount',
      cell: (info: any) => {
        const id = info.row.original['SUPPLIER ID'];
        const due = supplierBalances[id]?.dueAmount || 0;
        return (
          <span className={`font-mono font-bold ${due > 0 ? 'text-red-500' : due < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
            {due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      id: 'notDueAmount',
      header: 'Not Due Amount',
      cell: (info: any) => {
        const id = info.row.original['SUPPLIER ID'];
        const notDue = supplierBalances[id]?.notDueAmount || 0;
        return (
          <span className={`font-mono font-bold ${notDue > 0 ? 'text-orange-400' : notDue < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
            {notDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      id: 'statement',
      header: 'Statement',
      cell: (info: any) => {
        const s = info.row.original;
        const id = s['SUPPLIER ID'];
        const name = s['SUPPLIER NAME'] || id;
        return (
          <div className="flex items-center justify-center gap-2">
            <button
              id={`statement-excel-${id}`}
              type="button"
              title="Statement (Excel)"
              onClick={() => setExportModal({ id, name, kind: 'excel' })}
              disabled={!!busy}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              {busy === `excel-${id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            </button>
            <button
              id={`statement-pdf-${id}`}
              type="button"
              title="Statement (PDF)"
              onClick={() => setExportModal({ id, name, kind: 'pdf' })}
              disabled={!!busy}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              {busy === `pdf-${id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            </button>
          </div>
        );
      },
    }
  ], [supplierBalances, transactions, busy]);

  const table = useReactTable({
    data: filteredSuppliers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const exportToExcel = async () => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const rows: Record<string, unknown>[] = table.getRowModel().rows.map(row => {
      const s = row.original;
      const d = supplierBalances[s['SUPPLIER ID']];
      return {
        'Supplier ID': s['SUPPLIER ID'],
        'Supplier Name': s['SUPPLIER NAME'] || 'Unknown',
        'Payment Term': `${Number(s['PAYMENT TERM']) || 0} Days`,
        'Total Balance': round2(d?.balance || 0),
        'Due Amount': round2(d?.dueAmount || 0),
        'Not Due Amount': round2(d?.notDueAmount || 0),
      };
    });
    if (rows.length === 0) return;
    rows.push({
      'Supplier ID': '',
      'Supplier Name': 'GRAND TOTALS',
      'Payment Term': '',
      'Total Balance': round2(totals.balance),
      'Due Amount': round2(totals.dueAmount),
      'Not Due Amount': round2(totals.notDueAmount),
    });
    const date = new Date().toISOString().split('T')[0];
    await exportStyledExcel(rows, `Suppliers_List_${date}`, {
      sheetName: 'Suppliers List',
      columnWidth: 22,
      numericColumns: ['Total Balance', 'Due Amount', 'Not Due Amount'],
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Suppliers List</h2>
          <button
            id="toggle-zero-balance-suppliers"
            type="button"
            role="checkbox"
            aria-checked={hideZero}
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
            id="export-suppliers-excel"
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
                    <th key={header.id} className="px-6 py-5 cursor-pointer hover:text-[#D4AF37] transition-colors whitespace-nowrap" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <NoData isTable colSpan={columns.length} title="NO SUPPLIERS FOUND" message="No suppliers found matching your criteria." />
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id} 
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-slate-600 group-hover:text-slate-900 transition-colors">
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
                  <td colSpan={3} className="px-6 py-5 text-right font-black uppercase tracking-widest text-[11px] text-slate-800">
                    
                  </td>
                  <td className="px-6 py-5 text-center font-black text-lg">
                    <span className={totals.balance > 0 ? 'text-red-500' : totals.balance < 0 ? 'text-emerald-500' : 'text-slate-800'}>
                      {totals.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center font-black text-lg">
                    <span className={totals.dueAmount > 0 ? 'text-red-600' : totals.dueAmount < 0 ? 'text-emerald-500' : 'text-slate-800'}>
                      {totals.dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-center font-black text-lg">
                    <span className={totals.notDueAmount > 0 ? 'text-orange-500' : totals.notDueAmount < 0 ? 'text-emerald-500' : 'text-slate-800'}>
                      {totals.notDueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-6 py-5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {selectedSupplierForModal && (
        <SupplierMonthlyModal
          supplier={selectedSupplierForModal}
          transactions={transactions}
          onClose={() => setSelectedSupplierForModal(null)}
        />
      )}

      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-black text-lg text-slate-800">Export Options</h3>
              <button 
                onClick={() => setExportModal(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Year (Optional)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2026"
                    value={exportYear}
                    onChange={(e) => setExportYear(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Month (Optional)</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    placeholder="e.g. 5"
                    value={exportMonth}
                    onChange={(e) => setExportMonth(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all"
                  />
                </div>
              </div>
              <button
                onClick={() => handleExport('all')}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
              >
                <div className="font-bold text-slate-800 group-hover:text-indigo-700">All Transactions</div>
              </button>
              <button
                onClick={() => handleExport('open')}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all group"
              >
                <div className="font-bold text-slate-800 group-hover:text-emerald-700">Open Transactions</div>
              </button>
              <button
                onClick={() => handleExport('closed')}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-100 transition-all group"
              >
                <div className="font-bold text-slate-800 group-hover:text-slate-900">Closed Transactions</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
