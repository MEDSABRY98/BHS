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
import { InvoiceRow, YearAnalysis } from '@/types';

interface YearsTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<YearAnalysis>();

export default function YearsTab({ data }: YearsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const yearAnalysis = useMemo(() => {
    const yearMap = new Map<string, YearAnalysis>();

    data.forEach((row) => {
      const year = new Date(row.date).getFullYear().toString();
      if (isNaN(new Date(row.date).getTime())) {
        // Try to extract year from date string if date parsing fails
        const yearMatch = row.date.match(/\d{4}/);
        if (yearMatch) {
          const extractedYear = yearMatch[0];
          const existing = yearMap.get(extractedYear) || {
            year: extractedYear,
            totalDebit: 0,
            totalCredit: 0,
            netDebt: 0,
            transactionCount: 0,
          };

          existing.totalDebit += row.debit;
          existing.totalCredit += row.credit;
          existing.netDebt = existing.totalDebit - existing.totalCredit;
          existing.transactionCount += 1;

          yearMap.set(extractedYear, existing);
        }
        return;
      }

      const existing = yearMap.get(year) || {
        year,
        totalDebit: 0,
        totalCredit: 0,
        netDebt: 0,
        transactionCount: 0,
      };

      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
      existing.netDebt = existing.totalDebit - existing.totalCredit;
      existing.transactionCount += 1;

      yearMap.set(year, existing);
    });

    return Array.from(yearMap.values()).sort((a, b) => a.year.localeCompare(b.year));
  }, [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return yearAnalysis;
    const query = searchQuery.toLowerCase();
    return yearAnalysis.filter((year) =>
      year.year.toLowerCase().includes(query)
    );
  }, [yearAnalysis, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('year', {
        header: 'Year',
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

  const totalDebt = yearAnalysis.reduce((sum, y) => sum + y.netDebt, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Years Analysis</h2>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-lg">
            <span className="font-semibold">Total Debt:</span>{' '}
            <span className={totalDebt > 0 ? 'text-red-600' : 'text-green-600'}>
              {totalDebt.toLocaleString('en-US')}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Number of Years: {filteredData.length} {searchQuery && `(filtered from ${yearAnalysis.length})`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex justify-center">
        <input
          type="text"
          placeholder="Search by year..."
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
                      if (columnId === 'netDebt') return '24%';
                      if (columnId === 'totalCredit') return '24%';
                      if (columnId === 'totalDebit') return '24%';
                      return '28%';
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
                      if (columnId === 'netDebt') return '24%';
                      if (columnId === 'totalCredit') return '24%';
                      if (columnId === 'totalDebit') return '24%';
                      return '28%';
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
                <td className="px-4 py-3 text-center text-lg" style={{ width: '28%' }}>Total</td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '24%' }}>
                  {filteredData.reduce((sum, y) => sum + y.totalDebit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '24%' }}>
                  {filteredData.reduce((sum, y) => sum + y.totalCredit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '24%' }}>
                  <span className={filteredData.reduce((sum, y) => sum + y.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, y) => sum + y.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, y) => sum + y.netDebt, 0).toLocaleString('en-US')}
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
