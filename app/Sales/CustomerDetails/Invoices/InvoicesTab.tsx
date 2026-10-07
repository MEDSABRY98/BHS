'use client';

import { FileSpreadsheet } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import type { GroupedInvoiceRow, SelectedInvoice } from '../Types';

interface InvoicesTabProps {
  groupedInvoicesData: GroupedInvoiceRow[];
  customerType: 'main' | 'sub';
  customerName: string;
  invoiceTypeFilter: 'all' | 'sales' | 'returns';
  onInvoiceTypeFilterChange: (filter: 'all' | 'sales' | 'returns') => void;
  invoicesPage: number;
  onInvoicesPageChange: (page: number) => void;
  invoicesPerPage: number;
  onSelectInvoice: (invoice: SelectedInvoice) => void;
  onExport: () => void;
}

export default function InvoicesTab({
  groupedInvoicesData,
  customerType,
  customerName,
  invoiceTypeFilter,
  onInvoiceTypeFilterChange,
  invoicesPage,
  onInvoicesPageChange,
  invoicesPerPage,
  onSelectInvoice,
  onExport,
}: InvoicesTabProps) {
  const totalPages = Math.ceil(groupedInvoicesData.length / invoicesPerPage);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800">Invoices / LPO</h2>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => onInvoiceTypeFilterChange('all')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                invoiceTypeFilter === 'all'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => onInvoiceTypeFilterChange('sales')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                invoiceTypeFilter === 'sales'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Sales
            </button>
            <button
              onClick={() => onInvoiceTypeFilterChange('returns')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                invoiceTypeFilter === 'returns'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Returns
            </button>
          </div>
        </div>
        <button
          onClick={onExport}
          className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
          title="Export Invoices to Excel"
        >
          <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>
      </div>
      {groupedInvoicesData.length === 0 ? (
        <NoData />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Invoice Date</th>
                  {customerType === 'main' && (
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-64">Sub Customer</th>
                  )}
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-40">Invoice Number</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Amount</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-24">Quantity</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Products Count</th>
                </tr>
              </thead>
              <tbody>
                {groupedInvoicesData
                  .slice((invoicesPage - 1) * invoicesPerPage, invoicesPage * invoicesPerPage)
                  .map((item, index) => {
                    const isRSAL = item.invoiceNumber.trim().toUpperCase().startsWith('RSAL');
                    return (
                      <tr
                        key={index}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${isRSAL ? 'bg-red-50 hover:bg-red-100' : ''}`}
                      >
                        <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">
                          {item.invoiceDate
                            ? new Date(item.invoiceDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>
                        {customerType === 'main' && (
                          <td
                            className="py-3 px-4 text-sm text-gray-600 font-medium text-center w-56 truncate"
                            title={item.subCustomerNames}
                          >
                            {item.subCustomerNames}
                          </td>
                        )}
                        <td className="py-3 px-4 text-base text-green-600 font-semibold text-center">
                          <button
                            onClick={() =>
                              onSelectInvoice({
                                invoiceDate: item.invoiceDate,
                                invoiceNumber: item.invoiceNumber,
                                amount: item.amount,
                                qty: item.qty,
                                customerName:
                                  customerType === 'main' ? item.subCustomerNames || customerName : customerName,
                                items: item.items,
                              })
                            }
                            className="hover:underline font-bold"
                          >
                            {item.invoiceNumber}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                          {item.amount.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                          {item.qty.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">{item.productCount}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {groupedInvoicesData.length > invoicesPerPage && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="text-sm text-gray-500">
                Showing{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min((invoicesPage - 1) * invoicesPerPage + 1, groupedInvoicesData.length)}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-gray-900">
                  {Math.min(invoicesPage * invoicesPerPage, groupedInvoicesData.length)}
                </span>{' '}
                of <span className="font-semibold text-gray-900">{groupedInvoicesData.length}</span> invoices
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onInvoicesPageChange(Math.max(invoicesPage - 1, 1))}
                  disabled={invoicesPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (invoicesPage <= 3) pageNum = i + 1;
                    else if (invoicesPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = invoicesPage - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => onInvoicesPageChange(pageNum)}
                        className={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-lg transition-all ${
                          invoicesPage === pageNum
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
                  onClick={() => onInvoicesPageChange(Math.min(invoicesPage + 1, totalPages))}
                  disabled={invoicesPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
