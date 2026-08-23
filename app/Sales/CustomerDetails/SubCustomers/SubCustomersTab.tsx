'use client';

import { useMemo } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import type { SubCustomerRow } from '../Types';

interface SubCustomersTabProps {
  subCustomersData: SubCustomerRow[];
  onExport: () => void;
}

export default function SubCustomersTab({
  subCustomersData,
  onExport,
}: SubCustomersTabProps) {
  const totalSalesAmount = useMemo(
    () => subCustomersData.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0),
    [subCustomersData],
  );

  const totalQty = useMemo(
    () => subCustomersData.reduce((sum, item) => sum + (item.totalQty || 0), 0),
    [subCustomersData],
  );

  const totalInvoices = useMemo(
    () => subCustomersData.reduce((sum, item) => sum + (item.invoicesCount || 0), 0),
    [subCustomersData],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">
          Sub Customers Breakdown ({subCustomersData.length})
        </h2>
        <button
          onClick={onExport}
          className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
          title="Export to Excel"
        >
          <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>
      </div>
      {subCustomersData.length === 0 ? (
        <NoData />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">#</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-72">Sub Customer Name</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-40">City</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Total Amount</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-36">Total QTY</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">SKUs</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-36">Invoices Count</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-36">% of Sales</th>
              </tr>
            </thead>
            <tbody>
              {subCustomersData.map((item, index) => {
                const amount = Number(item.totalAmount) || 0;
                const salesShare =
                  totalSalesAmount > 0 ? (amount / totalSalesAmount) * 100 : 0;

                return (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-500 text-center font-medium">{index + 1}</td>
                    <td className="py-3 px-4 text-sm font-bold text-slate-800 text-center truncate w-72" title={item.subCustomerName}>
                      {item.subCustomerName}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-semibold text-center truncate" title={item.city || 'Unknown'}>
                      {item.city || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-base text-emerald-600 font-bold text-center">
                      {amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                      {item.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                      {item.productsCount}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                      {item.invoicesCount}
                    </td>
                    <td className="py-3 px-4 text-base text-indigo-600 font-bold text-center">
                      {salesShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
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
                  {totalSalesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td className="py-4 px-4"></td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalInvoices.toLocaleString('en-US')}
                </td>
                <td className="py-4 px-4 text-base text-indigo-700 font-bold text-center">
                  100.00%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
