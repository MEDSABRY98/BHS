import React from 'react';

interface PaymentModalProps {
  show: boolean;
  onClose: () => void;
  dashboardMetrics: any;
}

export default function PaymentModal({ show, onClose, dashboardMetrics }: PaymentModalProps) {
  if (!show || !dashboardMetrics.lastPaymentInvoice) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl border border-gray-100 transform transition-all scale-100 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">💸</span> Payment Details
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Payment Amount</p>
            <p className="text-3xl font-bold text-green-600">
              {dashboardMetrics.lastPaymentAmount.toLocaleString('en-US')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Date</p>
              <p className="font-semibold text-gray-800">
                {new Date(dashboardMetrics.lastPaymentInvoice.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
              <p className="font-semibold text-gray-800 font-mono break-words overflow-wrap-anywhere text-sm">
                {dashboardMetrics.lastPaymentInvoice.number}
              </p>
            </div>
          </div>

          {dashboardMetrics.lastPaymentInvoice.matching && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Matching Reference</p>
              <p className="font-medium text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">
                {dashboardMetrics.lastPaymentInvoice.matching}
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
