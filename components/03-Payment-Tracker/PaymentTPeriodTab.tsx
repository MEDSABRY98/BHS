'use client';

import React from 'react';
import { formatDate } from './PaymentTUtilsTab';
import { 
  PaymentByPeriod, 
  PaymentEntry, 
  PeriodType, 
  DetailMode 
} from './PaymentTTypesTab';

interface PaymentTPeriodTabProps {
  detailMode: DetailMode;
  setDetailMode: (mode: DetailMode) => void;
  periodType: PeriodType;
  setPeriodType: (type: PeriodType) => void;
  selectedPeriod: PaymentByPeriod | null;
  setSelectedPeriod: (period: PaymentByPeriod | null) => void;
  paymentsByPeriod: PaymentByPeriod[];
  periodTotals: { totalPayments: number; paymentCount: number; customerCount: number };
  periodDetailPayments: PaymentEntry[];
  setLastPeriodSelection: (updater: (prev: any) => any) => void;
}

const PaymentTPeriodTab: React.FC<PaymentTPeriodTabProps> = ({
  detailMode,
  setDetailMode,
  periodType,
  setPeriodType,
  selectedPeriod,
  setSelectedPeriod,
  paymentsByPeriod,
  periodTotals,
  periodDetailPayments,
  setLastPeriodSelection,
}) => {
  // --- SUB PAGE: Period List ---
  if (detailMode === 'none') {
    return (
      <div className="space-y-6">
        {/* Period Type Selector */}
        <div className="flex w-full gap-2 p-1.5 bg-gray-100/50 backdrop-blur-sm rounded-[24px] border border-gray-100 shadow-inner max-w-2xl mx-auto">
          {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setPeriodType(type);
                setDetailMode('none');
                setSelectedPeriod(null);
              }}
              className={`flex-1 py-3 rounded-[20px] font-bold text-xs tracking-widest uppercase transition-all duration-300 transform active:scale-95 ${periodType === type
                ? 'bg-white text-blue-600 shadow-md ring-1 ring-black/[0.02]'
                : 'text-gray-400 hover:text-gray-600 hover:bg-white/40'
                }`}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Period</th>
                  <th className="px-5 py-3 text-center font-semibold">Total Payments</th>
                  <th className="px-5 py-3 text-center font-semibold">Payment Count</th>
                  <th className="px-5 py-3 text-center font-semibold">Customer Count</th>
                  <th className="px-5 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentsByPeriod.map((item, index) => {
                  const customerCount = new Set(
                    item.payments.map((p) => p.customerName.trim().toLowerCase()),
                  ).size;
                  return (
                    <tr key={item.periodKey} className="bg-white hover:bg-blue-50/40 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div className="font-semibold text-gray-900">{item.period}</div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center font-semibold text-gray-900">
                        {item.totalPayments.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-green-50 text-green-700 border border-green-200">
                          {item.paymentCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          {customerCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedPeriod(item);
                            setDetailMode('period');
                            setLastPeriodSelection((prev: any) => ({
                              ...prev,
                              [periodType]: item.periodKey,
                            }));
                          }}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {paymentsByPeriod.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No payments match your search.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 text-left">Total</td>
                  <td className="px-5 py-3 text-center">
                    {periodTotals.totalPayments.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-3 text-center">{periodTotals.paymentCount}</td>
                  <td className="px-5 py-3 text-center">{periodTotals.customerCount}</td>
                  <td className="px-5 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- SUB PAGE: Period Details ---
  if (detailMode === 'period' && selectedPeriod) {
    return (
      <div className="mt-6 bg-white/90 backdrop-blur-md rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{selectedPeriod.period}</h3>
            <p className="text-sm text-gray-500">
              Total Payments:{' '}
              {periodDetailPayments
                .reduce((sum, p) => sum + (p.credit || 0), 0)
                .toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
              · Payment Count: {periodDetailPayments.filter(p => p.rawCredit > 0.01).length}
            </p>
          </div>
          <button
            onClick={() => {
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <span>←</span> Back to list
          </button>
        </div>
        <div className="px-6 pb-6 pt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-gray-600 text-center">
                <th className="px-4 py-3 text-center">Date</th>
                <th className="px-4 py-3 text-center">Customer Name</th>
                <th className="px-4 py-3 text-center">Number</th>
                <th className="px-4 py-3 text-center">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodDetailPayments.map((payment, idx) => (
                <tr
                  key={`${payment.number}-${idx}`}
                  className={`hover:bg-gray-50 text-center ${payment.credit < 0
                    ? 'bg-red-50/60'
                    : payment.matchedOpeningBalance
                      ? 'bg-emerald-50/60'
                      : ''
                    }`}
                >
                  <td className="px-4 py-2 text-gray-700 text-center">{formatDate(payment.parsedDate)}</td>
                  <td className="px-4 py-2 text-gray-700 text-center">{payment.customerName}</td>
                  <td className="px-4 py-2 font-semibold text-gray-900 text-center">{payment.number}</td>
                  <td className={`px-4 py-2 font-semibold text-center text-base ${payment.credit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {payment.credit.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};

export default PaymentTPeriodTab;
