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

      const summary: CustomerAgingSummary = {
        customerName,
        atDate: 0,
        oneToThirty: 0,
        thirtyOneToSixty: 0,
        sixtyOneToNinety: 0,
        ninetyOneToOneTwenty: 0,
        older: 0,
        total: netDebt
      };

      // Only process if there's outstanding debt
      if (netDebt > 0.01) {
        // Get all debits sorted by due date descending (newest first)
        const debits = customerInvoices
          .filter(inv => inv.debit > 0)
          .sort((a, b) => {
             // Prefer Due Date, fallback to Date
             const dateA = a.dueDate ? new Date(a.dueDate) : (a.date ? new Date(a.date) : new Date(0));
             const dateB = b.dueDate ? new Date(b.dueDate) : (b.date ? new Date(b.date) : new Date(0));
             return dateB.getTime() - dateA.getTime();
          });

        let remainingDebt = netDebt;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const inv of debits) {
          if (remainingDebt <= 0) break;

          const amountToAllocate = Math.min(inv.debit, remainingDebt);
          
          // Calculate days overdue
          const dueDate = inv.dueDate ? new Date(inv.dueDate) : (inv.date ? new Date(inv.date) : new Date());
          dueDate.setHours(0, 0, 0, 0);

          const diffTime = today.getTime() - dueDate.getTime();
          const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (daysOverdue <= 0) {
            summary.atDate += amountToAllocate;
          } else if (daysOverdue <= 30) {
            summary.oneToThirty += amountToAllocate;
          } else if (daysOverdue <= 60) {
            summary.thirtyOneToSixty += amountToAllocate;
          } else if (daysOverdue <= 90) {
            summary.sixtyOneToNinety += amountToAllocate;
          } else if (daysOverdue <= 120) {
            summary.ninetyOneToOneTwenty += amountToAllocate;
          } else {
            summary.older += amountToAllocate;
          }

          remainingDebt -= amountToAllocate;
        }
      } else if (netDebt < -0.01) {
          // Credit balance - treat as negative total, buckets remain 0 or negative?
          // Usually aging shows positive outstanding. Credit balance is just total negative.
          // We can leave buckets as 0 and total as negative.
      }

      summaries.push(summary);
    });

    return summaries.sort((a, b) => b.total - a.total);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return agingData;
    const query = searchQuery.toLowerCase();
    return agingData.filter((customer) =>
      customer.customerName.toLowerCase().includes(query)
    );
  }, [agingData, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => (
            <span className="font-medium text-gray-900">
                {info.getValue()}
            </span>
        ),
      }),
      columnHelper.accessor('atDate', {
        header: 'AT DATE',
        cell: (info) => (
            <span className="text-green-600 font-semibold">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('oneToThirty', {
        header: '1 - 30',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('thirtyOneToSixty', {
        header: '31 - 60',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('sixtyOneToNinety', {
        header: '61 - 90',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('ninetyOneToOneTwenty', {
        header: '91 - 120',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('older', {
        header: 'OLDER',
        cell: (info) => (
            <span className="text-red-600 font-semibold">
                {info.getValue().toLocaleString('en-US')}
            </span>
        ),
      }),
      columnHelper.accessor('total', {
        header: 'TOTAL',
        cell: (info) => {
            const value = info.getValue();
             return (
            <span className={`font-bold ${value > 0 ? 'text-gray-900' : 'text-green-600'}`}>
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Ages Analysis</h2>
        <p className="text-gray-600">Aging of accounts receivable by customer</p>
      </div>

      <div className="mb-4 flex justify-center">
        <input
          type="text"
          placeholder="Search by customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg text-center"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed' }}>
            <thead className="bg-gray-100">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const getWidth = () => {
                        const columnId = header.column.id;
                        if (columnId === 'customerName') return '20%';
                        // 7 numeric columns remaining = 80% / 7 ~ 11.4%
                        return '11.4%';
                    };
                    return (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-center font-semibold cursor-pointer hover:bg-gray-200"
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
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => {
                     const getWidth = () => {
                        const columnId = cell.column.id;
                        if (columnId === 'customerName') return '20%';
                        return '11.4%';
                    };
                    return (
                      <td key={cell.id} className="px-4 py-3 text-center text-lg" style={{ width: getWidth() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                  Total
                </td>
                <td className="px-4 py-3 text-center text-lg text-green-700" style={{ width: '11.4%' }}>
                  {totalAtDate.toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '11.4%' }}>
                  {total1To30.toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '11.4%' }}>
                  {total31To60.toLocaleString('en-US')}
                </td>
                 <td className="px-4 py-3 text-center text-lg" style={{ width: '11.4%' }}>
                  {total61To90.toLocaleString('en-US')}
                </td>
                 <td className="px-4 py-3 text-center text-lg" style={{ width: '11.4%' }}>
                  {total91To120.toLocaleString('en-US')}
                </td>
                 <td className="px-4 py-3 text-center text-lg text-red-700" style={{ width: '11.4%' }}>
                  {totalOlder.toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '11.4%' }}>
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
