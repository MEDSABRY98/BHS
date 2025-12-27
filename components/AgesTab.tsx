'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { InvoiceRow } from '@/types';

interface AgesTabProps {
  data: InvoiceRow[];
}

interface CustomerAgingSummary {
  customerName: string;
  salesReps: string[];
  atDate: number;
  oneToThirty: number;
  thirtyOneToSixty: number;
  sixtyOneToNinety: number;
  ninetyOneToOneTwenty: number;
  older: number;
  total: number;
}

const columnHelper = createColumnHelper<CustomerAgingSummary>();

export default function AgesTab({ data }: AgesTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('all');

  const agingData = useMemo(() => {
    // Group by customer first
    const customerMap = new Map<string, InvoiceRow[]>();
    data.forEach((row) => {
      const existing = customerMap.get(row.customerName) || [];
      existing.push(row);
      customerMap.set(row.customerName, existing);
    });

    const summaries: CustomerAgingSummary[] = [];

    customerMap.forEach((customerInvoices, customerName) => {
      const totalDebit = customerInvoices.reduce((sum, inv) => sum + inv.debit, 0);
      const totalCredit = customerInvoices.reduce((sum, inv) => sum + inv.credit, 0);
      const netDebt = totalDebit - totalCredit;

      // Collect unique sales reps
      const salesRepsSet = new Set<string>();
      customerInvoices.forEach((inv) => {
        if (inv.salesRep && inv.salesRep.trim()) {
          salesRepsSet.add(inv.salesRep.trim());
        }
      });

      const summary: CustomerAgingSummary = {
        customerName,
        salesReps: Array.from(salesRepsSet).sort(),
        atDate: 0,
        oneToThirty: 0,
        thirtyOneToSixty: 0,
        sixtyOneToNinety: 0,
        ninetyOneToOneTwenty: 0,
        older: 0,
        total: netDebt
      };

      // Identify Open Items (Unmatched + Residuals)
      const matchingTotals = new Map<string, number>();
      const maxDebits = new Map<string, number>();
      const mainInvoiceIndices = new Map<string, number>();

      // Pass 1: Analyze Matchings
      customerInvoices.forEach((inv, idx) => {
        if (inv.matching) {
             const net = inv.debit - inv.credit;
             matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);
             
             const currentMax = maxDebits.get(inv.matching) ?? -1;
             // Logic to pick main invoice (largest debit)
             if (inv.debit > currentMax) {
                 maxDebits.set(inv.matching, inv.debit);
                 mainInvoiceIndices.set(inv.matching, idx);
             } else if (!mainInvoiceIndices.has(inv.matching)) {
                 maxDebits.set(inv.matching, inv.debit);
                 mainInvoiceIndices.set(inv.matching, idx);
             }
        }
      });

      // Pass 2: Aging Calculation
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      customerInvoices.forEach((inv, idx) => {
          let amountToAge = 0;
          let shouldAge = false;

          if (!inv.matching) {
              const net = inv.debit - inv.credit;
              if (Math.abs(net) > 0.01) {
                  amountToAge = net;
                  shouldAge = true;
              }
          } else {
              // It is matched. Check if it is main invoice
              if (mainInvoiceIndices.get(inv.matching) === idx) {
                  const residual = matchingTotals.get(inv.matching) || 0;
                  if (Math.abs(residual) > 0.01) {
                      amountToAge = residual;
                      shouldAge = true;
                  }
              }
          }

          if (shouldAge) {
              // Calculate days overdue
              let daysOverdue = 0;
              let targetDate = inv.dueDate ? new Date(inv.dueDate) : null;
              
              if (!targetDate || isNaN(targetDate.getTime())) {
                 if (inv.date) {
                   targetDate = new Date(inv.date);
                 }
              }

              if (targetDate && !isNaN(targetDate.getTime())) {
                 targetDate.setHours(0, 0, 0, 0);
                 const diffTime = today.getTime() - targetDate.getTime();
                 daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              }

              if (daysOverdue <= 0) {
                summary.atDate += amountToAge;
              } else if (daysOverdue <= 30) {
                summary.oneToThirty += amountToAge;
              } else if (daysOverdue <= 60) {
                summary.thirtyOneToSixty += amountToAge;
              } else if (daysOverdue <= 90) {
                summary.sixtyOneToNinety += amountToAge;
              } else if (daysOverdue <= 120) {
                summary.ninetyOneToOneTwenty += amountToAge;
              } else {
                summary.older += amountToAge;
              }
          }
      });

      // Include in summary if there is significant debt or open items
      const hasValues = Math.abs(summary.total) > 0.01 || 
                        Math.abs(summary.atDate) > 0.01 || 
                        Math.abs(summary.older) > 0.01 ||
                        Math.abs(summary.oneToThirty) > 0.01 ||
                        Math.abs(summary.thirtyOneToSixty) > 0.01 ||
                        Math.abs(summary.sixtyOneToNinety) > 0.01 ||
                        Math.abs(summary.ninetyOneToOneTwenty) > 0.01;

      if (hasValues) {
        summaries.push(summary);
      }
    });

    return summaries.sort((a, b) => b.total - a.total);
  }, [data]);

  // Get unique sales reps
  const salesReps = useMemo(() => {
    const repsSet = new Set<string>();
    agingData.forEach((customer) => {
      customer.salesReps.forEach((rep) => {
        if (rep && rep.trim()) {
          repsSet.add(rep.trim());
        }
      });
    });
    return Array.from(repsSet).sort();
  }, [agingData]);

  const filteredData = useMemo(() => {
    let filtered = agingData;

    // Filter by sales rep
    if (selectedSalesRep !== 'all') {
      filtered = filtered.filter((customer) =>
        customer.salesReps.includes(selectedSalesRep)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((customer) =>
        customer.customerName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [agingData, searchQuery, selectedSalesRep]);

  const exportToExcel = () => {
    const headers = ['Customer Name', 'Sales Rep', 'AT DATE', '1 - 30', '31 - 60', '61 - 90', '91 - 120', 'OLDER', 'TOTAL'];
    const rows = filteredData.map((item) => [
      item.customerName,
      item.salesReps.join(', ') || '',
      item.atDate.toLocaleString('en-US'),
      item.oneToThirty.toLocaleString('en-US'),
      item.thirtyOneToSixty.toLocaleString('en-US'),
      item.sixtyOneToNinety.toLocaleString('en-US'),
      item.ninetyOneToOneTwenty.toLocaleString('en-US'),
      item.older.toLocaleString('en-US'),
      item.total.toLocaleString('en-US'),
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ages_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => (
            <div className="font-medium text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis" title={info.getValue()}>
                {info.getValue()}
            </div>
        ),
      }),
      columnHelper.accessor('atDate', {
        header: 'AT DATE',
        cell: (info) => (
            <span className="text-green-600 font-semibold whitespace-nowrap">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('oneToThirty', {
        header: '1 - 30',
        cell: (info) => (
            <span className="whitespace-nowrap">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('thirtyOneToSixty', {
        header: '31 - 60',
        cell: (info) => (
            <span className="whitespace-nowrap">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('sixtyOneToNinety', {
        header: '61 - 90',
        cell: (info) => (
            <span className="whitespace-nowrap">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('ninetyOneToOneTwenty', {
        header: '91 - 120',
        cell: (info) => (
            <span className="whitespace-nowrap">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('older', {
        header: 'OLDER',
        cell: (info) => (
            <span className="text-red-600 font-semibold whitespace-nowrap">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('total', {
        header: 'TOTAL',
        cell: (info) => {
            const value = info.getValue();
             return (
             <span className={`font-bold whitespace-nowrap ${value > 0 ? 'text-gray-900' : 'text-green-600'}`}>
               {value.toLocaleString('en-US')}
             </span>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
    onSortingChange: setSorting,
  });

  // Calculate Totals
  const totalAtDate = filteredData.reduce((sum, item) => sum + item.atDate, 0);
  const total1To30 = filteredData.reduce((sum, item) => sum + item.oneToThirty, 0);
  const total31To60 = filteredData.reduce((sum, item) => sum + item.thirtyOneToSixty, 0);
  const total61To90 = filteredData.reduce((sum, item) => sum + item.sixtyOneToNinety, 0);
  const total91To120 = filteredData.reduce((sum, item) => sum + item.ninetyOneToOneTwenty, 0);
  const totalOlder = filteredData.reduce((sum, item) => sum + item.older, 0);
  const grandTotal = filteredData.reduce((sum, item) => sum + item.total, 0);


  return (
    <div className="p-6">

      <div className="mb-4 flex justify-center items-center gap-3 flex-wrap">
        <select
          value={selectedSalesRep}
          onChange={(e) => setSelectedSalesRep(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white"
        >
          <option value="all">All Sales Reps</option>
          {salesReps.map((rep) => (
            <option key={rep} value={rep}>
              {rep}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search by customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
        />
        <button
          onClick={exportToExcel}
          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
          title="Export to Excel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

       <div className="bg-white rounded-lg shadow overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '1200px' }}>
             <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
               {table.getHeaderGroups().map((headerGroup) => (
                 <tr key={headerGroup.id}>
                   {headerGroup.headers.map((header) => {
                     const getWidth = () => {
                         const columnId = header.column.id;
                         if (columnId === 'customerName') return '25%';
                         // 7 numeric columns remaining = 75% / 7 ~ 10.7%
                         return '10.7%';
                     };
                     return (
                     <th
                       key={header.id}
                       className="px-6 py-4 text-center font-semibold text-sm uppercase tracking-wider cursor-pointer hover:bg-blue-700 transition-colors whitespace-nowrap"
                       style={{ width: getWidth() }}
                       onClick={header.column.getToggleSortingHandler()}
                     >
                       {flexRender(header.column.columnDef.header, header.getContext())}
                       {{
                         asc: ' ↑',
                         desc: ' ↓',
                       }[header.column.getIsSorted() as string] ?? null}
                     </th>
                     );
                   })}
                 </tr>
               ))}
             </thead>
             <tbody className="divide-y divide-gray-200">
               {table.getRowModel().rows.map((row, idx) => (
                 <tr key={row.id} className={`border-b hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                   {row.getVisibleCells().map((cell) => {
                      const getWidth = () => {
                         const columnId = cell.column.id;
                         if (columnId === 'customerName') return '25%';
                         return '10.7%';
                     };
                     return (
                       <td 
                         key={cell.id} 
                         className="px-6 py-4 text-center text-sm whitespace-nowrap"
                         style={{ width: getWidth() }}
                       >
                         {flexRender(cell.column.columnDef.cell, cell.getContext())}
                       </td>
                     );
                   })}
                 </tr>
               ))}
               <tr className="bg-gradient-to-r from-gray-100 to-gray-200 font-bold border-t-4 border-gray-300">
                 <td className="px-6 py-4 text-center text-lg text-gray-900 whitespace-nowrap" style={{ width: '25%' }}>
                   TOTAL
                 </td>
                 <td className="px-6 py-4 text-center text-lg text-green-700 whitespace-nowrap" style={{ width: '10.7%' }}>
                   {totalAtDate.toLocaleString('en-US')}
                 </td>
                 <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '10.7%' }}>
                   {total1To30.toLocaleString('en-US')}
                 </td>
                 <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '10.7%' }}>
                   {total31To60.toLocaleString('en-US')}
                 </td>
                 <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '10.7%' }}>
                   {total61To90.toLocaleString('en-US')}
                 </td>
                 <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '10.7%' }}>
                   {total91To120.toLocaleString('en-US')}
                 </td>
                 <td className="px-6 py-4 text-center text-lg text-red-700 whitespace-nowrap" style={{ width: '10.7%' }}>
                   {totalOlder.toLocaleString('en-US')}
                 </td>
                 <td className="px-6 py-4 text-center text-lg whitespace-nowrap" style={{ width: '10.7%' }}>
                   {grandTotal.toLocaleString('en-US')}
                 </td>
               </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
