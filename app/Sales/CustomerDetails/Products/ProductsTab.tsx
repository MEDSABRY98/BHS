'use client';

import { useState, useEffect } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import type { ProductSalesRow } from '../Types';

interface ProductsTabProps {
  productsData: ProductSalesRow[];
  showCosts: boolean;
  onExport: () => void;
}

export default function ProductsTab({ productsData, showCosts, onExport }: ProductsTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [productsData]);

  const totalPages = Math.ceil(productsData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentData = productsData.slice(startIndex, startIndex + rowsPerPage);

  const totalAmount = productsData.reduce((sum, item) => sum + item.amount, 0);
  const totalQty = productsData.reduce((sum, item) => sum + item.qty, 0);
  const totalInvoices = productsData.reduce((sum, item) => sum + (item.invoiceCount || 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Products Sales</h2>
        <button
          onClick={onExport}
          className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
          title="Export Products to Excel"
        >
          <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>
      </div>
      {productsData.length === 0 ? (
        <NoData />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-16">#</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-36">Barcode</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-64">Product</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Amount</th>
                {showCosts && <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-28">Avg Cost</th>}
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-28">Avg Price</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-24">Quantity</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-28">Purchase Count</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-28">LID</th>
              </tr>
            </thead>
            <tbody>
              {currentData.map((item, index) => {
                const actualIndex = startIndex + index + 1;
                return (
                <tr
                  key={index}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    item.isDuplicate ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                  }`}
                >
                  <td className="py-3 px-4 text-base text-gray-600 font-medium text-center">{actualIndex}</td>
                  <td
                    className={`py-3 px-4 text-base font-medium text-center ${
                      item.isDuplicate ? 'text-red-600 font-bold' : 'text-gray-800'
                    }`}
                  >
                    {item.barcode || '-'}
                  </td>
                  <td className="py-3 px-4 text-base text-gray-800 font-medium text-center w-64 truncate" title={item.product}>
                    {item.product}
                  </td>
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                    {item.amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  {showCosts && (
                    <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                      {item.avgCost % 1 === 0
                        ? item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                        : item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                    {item.avgPrice % 1 === 0
                      ? item.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                      : item.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                    {item.qty.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                    {item.invoiceCount || 0}
                  </td>
                  <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">
                    {item.lastInvoiceDate
                      ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </td>
                </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                <td colSpan={3} className="py-4 px-4 text-base text-gray-800 font-bold text-right">
                  
                </td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {showCosts && <td className="py-4 px-4"></td>}
                <td className="py-4 px-4"></td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalInvoices.toLocaleString('en-US')}
                </td>
                <td className="py-4 px-4"></td>
              </tr>
            </tfoot>
          </table>
          
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-500">
                Showing{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min(startIndex + 1, productsData.length)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min(startIndex + rowsPerPage, productsData.length)}
                </span>{' '}
                of <span className="font-semibold text-gray-900">{productsData.length}</span> products
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-all ${
                          currentPage === pageNum
                            ? 'bg-green-600 text-white shadow-md'
                            : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
