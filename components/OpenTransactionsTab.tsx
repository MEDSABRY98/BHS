'use client';

import { useMemo, useState, Fragment } from 'react';
import * as XLSX from 'xlsx';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  PaginationState,
} from '@tanstack/react-table';
import { InvoiceRow } from '@/types';

interface CustomersOpenMatchesTabProps {
  data: InvoiceRow[];
}

interface OpenMatchItem {
  customerName: string;
  date: Date;
  number: string;
  debit: number;
  credit: number;
  remainingAmount: number;
  type: 'Payment' | 'R-Payment' | 'Discount' | 'Return' | 'Sales' | 'OB' | 'Our-Paid';
  matching?: string;
}

const columnHelper = createColumnHelper<OpenMatchItem>();

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

export default function OpenTransactionsTab({ data }: CustomersOpenMatchesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Payment' | 'R-Payment' | 'Discount' | 'Return' | 'Sales' | 'OB' | 'Our-Paid'>('ALL');
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  const [viewMode, setViewMode] = useState<'details' | 'byCustomer'>('details');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);

  const openMatches = useMemo(() => {
    const customerGroups = new Map<string, InvoiceRow[]>();
    data.forEach(row => {
      const customer = row.customerName;
      if (!customerGroups.has(customer)) {
        customerGroups.set(customer, []);
      }
      customerGroups.get(customer)!.push(row);
    });

    const items: OpenMatchItem[] = [];

    customerGroups.forEach((customerInvoices, customerName) => {
      // Calculate matching totals and residuals (same logic as CustomerDetails)
      const matchingTotals = new Map<string, number>();

      customerInvoices.forEach(inv => {
        if (inv.matching) {
          const currentTotal = matchingTotals.get(inv.matching) || 0;
          matchingTotals.set(inv.matching, currentTotal + (inv.debit - inv.credit));
        }
      });

      const targetResidualIndices = new Map<string, number>();
      const maxDebits = new Map<string, number>();

      customerInvoices.forEach((inv, index) => {
        if (inv.matching) {
          const currentMax = maxDebits.get(inv.matching) ?? -1;
          if (inv.debit > currentMax) {
            maxDebits.set(inv.matching, inv.debit);
            targetResidualIndices.set(inv.matching, index);
          } else if (!targetResidualIndices.has(inv.matching)) {
            maxDebits.set(inv.matching, inv.debit);
            targetResidualIndices.set(inv.matching, index);
          }
        }
      });

      const invoicesWithNetDebt = customerInvoices.map((invoice, index) => {
        let residual: number | undefined = undefined;

        if (invoice.matching) {
          const targetIndex = targetResidualIndices.get(invoice.matching);
          if (targetIndex === index) {
            const total = matchingTotals.get(invoice.matching) || 0;
            if (Math.abs(total) > 0.01) {
              residual = total;
            }
          }
        }

        return {
          ...invoice,
          netDebt: invoice.debit - invoice.credit,
          residual
        };
      });

      // Filter for open items (unmatched OR with residual)
      const openInvoices = invoicesWithNetDebt.filter(inv => {
        if (!inv.matching) {
          return Math.abs(inv.netDebt) > 0.01;
        }
        return inv.residual !== undefined && Math.abs(inv.residual) > 0.01;
      }).map(inv => {
        let difference = inv.netDebt;

        if (inv.matching && inv.residual !== undefined) {
          difference = inv.residual;
        }

        const adjustedCredit = inv.debit - difference;

        return {
          ...inv,
          credit: adjustedCredit,
          difference
        };
      });

      // Categorize and add open items
      openInvoices.forEach(inv => {
        const num = inv.number?.toString().toUpperCase() || '';
        const rowDate = parseDate(inv.date);
        if (!rowDate) return;

        let type: OpenMatchItem['type'] | null = null;

        if (num.startsWith('OB')) {
          type = 'OB';
        } else if (num.startsWith('BNK')) {
          // Bank transfers with Debit are 'R-Payment' (Bounced/Refund)
          type = inv.debit > 0.01 ? 'R-Payment' : 'Payment';
        } else if (num.startsWith('PBNK') && inv.debit > 0.01) {
          type = 'Our-Paid';
        } else if (num.startsWith('SAL')) {
          // Only show SAL if it's partially closed (has matching and residual)
          // Don't show unmatched SAL (fully open)
          if (inv.matching && inv.residual !== undefined && Math.abs(inv.residual) > 0.01) {
            type = 'Sales';
          }
        } else if (num.startsWith('RSAL')) {
          type = 'Return';
        } else if (num.startsWith('JV') || num.startsWith('BIL')) {
          type = 'Discount';
        } else if (inv.credit > 0.01) {
          // Payment (credit > 0, not SAL/RSAL/BIL/JV/OB)
          type = 'Payment';
        }

        if (type && Math.abs(inv.difference) > 0.01) {
          items.push({
            customerName,
            date: rowDate,
            number: inv.number || '',
            debit: inv.debit,
            credit: inv.credit,
            remainingAmount: inv.difference, // Keep the sign (positive or negative)
            type,
            matching: inv.matching
          });
        }
      });
    });

    // Sort by date descending
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data]);

  const filteredItems = useMemo(() => {
    let filtered = openMatches;

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
        item.date.toLocaleDateString('en-GB').toLowerCase().includes(query) ||
        item.debit.toString().includes(query) ||
        item.credit.toString().includes(query) ||
        item.remainingAmount.toString().includes(query) ||
        item.matching?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [openMatches, typeFilter, dateFrom, dateTo, searchQuery]);

  const groupedByCustomer = useMemo(() => {
    const map = new Map<
      string,
      {
        customerName: string;
        itemCount: number;
        totalDebit: number;
        totalCredit: number;
        totalRemaining: number;
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
          totalRemaining: 0,
        });
      }
      const entry = map.get(key)!;
      entry.itemCount += 1;
      entry.totalDebit += item.debit;
      entry.totalCredit += item.credit;
      entry.totalRemaining += item.remainingAmount;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.customerName.localeCompare(b.customerName),
    );
  }, [filteredItems]);

  const getTypeColor = (type: OpenMatchItem['type']) => {
    switch (type) {
      case 'Payment':
        return 'bg-green-100 text-green-700';
      case 'R-Payment':
        return 'bg-red-100 text-red-700';
      case 'Discount':
        return 'bg-yellow-100 text-yellow-700';
      case 'Return':
        return 'bg-orange-100 text-orange-700';
      case 'Sales':
        return 'bg-blue-100 text-blue-700';
      case 'OB':
        return 'bg-purple-100 text-purple-700';
      case 'Our-Paid':
        return 'bg-emerald-100 text-emerald-800';
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
        cell: (info) => info.getValue().toLocaleDateString('en-GB'),
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
      columnHelper.accessor('remainingAmount', {
        header: 'Remaining Amount',
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

  const exportToExcel = () => {
    const headers = ['Customer Name', 'Date', 'Invoice Number', 'Type', 'Debit', 'Credit', 'Remaining Amount', 'Matching'];
    const rows = filteredItems.map(item => [
      item.customerName,
      item.date.toLocaleDateString('en-GB'),
      item.number,
      item.type,
      item.debit,
      item.credit,
      item.remainingAmount,
      item.matching || ''
    ]);

    // Add totals row
    const totalDebit = filteredItems.reduce((sum, item) => sum + item.debit, 0);
    const totalCredit = filteredItems.reduce((sum, item) => sum + item.credit, 0);
    const totalRemaining = filteredItems.reduce((sum, item) => sum + item.remainingAmount, 0);
    rows.push(['Total', '', '', '', totalDebit, totalCredit, totalRemaining, '']);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Open Items');

    // Auto-size columns (rough approximation)
    const colWidths = [30, 12, 15, 12, 12, 12, 12, 15];
    worksheet['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.writeFile(workbook, `open_transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="p-6">
      <div className="bg-blue-50 p-4 rounded-lg mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-lg">
            <span className="font-semibold">Total Open Items:</span>{' '}
            <span className="text-blue-600">{filteredItems.length}</span>
            {searchQuery && ` of ${openMatches.length}`}
          </p>
          <button
            onClick={exportToExcel}
            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
            title="Export to Excel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div className="inline-flex items-center bg-white rounded-full shadow-sm border border-blue-100 overflow-hidden text-sm">
          <button
            type="button"
            onClick={() => setViewMode('details')}
            className={`px-4 py-1.5 font-medium transition-colors ${viewMode === 'details'
              ? 'bg-blue-600 text-white'
              : 'text-blue-700 hover:bg-blue-50'
              }`}
          >
            Detail View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('byCustomer')}
            className={`px-4 py-1.5 font-medium border-l border-blue-100 transition-colors ${viewMode === 'byCustomer'
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
              <option value="R-Payment">R-Payment</option>
              <option value="Discount">Discounts</option>
              <option value="Return">Returns</option>
              <option value="Sales">Sales</option>
              <option value="OB">Opening Balance</option>
              <option value="Our-Paid">Our-Paid</option>
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
                          if (columnId === 'remainingAmount') return '14%';
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
                          ? 'No open items found matching your criteria'
                          : 'No open matches found'}
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
                            if (columnId === 'remainingAmount') return '14%';
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
                          const total = filteredItems.reduce((sum, item) => sum + item.remainingAmount, 0);
                          const isNegative = total < 0;
                          return (
                            <span
                              className={`font-semibold ${isNegative ? 'text-green-600' : 'text-orange-600'
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
                    Open Items
                  </th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ width: '15%' }}>
                    Total Debit
                  </th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ width: '15%' }}>
                    Total Credit
                  </th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ width: '20%' }}>
                    Total Remaining
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
                        ? 'No open customers match your criteria'
                        : 'No customers with open matches found'}
                    </td>
                  </tr>
                ) : (
                  groupedByCustomer.map((row) => {
                    const isNegative = row.totalRemaining < 0;
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
                                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${isExpanded
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
                              className={`font-semibold ${isNegative ? 'text-green-600' : 'text-orange-600'
                                }`}
                            >
                              {row.totalRemaining.toLocaleString('en-US', {
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
                                Open items for {row.customerName}
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
                                        Remaining
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
                                        const isNeg = item.remainingAmount < 0;
                                        return (
                                          <tr key={`${item.number}-${idx}`} className="border-b">
                                            <td className="px-3 py-1.5 text-center">
                                              {item.date.toLocaleDateString('en-GB')}
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
                                                className={`font-semibold ${isNeg ? 'text-green-600' : 'text-orange-600'
                                                  }`}
                                              >
                                                {item.remainingAmount.toLocaleString('en-US', {
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
                        const totalRemaining = groupedByCustomer.reduce(
                          (sum, row) => sum + row.totalRemaining,
                          0,
                        );
                        const isNegative = totalRemaining < 0;
                        return (
                          <span
                            className={`font-semibold ${isNegative ? 'text-green-600' : 'text-orange-600'
                              }`}
                          >
                            {totalRemaining.toLocaleString('en-US', {
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

