import React, { useMemo, useState } from 'react';
import { X, Search } from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';

interface MonthDetailsModalProps {
  month: any;
  onClose: () => void;
}

export default function MonthDetailsModal({ month, onClose }: MonthDetailsModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'amount', desc: true }]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return month.suppliers;
    const lower = searchTerm.toLowerCase();
    return month.suppliers.filter((s: any) => 
      s.supplier['SUPPLIER NAME']?.toLowerCase().includes(lower) || 
      s.supplier['SUPPLIER ID']?.toLowerCase().includes(lower)
    );
  }, [month.suppliers, searchTerm]);

  const totals = useMemo(() => {
    return filteredSuppliers.reduce((sum: number, s: any) => sum + s.amount, 0);
  }, [filteredSuppliers]);

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
      accessorFn: (row: any) => Number(row.supplier['PAYMENT TERM']) || 0,
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
      header: 'Amount Due',
      cell: (info: any) => {
        const val = info.getValue() as number;
        return (
          <span className={`font-mono font-bold ${val > 0 ? 'text-red-500' : val < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data: filteredSuppliers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Suppliers Due in {month.monthName}
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {filteredSuppliers.length} supplier(s)
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/20 relative">
          <table className="w-full text-sm text-center">
            <thead className="text-xs uppercase text-slate-500 font-bold bg-slate-100 sticky top-0 z-10 shadow-sm">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-6 py-4 cursor-pointer hover:text-[#D4AF37] transition-colors whitespace-nowrap" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-white transition-colors bg-white/50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="bg-slate-100 p-6 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="font-black uppercase text-slate-800 text-sm tracking-widest">
            Total for {month.monthName}
          </span>
          <span className={`font-black text-2xl ${totals > 0 ? 'text-red-500' : totals < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
            {totals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

      </div>
    </div>
  );
}
