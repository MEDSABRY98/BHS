import React from 'react';
import NoData from '../../../01-Unified/NoDataTab';

interface MonthlyBreakdownModalProps {
  customerName: string | null;
  monthlyData: {
    months: Array<{ key: string; amount: number; label: string }>;
    netTotal: number;
  } | null;
  onClose: () => void;
}

const MonthlyBreakdownModal: React.FC<MonthlyBreakdownModalProps> = ({
  customerName,
  monthlyData,
  onClose,
}) => {
  if (!customerName || !monthlyData) return null;

  const debitMonths = monthlyData.months.filter((m) => m.amount > 0.01);
  const creditMonths = monthlyData.months.filter((m) => m.amount < -0.01);

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">{customerName}</h3>
              <p className="text-sm text-gray-500 font-medium">Monthly Debt Breakdown</p>
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
          {/* Net Total Summary */}
          <div className={`mb-8 p-6 rounded-2xl shadow-lg border-2 transition-all ${monthlyData.netTotal > 0
            ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/50'
            : monthlyData.netTotal < 0
              ? 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200/50'
              : 'bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200/50'
            }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${monthlyData.netTotal > 0
                  ? 'bg-red-100 text-red-600'
                  : monthlyData.netTotal < 0
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Net Total Debt</p>
                  <p className="text-xs text-gray-500 mt-0.5">All open items combined</p>
                </div>
              </div>
              <span className={`text-4xl font-bold tracking-tight ${monthlyData.netTotal > 0
                ? 'text-red-600'
                : monthlyData.netTotal < 0
                  ? 'text-emerald-600'
                  : 'text-gray-600'
                }`}>
                {Math.round(monthlyData.netTotal).toLocaleString('en-US')}
              </span>
            </div>
          </div>

          {/* Months Breakdown */}
          <div className="space-y-6">
            {/* Debit Months */}
            {debitMonths.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-600 rounded-full"></div>
                  <h4 className="text-lg font-bold text-gray-800">Debit Months</h4>
                  <span className="text-sm text-gray-500 font-medium">({debitMonths.length} {debitMonths.length === 1 ? 'month' : 'months'})</span>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="grid grid-cols-5 gap-3">
                    {debitMonths.map((m, idx) => (
                      <div
                        key={m.key}
                        className={`w-full px-3 py-2.5 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-sm text-center ${idx % 2 === 0
                          ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-200'
                          : 'bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-orange-200'
                          }`}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Credit Months */}
            {creditMonths.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-green-600 rounded-full"></div>
                  <h4 className="text-lg font-bold text-gray-800">Credit Months</h4>
                  <span className="text-sm text-gray-500 font-medium">({creditMonths.length} {creditMonths.length === 1 ? 'month' : 'months'})</span>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="grid grid-cols-5 gap-3">
                    {creditMonths.map((m, idx) => (
                      <div
                        key={m.key}
                        className={`w-full px-3 py-2.5 rounded-xl font-semibold text-base transition-all hover:scale-105 shadow-sm text-center ${idx % 2 === 0
                          ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-emerald-200'
                          : 'bg-gradient-to-br from-teal-500 to-cyan-500 text-white shadow-teal-200'
                          }`}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {debitMonths.length === 0 && creditMonths.length === 0 && (
              <NoData />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyBreakdownModal;
