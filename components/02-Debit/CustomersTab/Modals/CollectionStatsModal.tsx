import React from 'react';
import { CustomerAnalysis } from '@/types';

interface CollectionStatsModalProps {
  stats: any;
  onClose: () => void;
}

const CollectionStatsModal: React.FC<CollectionStatsModalProps> = ({
  stats,
  onClose,
}) => {
  if (!stats) return null;

  const { customer, ranks, rates } = stats;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{customer.customerName}</h3>
              <p className="text-sm text-blue-600 font-medium">Collection Performance & Market Ranking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all flex items-center justify-center shadow-sm border border-gray-200 hover:border-red-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>
          {/* Rank Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl text-white shadow-lg shadow-blue-200 transition-transform hover:scale-[1.02]">
              <p className="text-blue-100 text-xs font-bold uppercase tracking-wider mb-1">Market Rank</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black">#{ranks.collRank}</span>
                <span className="text-blue-200 text-sm font-medium">of {ranks.totalCount} customers</span>
              </div>
              <p className="mt-4 text-sm text-blue-50/80 leading-relaxed font-medium">
                Ranked based on overall collection rate compared to all other customers.
              </p>
            </div>

            <div className="p-6 bg-white border-2 border-gray-100 rounded-2xl shadow-sm hover:border-blue-100 transition-all">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Collection Efficiency</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black ${customer.totalDebit > 0 && (customer.totalCredit / customer.totalDebit * 100) >= 80 ? 'text-green-600' : 'text-blue-600'}`}>
                  {(customer.totalDebit > 0 ? (customer.totalCredit / customer.totalDebit * 100) : 0).toFixed(1)}%
                </span>
              </div>
              <div className="mt-4 w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.min(customer.totalDebit > 0 ? (customer.totalCredit / customer.totalDebit * 100) : 0, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-4 bg-blue-600 rounded-full"></span>
              Credit Allocation Breakdown
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Bank Payments', val: rates.payRate, rank: ranks.payRank, color: 'emerald', icon: '💰' },
                { label: 'Returns', val: rates.returnRate, rank: ranks.returnRank, color: 'orange', icon: '🔄' },
                { label: 'Discounts', val: rates.discountRate, rank: ranks.discountRank, color: 'purple', icon: '🏷️' }
              ].map((item) => (
                <div key={item.label} className="group p-5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-blue-200 transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-2xl">{item.icon}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold bg-${item.color}-100 text-${item.color}-700 uppercase`}>Rank #{item.rank}</span>
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">{item.label}</p>
                  <p className="text-2xl font-black text-gray-800">{item.val.toFixed(1)}%</p>
                  <div className="mt-3 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full bg-${item.color}-500 rounded-full`} style={{ width: `${Math.min(item.val, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Info Note */}
          <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <p className="text-[11px] text-gray-500 leading-relaxed flex items-start gap-2">
              <span className="text-base">💡</span>
              Market ranking compares this customer's performance against all active debtors in the current filtered dataset.
              Higher percentages in "Bank Payments" indicate healthier cash flow, while high "Returns" or "Discounts" might require attention.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionStatsModal;
