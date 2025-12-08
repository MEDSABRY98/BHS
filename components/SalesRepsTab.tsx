'use client';

import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { InvoiceRow, SalesRepAnalysis } from '@/types';

interface SalesRepsTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<SalesRepAnalysis>();

export default function SalesRepsTab({ data }: SalesRepsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const salesRepAnalysis = useMemo(() => {
    const repMap = new Map<string, SalesRepAnalysis>();
    const customerCountMap = new Map<string, Set<string>>();

    data.forEach((row) => {
      const existing = repMap.get(row.salesRep) || {
        salesRep: row.salesRep,
        totalDebit: 0,
        totalCredit: 0,
        netDebt: 0,
        customerCount: 0,
        transactionCount: 0,
      };

      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
      existing.netDebt = existing.totalDebit - existing.totalCredit;
      existing.transactionCount += 1;

      if (!customerCountMap.has(row.salesRep)) {
        customerCountMap.set(row.salesRep, new Set());
      }
      customerCountMap.get(row.salesRep)!.add(row.customerName);

      repMap.set(row.salesRep, existing);
    });

    // Set customer counts
    repMap.forEach((rep, repName) => {
      rep.customerCount = customerCountMap.get(repName)?.size || 0;
    });

    return Array.from(repMap.values()).sort((a, b) => b.netDebt - a.netDebt);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return salesRepAnalysis;
    const query = searchQuery.toLowerCase();
    return salesRepAnalysis.filter((rep) =>
      rep.salesRep.toLowerCase().includes(query)
    );
  }, [salesRepAnalysis, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('salesRep', {
        header: 'Sales Rep',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('customerCount', {
        header: 'Customers',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('totalDebit', {
        header: 'Total Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('totalCredit', {
        header: 'Total Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('netDebt', {
        header: 'Net Debt',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
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

  const totalDebt = salesRepAnalysis.reduce((sum, r) => sum + r.netDebt, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Sales Reps Analysis</h2>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-lg">
            <span className="font-semibold">Total Debt:</span>{' '}
            <span className={totalDebt > 0 ? 'text-red-600' : 'text-green-600'}>
              {totalDebt.toLocaleString('en-US')}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Number of Sales Reps: {filteredData.length} {searchQuery && `(filtered from ${salesRepAnalysis.length})`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex justify-center">
        <input
          type="text"
          placeholder="Search by sales rep name..."
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
                      if (columnId === 'customerCount') return '16%';
                      if (columnId === 'netDebt') return '20%';
                      if (columnId === 'totalCredit') return '20%';
                      if (columnId === 'totalDebit') return '20%';
                      return '24%';
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
                      if (columnId === 'customerCount') return '16%';
                      if (columnId === 'netDebt') return '20%';
                      if (columnId === 'totalCredit') return '20%';
                      if (columnId === 'totalDebit') return '20%';
                      return '24%';
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
                <td className="px-4 py-3 text-center text-lg" style={{ width: '24%' }}>Total</td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '16%' }}>
                  {filteredData.reduce((sum, r) => sum + r.customerCount, 0)}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                  {filteredData.reduce((sum, r) => sum + r.totalDebit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                  {filteredData.reduce((sum, r) => sum + r.totalCredit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '20%' }}>
                  <span className={filteredData.reduce((sum, r) => sum + r.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, r) => sum + r.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, r) => sum + r.netDebt, 0).toLocaleString('en-US')}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
