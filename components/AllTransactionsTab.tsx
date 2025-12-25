'use client';

import { useMemo, useState, Fragment } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  PaginationState,
} from '@tanstack/react-table';
import { InvoiceRow } from '@/types';

interface AllTransactionsTabProps {
  data: InvoiceRow[];
}

interface TransactionItem {
  customerName: string;
  date: Date;
  number: string;
  debit: number;
  credit: number;
  netAmount: number;
  type: 'Payment' | 'Discount' | 'Return' | 'Sales' | 'OB';
  matching?: string;
}

const columnHelper = createColumnHelper<TransactionItem>();

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    if (p1 > 12 || p3 > 31) {
      return new Date(p3, p2 - 1, p1);
    }
  }
  return null;
};

export default function AllTransactionsTab({ data }: AllTransactionsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Payment' | 'Discount' | 'Return' | 'Sales' | 'OB'>('ALL');
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [viewMode, setViewMode] = useState<'details' | 'byCustomer'>('details');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  // Get ALL transactions (not just open ones)
  const allTransactions = useMemo(() => {
    const items: TransactionItem[] = [];

    data.forEach(inv => {
      const num = inv.number?.toString().toUpperCase() || '';
      const rowDate = parseDate(inv.date);
      if (!rowDate) return;

      let type: TransactionItem['type'] | null = null;
      
      if (num.startsWith('OB')) {
        type = 'OB';
      } else if (num.startsWith('BNK')) {
        type = 'Payment';
      } else if (num.startsWith('SAL')) {
        type = 'Sales';
      } else if (num.startsWith('RSAL')) {
        type = 'Return';
      } else if (num.startsWith('JV') || num.startsWith('BIL')) {
        type = 'Discount';
      } else if (inv.credit > 0.01) {
        type = 'Payment';
      } else {
        type = 'Sales'; // Default for other invoice types
      }

      const netAmount = inv.debit - inv.credit;

      items.push({
        customerName: inv.customerName || 'Unknown',
        date: rowDate,
        number: inv.number || '',
        debit: inv.debit,
        credit: inv.credit,
        netAmount: netAmount,
        type,
        matching: inv.matching
      });
    });

    // Sort by date descending
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);

  const filteredItems = useMemo(() => {
    let filtered = allTransactions;

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter(item => item.type === typeFilter);
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);

        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (itemDate < fromDate) return false;
        }

        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (itemDate > toDate) return false;
        }

        return true;
      });
    }

    // Search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.customerName.toLowerCase().includes(query) ||
        item.number.toLowerCase().includes(query) ||
        item.date.toLocaleDateString('en-US').toLowerCase().includes(query) ||
        item.debit.toString().includes(query) ||
        item.credit.toString().includes(query) ||
        item.netAmount.toString().includes(query) ||
        item.matching?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allTransactions, typeFilter, dateFrom, dateTo, searchQuery]);

  const groupedByCustomer = useMemo(() => {
    const map = new Map<
      string,
      {
        customerName: string;
        itemCount: number;
        totalDebit: number;
        totalCredit: number;
        totalNet: number;
      }
    >();

    filteredItems.forEach((item) => {
      const key = item.customerName || 'Unknown';
      if (!map.has(key)) {
        map.set(key, {
          customerName: key,
          itemCount: 0,
          totalDebit: 0,
          totalCredit: 0,
          totalNet: 0,
        });
      }
      const entry = map.get(key)!;
      entry.itemCount += 1;
      entry.totalDebit += item.debit;
      entry.totalCredit += item.credit;
      entry.totalNet += item.netAmount;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.customerName.localeCompare(b.customerName),
    );
  }, [filteredItems]);

  const getTypeColor = (type: TransactionItem['type']) => {
    switch (type) {
      case 'Payment':
        return 'bg-green-100 text-green-700';
      case 'Discount':
        return 'bg-yellow-100 text-yellow-700';
      case 'Return':
        return 'bg-orange-100 text-orange-700';
      case 'Sales':
        return 'bg-blue-100 text-blue-700';
      case 'OB':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('customerName', {
        header: 'Customer Name',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => info.getValue().toLocaleDateString('en-US'),
      }),
      columnHelper.accessor('number', {
        header: 'Invoice Number',
        cell: (info) => {
          const invoiceNumber = info.getValue();
          const maxLength = 20;
          const displayText = invoiceNumber.length > maxLength 
            ? `${invoiceNumber.substring(0, maxLength)}...` 
            : invoiceNumber;
          
          return (
            <button
              onClick={() => setSelectedInvoiceNumber(invoiceNumber)}
              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-mono text-sm truncate max-w-full block mx-auto"
              title={invoiceNumber}
            >
              {displayText}
            </button>
          );
        },
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) => (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getTypeColor(info.getValue())}`}>
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('debit', {
        header: 'Debit',
        cell: (info) =>
          info.getValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      }),
      columnHelper.accessor('credit', {
        header: 'Credit',
        cell: (info) =>
          info.getValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      }),
      columnHelper.accessor('netAmount', {
        header: 'Net Amount',
        cell: (info) => {
          const value = info.getValue();
          const isNegative = value < 0;
          return (
            <span className={`font-semibold ${isNegative ? 'text-green-600' : 'text-orange-600'}`}>
              {value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          );
        },
      }),
      columnHelper.accessor('matching', {
        header: 'Matching',
        cell: (info) => {
          const matching = info.getValue();
          return matching ? (
            <span className="text-blue-600 font-mono text-sm">{matching}</span>
          ) : (
            <span className="text-gray-400">-</span>
          );
        },
      }),
    ],
    []
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">All Transactions</h2>
        
        <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <p className="text-lg">
              <span className="font-semibold">Total Transactions:</span>{' '}
              <span className="text-blue-600">{filteredItems.length}</span>
              {searchQuery && ` of ${allTransactions.length}`}
            </p>
          </div>
          <div className="inline-flex items-center bg-white rounded-full shadow-sm border border-blue-100 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setViewMode('details')}
              className={`px-4 py-1.5 font-medium transition-colors ${
                viewMode === 'details'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              Detail View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('byCustomer')}
              className={`px-4 py-1.5 font-medium border-l border-blue-100 transition-colors ${
                viewMode === 'byCustomer'
                  ? 'bg-blue-600 text-white'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              Group by Customer
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-4">
          {/* Search Box */}
          <div className="flex justify-center">
            <div className="w-full max-w-2xl">
              <input
                type="text"
                placeholder="Search by customer name, invoice number, date, amounts, or matching..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>
          </div>

          {/* Date Range and Type Filters */}
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">From Date:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">To Date:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Type:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white"
              >
                <option value="ALL">All Types</option>
                <option value="Payment">Payments</option>
                <option value="Discount">Discounts</option>
                <option value="Return">Returns</option>
                <option value="Sales">Sales</option>
                <option value="OB">Opening Balance</option>
              </select>
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {viewMode === 'details' ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
                  <thead className="bg-gray-100">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          const getWidth = () => {
                            const columnId = header.column.id;
                            if (columnId === 'customerName') return '32%';
                            if (columnId === 'date') return '8%';
                            if (columnId === 'number') return '11%';
                            if (columnId === 'type') return '7%';
                            if (columnId === 'debit') return '9%';
                            if (columnId === 'credit') return '9%';
                            if (columnId === 'netAmount') return '14%';
                            if (columnId === 'matching') return '10%';
                            return 'auto';
                          };
                          const alignClass =
                            header.column.id === 'customerName' ? 'text-left' : 'text-center';
                          return (
                            <th
                              key={header.id}
                              className={`px-4 py-3 font-semibold ${alignClass}`}
                              style={{ width: getWidth() }}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-lg">
                          {searchQuery || dateFrom || dateTo || typeFilter !== 'ALL'
                            ? 'No transactions found matching your criteria'
                            : 'No transactions found'}
                        </td>
                      </tr>
                    ) : (
                      table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-gray-50">
                          {row.getVisibleCells().map((cell) => {
                            const getWidth = () => {
                              const columnId = cell.column.id;
                              if (columnId === 'customerName') return '32%';
                              if (columnId === 'date') return '8%';
                              if (columnId === 'number') return '11%';
                              if (columnId === 'type') return '7%';
                              if (columnId === 'debit') return '9%';
                              if (columnId === 'credit') return '9%';
                              if (columnId === 'netAmount') return '14%';
                              if (columnId === 'matching') return '10%';
                              return 'auto';
                            };
                            const alignClass =
                              cell.column.id === 'customerName' ? 'text-left' : 'text-center';
                            return (
                              <td
                                key={cell.id}
                                className={`px-4 py-3 text-lg ${alignClass}`}
                                style={{ width: getWidth() }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                    {filteredItems.length > 0 && (
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                        <td className="px-4 py-3 text-center text-lg">Total</td>
                        <td className="px-4 py-3 text-center text-lg">-</td>
                        <td className="px-4 py-3 text-center text-lg">-</td>
                        <td className="px-4 py-3 text-center text-lg">-</td>
                        <td className="px-4 py-3 text-center text-lg">
                          {filteredItems.reduce((sum, item) => sum + item.debit, 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-center text-lg">
                          {filteredItems.reduce((sum, item) => sum + item.credit, 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-center text-lg">
                          {(() => {
                            const total = filteredItems.reduce((sum, item) => sum + item.netAmount, 0);
                            const isNegative = total < 0;
                            return (
                              <span
                                className={`font-semibold ${
                                  isNegative ? 'text-green-600' : 'text-orange-600'
                                }`}
                              >
                                {total.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3 text-center text-lg">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {filteredItems.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {'<<'}
                    </button>
                    <button
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {'<'}
                    </button>
                    <button
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {'>'}
                    </button>
                    <button
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                      className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {'>>'}
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-700">
                      Page{' '}
                      <strong>
                        {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                      </strong>
                    </span>
                    <span className="text-sm text-gray-700">
                      Showing {table.getRowModel().rows.length} of {filteredItems.length} items
                    </span>
                    <select
                      value={table.getState().pagination.pageSize}
                      onChange={(e) => {
                        table.setPageSize(Number(e.target.value));
                      }}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white"
                    >
                      {[25, 50, 100, 200, 250].map((pageSize) => (
                        <option key={pageSize} value={pageSize}>
                          Show {pageSize}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold" style={{ width: '35%' }}>
                      Customer Name
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" style={{ width: '15%' }}>
                      Transactions
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" style={{ width: '15%' }}>
                      Total Debit
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" style={{ width: '15%' }}>
                      Total Credit
                    </th>
                    <th className="px-4 py-3 text-center font-semibold" style={{ width: '20%' }}>
                      Total Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groupedByCustomer.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-gray-500 text-lg"
                      >
                        {searchQuery || dateFrom || dateTo || typeFilter !== 'ALL'
                          ? 'No customers match your criteria'
                          : 'No customers found'}
                      </td>
                    </tr>
                  ) : (
                    groupedByCustomer.map((row) => {
                      const isNegative = row.totalNet < 0;
                      const isExpanded = expandedCustomer === row.customerName;
                      return (
                        <Fragment key={row.customerName}>
                          <tr
                            className="border-b hover:bg-gray-50 cursor-pointer"
                            onClick={() =>
                              setExpandedCustomer((prev) =>
                                prev === row.customerName ? null : row.customerName,
                              )
                            }
                          >
                            <td className="px-4 py-3 text-left text-base font-semibold text-gray-900">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                                    isExpanded
                                      ? 'bg-blue-600 text-white border-blue-600'
                                      : 'bg-white text-blue-700 border-blue-300'
                                  }`}
                                >
                                  {isExpanded ? '-' : '+'}
                                </span>
                                <span>{row.customerName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-base">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                {row.itemCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-base">
                              {row.totalDebit.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 text-center text-base">
                              {row.totalCredit.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 text-center text-base">
                              <span
                                className={`font-semibold ${
                                  isNegative ? 'text-green-600' : 'text-orange-600'
                                }`}
                              >
                                {row.totalNet.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-gray-50 border-b">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="text-sm font-semibold text-gray-700 mb-2">
                                  Transactions for {row.customerName}
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm" style={{ direction: 'ltr' }}>
                                    <thead>
                                      <tr className="bg-gray-100">
                                        <th className="px-3 py-2 text-center font-semibold">Date</th>
                                        <th className="px-3 py-2 text-center font-semibold">
                                          Invoice #
                                        </th>
                                        <th className="px-3 py-2 text-center font-semibold">Type</th>
                                        <th className="px-3 py-2 text-center font-semibold">Debit</th>
                                        <th className="px-3 py-2 text-center font-semibold">Credit</th>
                                        <th className="px-3 py-2 text-center font-semibold">
                                          Net
                                        </th>
                                        <th className="px-3 py-2 text-center font-semibold">
                                          Matching
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredItems
                                        .filter((i) => i.customerName === row.customerName)
                                        .map((item, idx) => {
                                          const isNeg = item.netAmount < 0;
                                          return (
                                            <tr key={`${item.number}-${idx}`} className="border-b">
                                              <td className="px-3 py-1.5 text-center">
                                                {item.date.toLocaleDateString('en-US')}
                                              </td>
                                              <td className="px-3 py-1.5 text-center text-sm font-mono">
                                                {item.number}
                                              </td>
                                              <td className="px-3 py-1.5 text-center">
                                                <span
                                                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${getTypeColor(
                                                    item.type,
                                                  )}`}
                                                >
                                                  {item.type}
                                                </span>
                                              </td>
                                              <td className="px-3 py-1.5 text-center">
                                                {item.debit.toLocaleString('en-US', {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                })}
                                              </td>
                                              <td className="px-3 py-1.5 text-center">
                                                {item.credit.toLocaleString('en-US', {
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                })}
                                              </td>
                                              <td className="px-3 py-1.5 text-center">
                                                <span
                                                  className={`font-semibold ${
                                                    isNeg ? 'text-green-600' : 'text-orange-600'
                                                  }`}
                                                >
                                                  {item.netAmount.toLocaleString('en-US', {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                  })}
                                                </span>
                                              </td>
                                              <td className="px-3 py-1.5 text-center text-xs text-gray-600">
                                                {item.matching || '-'}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                  {groupedByCustomer.length > 0 && (
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                      <td className="px-4 py-3 text-left text-base">
                        Total ({groupedByCustomer.length.toLocaleString('en-US')} customer
                        {groupedByCustomer.length === 1 ? '' : 's'})
                      </td>
                      <td className="px-4 py-3 text-center text-base">
                        {groupedByCustomer.reduce((sum, row) => sum + row.itemCount, 0)}
                      </td>
                      <td className="px-4 py-3 text-center text-base">
                        {groupedByCustomer
                          .reduce((sum, row) => sum + row.totalDebit, 0)
                          .toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </td>
                      <td className="px-4 py-3 text-center text-base">
                        {groupedByCustomer
                          .reduce((sum, row) => sum + row.totalCredit, 0)
                          .toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </td>
                      <td className="px-4 py-3 text-center text-base">
                        {(() => {
                          const totalNet = groupedByCustomer.reduce(
                            (sum, row) => sum + row.totalNet,
                            0,
                          );
                          const isNegative = totalNet < 0;
                          return (
                            <span
                              className={`font-semibold ${
                                isNegative ? 'text-green-600' : 'text-orange-600'
                              }`}
                            >
                              {totalNet.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Number Popup */}
      {selectedInvoiceNumber && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50"
          onClick={() => setSelectedInvoiceNumber(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 border border-gray-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Invoice Number</h3>
              <button
                onClick={() => setSelectedInvoiceNumber(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-lg font-mono break-all">{selectedInvoiceNumber}</p>
            </div>
            <button
              onClick={() => setSelectedInvoiceNumber(null)}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

