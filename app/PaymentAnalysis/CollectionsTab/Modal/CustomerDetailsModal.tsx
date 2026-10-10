import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { usePaymentAnalysis } from '../../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../../Utils/PaymentType';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  getPaginationRowModel,
  flexRender,
  SortingState
} from '@tanstack/react-table';

interface CustomerDetailsModalProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
}

export default function CustomerDetailsModal({ customerId, customerName, onClose }: CustomerDetailsModalProps) {
  const { paymentsData } = usePaymentAnalysis();
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);

  const tableData = useMemo(() => {
    return paymentsData
      .filter(row => row.customerId === customerId && getPaymentCategory(row) !== 'Other')
      .map(row => {
        // Same rule as the Collections table (customer-vendor refunds are excluded)
        const isRefund = getPaymentCategory(row) === 'Refund';
        const amount = isRefund ? (Number(row.debit) || 0) : (Number(row.credit) || 0);

        return {
          id: row.id,
          date: row.date ? String(row.date).split('T')[0] : '',
          number: row.number || '',
          type: isRefund ? 'Refund/Bounced' : 'Payment',
          isRefund,
          amount,
          matching: row.matching || '',
        };
      });
  }, [paymentsData, customerId]);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return tableData;
    const q = searchTerm.toLowerCase();
    return tableData.filter(item => 
      item.number.toLowerCase().includes(q)
    );
  }, [tableData, searchTerm]);

  const totals = useMemo(() => {
    return tableData.reduce((acc, curr) => ({
      collected: curr.isRefund ? acc.collected : acc.collected + curr.amount,
      refunded: curr.isRefund ? acc.refunded + curr.amount : acc.refunded,
      net: curr.isRefund ? acc.net - curr.amount : acc.net + curr.amount
    }), { collected: 0, refunded: 0, net: 0 });
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
      accessorKey: 'number',
      header: 'Reference',
      cell: (info: any) => (
        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
          {info.getValue()}
        </span>
      )
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: (info: any) => {
        const isRefund = info.row.original.isRefund;
        return (
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            isRefund ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {info.getValue()}
          </span>
        );
      }
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: (info: any) => {
        const val = info.getValue() as number;
        const isRefund = info.row.original.isRefund;
        return (
          <span className={`font-mono font-black text-sm ${isRefund ? 'text-red-600' : 'text-emerald-600'}`}>
            {isRefund ? '-' : ''}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      accessorKey: 'matching',
      header: 'Matching',
      cell: (info: any) => (
        <span className="text-slate-500 text-xs">{info.getValue() || '-'}</span>
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 }
    }
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-start shrink-0">
          <div>
            <h3 className="font-black text-xl text-slate-800">{customerName}</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">ID: {customerId} • {tableData.length} Transactions</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-white shrink-0">
          <div className="p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Total Collected</div>
            <div className="font-mono font-black text-emerald-600 text-lg">
              {totals.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Refunded / Bounced</div>
            <div className="font-mono font-black text-red-500 text-lg">
              {totals.refunded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 text-center bg-slate-50">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Net Collection</div>
            <div className="font-mono font-black text-slate-800 text-xl">
              {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        
        {/* Search */}
        <div className="p-4 border-b border-slate-100 shrink-0">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search reference..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] uppercase text-slate-500 font-bold tracking-wider bg-slate-50 border-b border-slate-200 text-center">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th key={header.id} className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors whitespace-nowrap text-center" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-slate-100 text-center">
                  {table.getRowModel().rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">
                        No transactions match your search.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-6 py-3 whitespace-nowrap text-slate-600 text-center">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {table.getRowModel().rows.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200 text-center">
                    <tr>
                      <td colSpan={3} className="px-6 py-4"></td>
                      <td className="px-6 py-4 font-mono font-black text-lg text-slate-800">
                        {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>

        {/* Pagination Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs font-medium text-slate-500">
            Showing <span className="font-bold text-slate-800">{table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}</span> to <span className="font-bold text-slate-800">{Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredData.length)}</span> of <span className="font-bold text-slate-800">{filteredData.length}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
