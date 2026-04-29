import React from 'react';

interface InvoiceDetailModalProps {
  selectedInvoice: any;
  onClose: () => void;
}

export default function InvoiceDetailModal({ selectedInvoice, onClose }: InvoiceDetailModalProps) {
  if (!selectedInvoice) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100 transform transition-all scale-100"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800">Invoice Number</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="py-6">
          <p className="text-lg font-bold text-gray-900 text-center break-all">
            {selectedInvoice.number || 'N/A'}
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
