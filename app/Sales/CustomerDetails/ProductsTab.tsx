'use client';

import { FileSpreadsheet } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import type { ProductSalesRow } from './Types';

interface ProductsTabProps {
  productsData: ProductSalesRow[];
  showCosts: boolean;
  onExport: () => void;
}

export default function ProductsTab({ productsData, showCosts, onExport }: ProductsTabProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
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
              {productsData.map((item, index) => (
                <tr
                  key={index}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    item.isDuplicate ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                  }`}
                >
                  <td className="py-3 px-4 text-base text-gray-600 font-medium text-center">{index + 1}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
