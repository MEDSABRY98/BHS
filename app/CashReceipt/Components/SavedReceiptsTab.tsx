import React from 'react';
import { ArrowLeft, FileText, Printer, Hash, Calendar, Edit2, Trash2 } from 'lucide-react';
import ReceiptDocument from './ReceiptDocument';

interface Receipt {
  receiptNumber: string;
  date: string;
  receivedFrom: string;
  sendBy: string;
  amount: number | string | null | undefined;
  amountInWords: string;
  reason: string;
}

interface SavedReceiptsTabProps {
  isFetchingSaved: boolean;
  filteredReceipts: Receipt[];
  selectedReceipt: Receipt | null;
  setSelectedReceipt: (receipt: Receipt | null) => void;
  onReprint: (receipt: Receipt) => void;
  onEdit: (receipt: Receipt) => void;
  onDelete: (receipt: Receipt) => void;
  searchQuery: string;
  receivedBySignature?: string;
}

export default function SavedReceiptsTab({
  isFetchingSaved,
  filteredReceipts,
  selectedReceipt,
  setSelectedReceipt,
  onReprint,
  onEdit,
  onDelete,
  searchQuery,
  receivedBySignature,
}: SavedReceiptsTabProps) {
  if (selectedReceipt) {
    return (
      /* Receipt Detail View */
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
            </button>
            <div className="p-2.5 bg-gray-100 rounded-xl">
              <FileText className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">{selectedReceipt.receiptNumber}</h2>
              <p className="text-xs font-medium text-gray-500">
                {selectedReceipt.date} • AED {parseFloat(String(selectedReceipt.amount ?? 0)).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(selectedReceipt)}
              title="Edit Receipt"
              className="p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 hover:text-black transition-all shadow-sm"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete(selectedReceipt)}
              title="Delete Receipt"
              className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 hover:text-red-700 transition-all shadow-sm"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => onReprint(selectedReceipt)}
              title="Reprint Receipt"
              className="p-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-all shadow-lg"
            >
              <Printer className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <ReceiptDocument data={selectedReceipt} receivedBySignature={receivedBySignature} mode="preview" />
        </div>
      </div>
    );
  }

  return (
    /* Receipts Grid View */
    <>
      {isFetchingSaved ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-sm text-gray-400 font-medium">Loading receipts...</span>
        </div>
      ) : filteredReceipts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredReceipts.map((receipt) => (
            <div
              key={receipt.receiptNumber}
              className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden w-full"
            >
              <button
                type="button"
                onClick={() => setSelectedReceipt(receipt)}
                className="w-full text-left"
              >
                {/* Card Top Accent */}
                <div className="h-1.5 bg-gradient-to-r from-gray-700 to-black" />
                <div className="p-5 pr-16">
                  {/* Receipt # Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-lg">
                      <Hash className="w-3 h-3" />
                      {receipt.receiptNumber}
                    </span>
                  </div>

                  {/* Name */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Received From</p>
                    <p className="text-base font-black text-gray-900 truncate">{receipt.receivedFrom}</p>
                  </div>

                  {/* Amount */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Amount</p>
                    <p className="text-xl font-black text-gray-900">
                      AED {parseFloat(String(receipt.amount ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs text-gray-400 font-medium">{receipt.date}</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onReprint(receipt)}
                title="Reprint Receipt"
                className="absolute top-5 right-5 w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 hover:bg-black hover:text-white transition-all"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-5">
            <FileText className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2">No Receipts Found</h3>
          <p className="text-gray-500 font-medium text-sm max-w-xs">
            {searchQuery ? `No results for "${searchQuery}"` : 'No saved receipts yet.'}
          </p>
        </div>
      )}
    </>
  );
}
