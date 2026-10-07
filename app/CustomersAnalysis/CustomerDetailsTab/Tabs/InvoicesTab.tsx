import React from 'react';
import { flexRender } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { SharedTabProps } from '../Types';

export default function InvoicesTab(props: SharedTabProps) {
  const { invoiceTable, totalDebit, totalCredit, totalNetDebt } = props;
  const hasRows = invoiceTable.getRowModel().rows.length > 0;

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {hasRows ? (
          <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
            <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
              {invoiceTable.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: any) => {
                    const getWidth = () => {
                      const columnId = header.column.id;
                      if (columnId === 'select') return '5%';
                      if (columnId === 'date') return '13%';
                      if (columnId === 'type') return '10%';
                      if (columnId === 'number') return '13%';
                      if (columnId === 'debit') return '13%';
                      if (columnId === 'credit') return '13%';
                      if (columnId === 'netDebt') return '13%';
                      if (columnId === 'matching') return '13%';
                      if (columnId === 'residual') return '9%';
                      return '13%';
                    };
                    return (
                      <th
                        key={header.id}
                        className="px-6 py-4 text-center text-xs font-extrabold text-gray-800 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
                        style={{ width: getWidth() }}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: ' ↑',
                            desc: ' ↓',
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {invoiceTable.getRowModel().rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-blue-50/30 transition-colors group">
                  {row.getVisibleCells().map((cell: any) => {
                    const getWidth = () => {
                      const columnId = cell.column.id;
                      if (columnId === 'select') return '5%';
                      if (columnId === 'date') return '13%';
                      if (columnId === 'type') return '10%';
                      if (columnId === 'number') return '13%';
                      if (columnId === 'debit') return '13%';
                      if (columnId === 'credit') return '13%';
                      if (columnId === 'netDebt') return '13%';
                      if (columnId === 'matching') return '13%';
                      if (columnId === 'residual') return '9%';
                      return '13%';
                    };
                    return (
                      <td key={cell.id} className="px-6 py-4 text-center text-sm text-gray-700 font-medium group-hover:text-gray-900" style={{ width: getWidth() }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="bg-gray-50 border-t-2 border-gray-200">
                <td className="px-6 py-4" style={{ width: '5%' }}></td>
                <td className="px-6 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide" style={{ width: '13%' }}>Total</td>
                <td className="px-6 py-4" style={{ width: '10%' }}></td>
                <td className="px-6 py-4" style={{ width: '13%' }}></td>
                <td className="px-6 py-4 text-center text-sm font-bold text-gray-900" style={{ width: '13%' }}>
                  {totalDebit.toLocaleString('en-US')}
                </td>
                <td className="px-6 py-4 text-center text-sm font-bold text-gray-900" style={{ width: '13%' }}>
                  {totalCredit.toLocaleString('en-US')}
                </td>
                <td className="px-6 py-4 text-center text-sm font-bold" style={{ width: '13%' }}>
                  <span className={`px-3 py-1 rounded-full ${totalNetDebt > 0 ? 'bg-red-100 text-red-700' : totalNetDebt < 0 ? 'bg-green-100 text-green-700' : 'text-gray-600'}`}>
                    {totalNetDebt.toLocaleString('en-US')}
                  </span>
                </td>
                <td className="px-6 py-4" style={{ width: '13%' }}></td>
                <td className="px-6 py-4" style={{ width: '9%' }}></td>
              </tr>
            </tbody>
          </table>
          ) : (
            <NoData />
          )}
        </div>

        {/* Pagination Controls */}
        {hasRows && (
        <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-2 rounded-lg shadow">
          <div className="flex justify-between flex-1 sm:hidden">
            <button
              onClick={() => invoiceTable.previousPage()}
              disabled={!invoiceTable.getCanPreviousPage()}
              className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => invoiceTable.nextPage()}
              disabled={!invoiceTable.getCanNextPage()}
              className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                Page <span className="font-medium">{invoiceTable.getState().pagination.pageIndex + 1}</span> of{' '}
                <span className="font-medium">{invoiceTable.getPageCount()}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700 whitespace-nowrap">Show:</span>
                <input
                  type="number"
                  min="1"
                  value={invoiceTable.getState().pagination.pageSize}
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (val > 0) {
                      invoiceTable.setPageSize(val);
                    }
                  }}
                  className="block w-20 py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => invoiceTable.setPageIndex(0)}
                  disabled={!invoiceTable.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">First</span>
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => invoiceTable.previousPage()}
                  disabled={!invoiceTable.getCanPreviousPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, Math.max(1, invoiceTable.getPageCount())) }, (_, i) => {
                  let pageNum = i;
                  const currentPage = invoiceTable.getState().pagination.pageIndex;
                  const totalPages = Math.max(1, invoiceTable.getPageCount());
                  if (totalPages > 5) {
                    if (currentPage > 2 && currentPage < totalPages - 2) {
                      pageNum = currentPage - 2 + i;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 5 + i;
                    }
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => invoiceTable.setPageIndex(pageNum)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === pageNum
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => invoiceTable.nextPage()}
                  disabled={!invoiceTable.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => invoiceTable.setPageIndex(invoiceTable.getPageCount() - 1)}
                  disabled={!invoiceTable.getCanNextPage()}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Last</span>
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </nav>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
