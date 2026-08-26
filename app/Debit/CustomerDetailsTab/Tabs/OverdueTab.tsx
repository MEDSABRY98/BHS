import React from 'react';
import { flexRender } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { SharedTabProps } from '../Types';

export default function OverdueTab(props: SharedTabProps) {
  const { overdueTable, overdueTotalDebit, overdueTotalCredit, overdueTotalDifference } = props;
  const hasRows = overdueTable.getRowModel().rows.length > 0;

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {hasRows ? (
          <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
            <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10 shadow-sm">
              {overdueTable.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: any) => {
                    const getWidth = () => {
                      const columnId = header.column.id;
                      if (columnId === 'select') return '5%';
                      if (columnId === 'date') return '12%';
                      if (columnId === 'type') return '10%';
                      if (columnId === 'number') return '12%';
                      if (columnId === 'debit') return '12%';
                      if (columnId === 'credit') return '12%';
                      if (columnId === 'difference') return '12%';
                      if (columnId === 'matching') return '12%';
                      if (columnId === 'daysOverdue') return '13%';
                      return '12%';
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
              {overdueTable.getRowModel().rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-red-50/20 transition-colors group">
                  {row.getVisibleCells().map((cell: any) => {
                    const getWidth = () => {
                      const columnId = cell.column.id;
                      if (columnId === 'select') return '5%';
                      if (columnId === 'date') return '12%';
                      if (columnId === 'type') return '10%';
                      if (columnId === 'number') return '12%';
                      if (columnId === 'debit') return '12%';
                      if (columnId === 'credit') return '12%';
                      if (columnId === 'difference') return '12%';
                      if (columnId === 'matching') return '12%';
                      if (columnId === 'daysOverdue') return '13%';
                      return '12%';
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
                <td className="px-6 py-4 text-center text-sm font-bold text-gray-900 uppercase tracking-wide" style={{ width: '12%' }}>Total</td>
                <td className="px-6 py-4" style={{ width: '10%' }}></td>
                <td className="px-6 py-4" style={{ width: '12%' }}></td>
                <td className="px-6 py-4 text-center text-sm font-bold text-gray-900" style={{ width: '12%' }}>
                  {overdueTotalDebit.toLocaleString('en-US')}
                </td>
                <td className="px-6 py-4 text-center text-sm font-bold text-gray-900" style={{ width: '12%' }}>
                  {overdueTotalCredit.toLocaleString('en-US')}
                </td>
                <td className="px-6 py-4 text-center text-sm font-bold" style={{ width: '12%' }}>
                  <span className={`px-3 py-1 rounded-full ${overdueTotalDifference > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {overdueTotalDifference.toLocaleString('en-US')}
                  </span>
                </td>
                <td className="px-6 py-4" style={{ width: '12%' }}></td>
                <td className="px-6 py-4" style={{ width: '13%' }}></td>
              </tr>
            </tbody>
          </table>
          ) : (
            <NoData />
          )}
        </div>
        {hasRows && (
          <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6 mt-2 rounded-lg shadow">
            <div className="flex justify-between flex-1 sm:hidden">
              <button
                onClick={() => overdueTable.previousPage()}
                disabled={!overdueTable.getCanPreviousPage()}
                className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => overdueTable.nextPage()}
                disabled={!overdueTable.getCanNextPage()}
                className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-700">
                  Page <span className="font-medium">{overdueTable.getState().pagination.pageIndex + 1}</span> of{' '}
                  <span className="font-medium">{overdueTable.getPageCount()}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 whitespace-nowrap">Show:</span>
                  <input
                    type="number"
                    min="1"
                    value={overdueTable.getState().pagination.pageSize}
                    onChange={e => {
                      const val = Number(e.target.value);
                      if (val > 0) {
                        overdueTable.setPageSize(val);
                      }
                    }}
                    className="block w-20 py-1.5 px-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => overdueTable.setPageIndex(0)}
                    disabled={!overdueTable.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">First</span>
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => overdueTable.previousPage()}
                    disabled={!overdueTable.getCanPreviousPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(5, Math.max(1, overdueTable.getPageCount())) }, (_, i) => {
                    let pageNum = i;
                    const currentPage = overdueTable.getState().pagination.pageIndex;
                    const totalPages = Math.max(1, overdueTable.getPageCount());
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
                        onClick={() => overdueTable.setPageIndex(pageNum)}
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
                    onClick={() => overdueTable.nextPage()}
                    disabled={!overdueTable.getCanNextPage()}
                    className="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => overdueTable.setPageIndex(overdueTable.getPageCount() - 1)}
                    disabled={!overdueTable.getCanNextPage()}
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
