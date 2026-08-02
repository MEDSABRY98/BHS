'use client';

import { SalesInvoice } from '@/lib/supabase';
import { ShoppingBag, X, FileSpreadsheet } from 'lucide-react';
import type { SelectedInvoice } from './Types';
import { formatDate } from './Exports';

interface InvoiceDetailModalProps {
  selectedInvoice: SelectedInvoice;
  showCosts: boolean;
  onClose: () => void;
  onExport: (invoice: SelectedInvoice) => void;
}

export default function InvoiceDetailModal({
  selectedInvoice,
  showCosts,
  onClose,
  onExport,
}: InvoiceDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-green-600" />
              Invoice Details: {selectedInvoice.invoiceNumber}
            </h3>
            <p className="text-sm text-gray-500 font-medium">
              {selectedInvoice.customerName} | {formatDate(selectedInvoice.invoiceDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onExport(selectedInvoice)}
              className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors flex items-center justify-center border border-emerald-100 shadow-sm group"
              title="Export Invoice to Excel"
            >
              <FileSpreadsheet className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Barcode</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Qty</th>
                {showCosts && (
                  <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Cost</th>
                )}
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Price</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {selectedInvoice.items?.map((item: SalesInvoice, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-center font-mono text-[11px] text-gray-500">{item.barcode || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="font-bold text-gray-800">{item.product}</div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-gray-700">{item.qty}</td>
                  {showCosts && (
                    <td className="py-3 px-4 text-center font-semibold text-gray-700">
                      {item.productCost?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  )}
                  <td className="py-3 px-4 text-center font-semibold text-gray-700">
                    {item.productPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-gray-900">
                    {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-col items-end gap-2">
            <div className="flex justify-between w-full max-w-[240px] text-green-700 mt-1">
              <span className="text-lg font-black uppercase tracking-wider">Total Amount:</span>
              <span className="text-2xl font-black">
                {selectedInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="text-xs ml-1 font-bold">AED</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
