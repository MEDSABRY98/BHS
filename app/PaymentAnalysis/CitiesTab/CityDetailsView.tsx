import React, { useMemo } from 'react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { ArrowLeft, Calendar } from 'lucide-react';
import { 
  useReactTable, 
  getCoreRowModel, 
  getSortedRowModel, 
  flexRender,
  SortingState
} from '@tanstack/react-table';

interface CityDetailsViewProps {
  cityName: string;
  onBack: () => void;
}

export default function CityDetailsView({ cityName, onBack }: CityDetailsViewProps) {
  const { paymentsData } = usePaymentAnalysis();
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'monthSort', desc: true }]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { 
      monthLabel: string, 
      monthSort: string,
      netCollection: number, 
      paymentCount: number,
      customers: Set<string>
    }>();

    paymentsData.forEach(row => {
      if ((row.city || '').trim() !== cityName) return;
      if (!row.date) return;

      const category = getPaymentCategory(row);
      const amount = category === 'Payment' ? (Number(row.credit) || 0) : category === 'Refund' ? -(Number(row.debit) || 0) : 0;
      if (amount === 0 && category !== 'Payment') return;

      const d = new Date(row.date);
      if (isNaN(d.getTime())) return;

      const m = d.getMonth();
      const y = d.getFullYear();
      
      // format: "YYYY-MM" for sorting
      const monthSort = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });

      if (!map.has(monthSort)) {
        map.set(monthSort, {
          monthLabel,
          monthSort,
          netCollection: 0,
          paymentCount: 0,
          customers: new Set()
        });
      }

      const entry = map.get(monthSort)!;
      entry.netCollection += amount;

      if (category === 'Payment') {
        entry.paymentCount += 1;
      }

      if (row.customerId) {
        entry.customers.add(row.customerId);
      }
    });

    return Array.from(map.values()).map(entry => ({
      monthLabel: entry.monthLabel,
      monthSort: entry.monthSort,
      netCollection: entry.netCollection,
      paymentCount: entry.paymentCount,
      customersCount: entry.customers.size
    }));
  }, [paymentsData, cityName]);

  const columns = useMemo(() => [
    {
      accessorKey: 'monthSort',
      header: 'Month',
      cell: (info: any) => (
        <div className="flex items-center gap-2 justify-center">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-bold text-slate-800">{info.row.original.monthLabel}</span>
        </div>
      ),
      sortingFn: 'alphanumeric'
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
      accessorKey: 'paymentCount',
      header: 'No. of Payments',
      cell: (info: any) => (
        <span className="font-mono font-semibold text-emerald-600">
          {(info.getValue() as number).toLocaleString()}
        </span>
      )
    },
    {
      accessorKey: 'customersCount',
      header: 'No. of Customers',
      cell: (info: any) => (
        <span className="font-mono font-semibold text-indigo-600">
          {(info.getValue() as number).toLocaleString()}
        </span>
      )
    }
  ], []);

  const table = useReactTable({
    data: monthlyData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totals = useMemo(() => {
    return monthlyData.reduce((acc, curr) => ({
      net: acc.net + curr.netCollection,
      payments: acc.payments + curr.paymentCount,
      // Total unique customers across all months cannot be summed this way simply, but we can just sum the monthly counts or omit it.
      // Alternatively, we sum the monthly unique customers:
      customers: acc.customers + curr.customersCount
    }), { net: 0, payments: 0, customers: 0 });
  }, [monthlyData]);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{cityName} Details</h2>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mt-1">Monthly Collections Breakdown</p>
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
                    No monthly data found.
                  </td>
                </tr>
              ) : (
                <>
                  {table.getRowModel().rows.map(row => (
                    <tr 
                      key={row.id} 
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="px-6 py-4 text-slate-600 text-center">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-50 font-black border-t-2 border-slate-200 text-sm">
                    <td className="px-6 py-5 text-slate-800 uppercase tracking-wider text-center">Total</td>
                    <td className="px-6 py-5 font-mono text-[#D4AF37] text-center text-base">
                      {totals.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-5 font-mono text-emerald-700 text-center text-base">
                      {totals.payments.toLocaleString()}
                    </td>
                    <td className="px-6 py-5 font-mono text-indigo-700 text-center text-base">
                      {totals.customers.toLocaleString()}
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
