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
import { InvoiceRow, MonthAnalysis } from '@/types';

interface MonthsTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<MonthAnalysis>();

const monthNames: { [key: string]: string } = {
  '1': 'January',
  '2': 'February',
  '3': 'March',
  '4': 'April',
  '5': 'May',
  '6': 'June',
  '7': 'July',
  '8': 'August',
  '9': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
};

export default function MonthsTab({ data }: MonthsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const monthAnalysis = useMemo(() => {
    const monthMap = new Map<string, MonthAnalysis>();

    data.forEach((row) => {
      let year = '';
      let month = '';

      // Try to parse date
      const dateObj = new Date(row.date);
      if (!isNaN(dateObj.getTime())) {
        year = dateObj.getFullYear().toString();
        month = (dateObj.getMonth() + 1).toString();
      } else {
        // Try to extract year from date string
        const yearMatch = row.date.match(/\d{4}/);
        if (yearMatch) {
          year = yearMatch[0];
        }
        // Try to extract month from date string (MM/DD/YYYY or DD/MM/YYYY format)
        const dateParts = row.date.match(/\d{1,2}/g);
        if (dateParts && dateParts.length >= 2) {
          // Assuming format like MM/DD/YYYY or DD/MM/YYYY
          // You may need to adjust based on your date format
          const monthMatch = dateParts[0];
          if (monthMatch) {
            month = monthMatch;
          }
        }
      }

      if (!year || !month) return;

      const key = `${year}-${month.padStart(2, '0')}`;
      const existing = monthMap.get(key) || {
        month,
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

      monthMap.set(key, existing);
    });

    return Array.from(monthMap.values()).sort((a, b) => {
      const aKey = `${a.year}-${a.month.padStart(2, '0')}`;
      const bKey = `${b.year}-${b.month.padStart(2, '0')}`;
      return aKey.localeCompare(bKey);
    });
  }, [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return monthAnalysis;
    const query = searchQuery.toLowerCase();
    return monthAnalysis.filter((month) =>
      month.year.toLowerCase().includes(query) ||
      monthNames[month.month]?.toLowerCase().includes(query) ||
      month.month.includes(query)
    );
  }, [monthAnalysis, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('transactionCount', {
        header: 'Transactions',
        cell: (info) => info.getValue(),
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
      columnHelper.accessor('totalCredit', {
        header: 'Total Credit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('totalDebit', {
        header: 'Total Debit',
        cell: (info) => info.getValue().toLocaleString('en-US'),
      }),
      columnHelper.accessor('month', {
        header: 'Month',
        cell: (info) => monthNames[info.getValue()] || info.getValue(),
      }),
      columnHelper.accessor('year', {
        header: 'Year',
        cell: (info) => info.getValue(),
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

  const totalDebt = monthAnalysis.reduce((sum, m) => sum + m.netDebt, 0);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Months Analysis</h2>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-lg">
            <span className="font-semibold">Total Debt:</span>{' '}
            <span className={totalDebt > 0 ? 'text-red-600' : 'text-green-600'}>
              {totalDebt.toLocaleString('en-US')}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Number of Months: {filteredData.length} {searchQuery && `(filtered from ${monthAnalysis.length})`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex justify-center">
        <input
          type="text"
          placeholder="Search by year or month..."
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
                      if (columnId === 'transactionCount') return '12%';
                      if (columnId === 'netDebt') return '18%';
                      if (columnId === 'totalCredit') return '18%';
                      if (columnId === 'totalDebit') return '18%';
                      if (columnId === 'month') return '17%';
                      return '17%';
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
                      if (columnId === 'transactionCount') return '12%';
                      if (columnId === 'netDebt') return '18%';
                      if (columnId === 'totalCredit') return '18%';
                      if (columnId === 'totalDebit') return '18%';
                      if (columnId === 'month') return '17%';
                      return '17%';
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
                <td className="px-4 py-3 text-center text-lg" style={{ width: '12%' }}>
                  {filteredData.reduce((sum, m) => sum + m.transactionCount, 0)}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  <span className={filteredData.reduce((sum, m) => sum + m.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, m) => sum + m.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, m) => sum + m.netDebt, 0).toLocaleString('en-US')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  {filteredData.reduce((sum, m) => sum + m.totalCredit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  {filteredData.reduce((sum, m) => sum + m.totalDebit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '17%' }}></td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '17%' }}>Total</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

