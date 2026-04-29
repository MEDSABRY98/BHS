import React from 'react';
import { CustomerAnalysis } from '@/types';

interface RatingBreakdownModalProps {
  customer: CustomerAnalysis | null;
  breakdown: any;
  onClose: () => void;
}

const RatingBreakdownModal: React.FC<RatingBreakdownModalProps> = ({
  customer,
  breakdown,
  onClose,
}) => {
  if (!customer || !breakdown) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-md ${breakdown.rating === 'Good'
              ? 'bg-gradient-to-br from-emerald-500 to-green-600'
              : breakdown.rating === 'Medium'
                ? 'bg-gradient-to-br from-amber-500 to-yellow-600'
                : 'bg-gradient-to-br from-red-500 to-rose-600'
              }`}>
              {breakdown.rating === 'Good' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : breakdown.rating === 'Medium' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{customer.customerName}</h3>
              <p className="text-sm text-gray-500 font-medium">Debit Rating Breakdown</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center shadow-sm border border-gray-200 hover:border-gray-300"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-8 py-6 overflow-y-auto bg-gray-50/50" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {/* Final Rating */}
          <div className={`mb-8 p-6 rounded-2xl shadow-lg border-2 transition-all ${breakdown.rating === 'Good'
            ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/50'
            : breakdown.rating === 'Medium'
              ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200/50'
              : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/50'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${breakdown.rating === 'Good'
                  ? 'bg-emerald-100 text-emerald-600'
                  : breakdown.rating === 'Medium'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-red-100 text-red-600'
                  }`}>
                  <span className="text-3xl font-bold">
                    {breakdown.rating === 'Good' ? '✓' : breakdown.rating === 'Medium' ? '!' : '✗'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">Final Rating</p>
                  <p className={`text-4xl font-bold tracking-tight ${breakdown.rating === 'Good'
                    ? 'text-emerald-600'
                    : breakdown.rating === 'Medium'
                      ? 'text-amber-600'
                      : 'text-red-600'
                    }`}>
                    {breakdown.rating}
                  </p>
                </div>
              </div>
              <div className="text-right max-w-md">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Reason</p>
                <p className="text-base font-medium text-gray-800 leading-relaxed">{breakdown.reason}</p>
              </div>
            </div>
          </div>

          {breakdown.breakdown && (
            <>
              {/* Risk Flags */}
              {(breakdown.breakdown.riskFlags.riskFlag1 === 1 || breakdown.breakdown.riskFlags.riskFlag2 === 1) && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                    <h4 className="text-lg font-bold text-gray-800">Risk Indicators</h4>
                  </div>
                  <div className="space-y-3">
                    {breakdown.breakdown.riskFlags.riskFlag1 === 1 && (
                      <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-base font-bold text-red-800 mb-1">Risk Indicator 1</p>
                            <p className="text-sm text-red-700">Net sales last 90 days negative + payment count = 0</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {breakdown.breakdown.riskFlags.riskFlag2 === 1 && (
                      <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 rounded-xl shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-base font-bold text-red-800 mb-1">Risk Indicator 2</p>
                            <p className="text-sm text-red-700">No payment last 90 days + no sale last 90 days + positive debt</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scores Breakdown */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                  <h4 className="text-lg font-bold text-gray-800">Score Details</h4>
                  <div className="ml-auto px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                    Total: {breakdown.breakdown.totalScore}/{breakdown.breakdown.maxPossibleScore || 16}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Net Debit */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Net Debit</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score1 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score1 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score1}/2
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{breakdown.breakdown.netDebt.toLocaleString('en-US')}</p>
                  </div>

                  {/* Collection Rate */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Collection Rate</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score2 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score2 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score2}/2
                      </div>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-gray-900">{breakdown.breakdown.collRate.toFixed(1)}%</p>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        ({((customer.creditPayments || 0) / (customer.totalCredit || 1) * 100).toFixed(0)}%, {((customer.creditReturns || 0) / (customer.totalCredit || 1) * 100).toFixed(0)}%, {((customer.creditDiscounts || 0) / (customer.totalCredit || 1) * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {/* Last Payment */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Payment</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score3 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score3 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score3}/2
                      </div>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{breakdown.breakdown.lastPay}</p>
                  </div>

                  {/* Payment Value */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Value</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score6 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score6 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score6}/2
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{(breakdown.breakdown.payments90d || 0).toLocaleString('en-US')}</p>
                    <p className="text-sm text-gray-500 mt-1">Payments Last 90d</p>
                  </div>

                  {/* Payment Count */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Count (90d)</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score4 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score4 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score4}/2
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{breakdown.breakdown.payCount}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Last Sale */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Sale</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score5 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score5 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score5}/2
                      </div>
                    </div>
                    <p className="text-xl font-bold text-gray-900">{breakdown.breakdown.lastSale}</p>
                  </div>

                  {/* Sales Value */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Value</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score7 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score7 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score7}/2
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{(breakdown.breakdown.sales90d || 0).toLocaleString('en-US')}</p>
                    <p className="text-sm text-gray-500 mt-1">Sales Last 90d</p>
                  </div>

                  {/* Sales Count */}
                  <div className="p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sales Count (90d)</p>
                      <div className={`px-2.5 py-1 rounded-lg text-xs font-bold ${breakdown.breakdown.scores.score8 === 2 ? 'bg-emerald-100 text-emerald-700' : breakdown.breakdown.scores.score8 === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {breakdown.breakdown.scores.score8}/2
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{breakdown.breakdown.salesCount}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RatingBreakdownModal;
