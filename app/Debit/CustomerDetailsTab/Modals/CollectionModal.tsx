import React from 'react';

interface CollectionModalProps {
  show: boolean;
  onClose: () => void;
  dashboardMetrics: any;
}

export default function CollectionModal({ show, onClose, dashboardMetrics }: CollectionModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 transform transition-all scale-100" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">📈</span> Collection Breakdown
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">✕</button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Payments</p>
              <p className="text-lg font-bold text-gray-900">{dashboardMetrics.paymentsAmount.toLocaleString('en-US')}</p>
              <p className="text-xs text-gray-500">Share: {dashboardMetrics.totalPaid > 0 ? ((dashboardMetrics.paymentsAmount / dashboardMetrics.totalPaid) * 100).toFixed(1) : '0.0'}%</p>
            </div>
            <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Returns (RSAL)</p>
              <p className="text-lg font-bold text-gray-900">{dashboardMetrics.returnsAmount.toLocaleString('en-US')}</p>
              <p className="text-xs text-gray-500">Share: {dashboardMetrics.totalPaid > 0 ? ((dashboardMetrics.returnsAmount / dashboardMetrics.totalPaid) * 100).toFixed(1) : '0.0'}%</p>
            </div>
            <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-sm">
              <p className="text-xs text-gray-500 uppercase">Discounts (BIL)</p>
              <p className="text-lg font-bold text-gray-900">{dashboardMetrics.discountsAmount.toLocaleString('en-US')}</p>
              <p className="text-xs text-gray-500">Share: {dashboardMetrics.totalPaid > 0 ? ((dashboardMetrics.discountsAmount / dashboardMetrics.totalPaid) * 100).toFixed(1) : '0.0'}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
