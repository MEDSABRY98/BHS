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
import { InvoiceRow, CustomerAnalysis } from '@/types';
import CustomerDetails from './CustomerDetails';

interface CustomersTabProps {
  data: InvoiceRow[];
}

const columnHelper = createColumnHelper<CustomerAnalysis>();

export default function CustomersTab({ data }: CustomersTabProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [matchingFilter, setMatchingFilter] = useState('ALL');

  const customerAnalysis = useMemo(() => {
    // Intermediate structure to track matchings per customer
    type CustomerData = CustomerAnalysis & { matchingsMap: Map<string, number> };
    const customerMap = new Map<string, CustomerData>();

    data.forEach((row) => {
      let existing = customerMap.get(row.customerName);
      
      if (!existing) {
        existing = {
          customerName: row.customerName,
          totalDebit: 0,
          totalCredit: 0,
          netDebt: 0,
          transactionCount: 0,
          matchingsMap: new Map(),
        };
      }

      existing.totalDebit += row.debit;
      existing.totalCredit += row.credit;
      existing.netDebt = existing.totalDebit - existing.totalCredit;
      existing.transactionCount += 1;

      if (row.matching) {
          const currentMatchTotal = existing.matchingsMap.get(row.matching) || 0;
          existing.matchingsMap.set(row.matching, currentMatchTotal + (row.debit - row.credit));
      }

      customerMap.set(row.customerName, existing);
    });

    return Array.from(customerMap.values()).map(c => {
        // Check for any open matching
        let hasOpen = false;
        for (const amount of c.matchingsMap.values()) {
            if (Math.abs(amount) > 0.01) {
                hasOpen = true;
                break;
            }
        }
        
        return {
            customerName: c.customerName,
            totalDebit: c.totalDebit,
            totalCredit: c.totalCredit,
            netDebt: c.netDebt,
            transactionCount: c.transactionCount,
            hasOpenMatchings: hasOpen
        };
    }).sort((a, b) => b.netDebt - a.netDebt);
  }, [data]);

  const filteredData = useMemo(() => {
    let result = customerAnalysis;

    if (matchingFilter === 'OPEN') {
      result = result.filter(c => c.hasOpenMatchings);
    }

    if (!searchQuery.trim()) return result;
    
    const query = searchQuery.toLowerCase();
    return result.filter((customer) =>
      customer.customerName.toLowerCase().includes(query)
    );
  }, [customerAnalysis, searchQuery, matchingFilter]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => (
          <button
            onClick={() => setSelectedCustomer(info.getValue())}
            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left w-full flex items-center gap-2"
          >
            {info.getValue()}
            {info.row.original.hasOpenMatchings && (
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Has Open Matching"></span>
            )}
          </button>
        ),
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
        header: 'Net Debit',
        cell: (info) => {
          const value = info.getValue();
          return (
            <span className={value > 0 ? 'text-red-600' : value < 0 ? 'text-green-600' : ''}>
              {value.toLocaleString('en-US')}
            </span>
          );
        },
      }),
      columnHelper.accessor('transactionCount', {
        header: 'Transactions',
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

  const totalDebt = customerAnalysis.reduce((sum, c) => sum + c.netDebt, 0);

  // Filter invoices for selected customer
  const selectedCustomerInvoices = useMemo(() => {
    if (!selectedCustomer) return [];
    return data.filter((row) => row.customerName === selectedCustomer);
  }, [selectedCustomer, data]);

  // If a customer is selected, show their details
  if (selectedCustomer) {
    return (
      <CustomerDetails
        customerName={selectedCustomer}
        invoices={selectedCustomerInvoices}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Customers Analysis</h2>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-lg">
            <span className="font-semibold">Total Debit:</span>{' '}
            <span className={totalDebt > 0 ? 'text-red-600' : 'text-green-600'}>
              {totalDebt.toLocaleString('en-US')}
            </span>
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Number of Customers: {filteredData.length} {searchQuery && `(filtered from ${customerAnalysis.length})`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-col items-center gap-4">
        <div className="flex gap-4 w-full justify-center">
          <select
            value={matchingFilter}
            onChange={(e) => setMatchingFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Matching Only</option>
          </select>
        </div>

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
                      if (columnId === 'transactionCount') return '12%';
                      if (columnId === 'netDebt') return '18%';
                      if (columnId === 'totalCredit') return '18%';
                      if (columnId === 'totalDebit') return '18%';
                      return '34%';
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
                      return '34%';
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
                <td className="px-4 py-3 text-center text-lg" style={{ width: '34%' }}>
                  Total
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  {filteredData.reduce((sum, c) => sum + c.totalDebit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  {filteredData.reduce((sum, c) => sum + c.totalCredit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '18%' }}>
                  <span className={filteredData.reduce((sum, c) => sum + c.netDebt, 0) > 0 ? 'text-red-600' : filteredData.reduce((sum, c) => sum + c.netDebt, 0) < 0 ? 'text-green-600' : ''}>
                    {filteredData.reduce((sum, c) => sum + c.netDebt, 0).toLocaleString('en-US')}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-lg" style={{ width: '12%' }}>
                  {filteredData.reduce((sum, c) => sum + c.transactionCount, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
