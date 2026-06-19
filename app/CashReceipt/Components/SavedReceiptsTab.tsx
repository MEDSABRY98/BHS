import React from 'react';
import { FileText, Printer, Hash, Calendar, Edit2, Trash2, X } from 'lucide-react';

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
}: SavedReceiptsTabProps) {
  const closeModal = () => setSelectedReceipt(null);

  const handleEdit = () => {
    if (!selectedReceipt) return;
    onEdit(selectedReceipt);
    closeModal();
  };

  const handleDelete = () => {
    if (!selectedReceipt) return;
    onDelete(selectedReceipt);
    closeModal();
  };

  const handleReprint = () => {
    if (!selectedReceipt) return;
    onReprint(selectedReceipt);
    closeModal();
  };

  return (
    <>
      {isFetchingSaved ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-3"></div>
          <span className="text-sm text-gray-400 font-medium">Loading receipts...</span>
        </div>
      ) : filteredReceipts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredReceipts.map((receipt) => (
            <button
              key={receipt.receiptNumber}
              type="button"
              onClick={() => setSelectedReceipt(receipt)}
              className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden w-full text-left"
            >
              <div className="h-1.5 bg-gradient-to-r from-gray-700 to-black" />
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-lg">
                    <Hash className="w-3 h-3" />
                    {receipt.receiptNumber}
                  </span>
                </div>

                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Received From</p>
                  <p className="text-base font-black text-gray-900 truncate" dir="auto">
                    {receipt.receivedFrom}
                  </p>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Amount</p>
                  <p className="text-xl font-black text-gray-900">
                    AED {parseFloat(String(receipt.amount ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-400 font-medium">{receipt.date}</span>
                </div>
              </div>
            </button>
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

      {selectedReceipt && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-3 bg-gray-100 rounded-2xl shrink-0">
                  <FileText className="w-6 h-6 text-black" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl font-black text-gray-900 truncate">{selectedReceipt.receiptNumber}</h3>
                  <p className="text-sm text-gray-500 font-medium mt-0.5">{selectedReceipt.date}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Received From</p>
                <p className="text-sm font-bold text-gray-900 break-words" dir="auto">
                  {selectedReceipt.receivedFrom}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Amount</p>
                <p className="text-lg font-black text-gray-900">
                  AED {parseFloat(String(selectedReceipt.amount ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleReprint}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all"
              >
                <Printer className="w-5 h-5" />
                Reprint PDF
              </button>
              <button
                type="button"
                onClick={handleEdit}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gray-100 text-gray-800 font-bold rounded-xl hover:bg-gray-200 transition-all"
              >
                <Edit2 className="w-5 h-5" />
                Edit Receipt
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-5 h-5" />
                Delete Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
