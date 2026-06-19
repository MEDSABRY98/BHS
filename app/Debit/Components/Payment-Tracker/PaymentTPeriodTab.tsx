'use client';

import React from 'react';
import NoData from '@/app/Components/NoDataTab';
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
  if (detailMode === 'none') {
    return (
      <div className="space-y-3">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg border border-gray-200 w-full">
          {(['daily', 'weekly', 'monthly', 'yearly'] as PeriodType[]).map((type) => (
            <button
              key={type}
              onClick={() => {
                setPeriodType(type);
                setDetailMode('none');
                setSelectedPeriod(null);
              }}
              className={`flex-1 py-2 rounded-md text-xs font-semibold uppercase ${periodType === type
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              {type}
            </button>
          ))}
        </div>

        {paymentsByPeriod.length === 0 ? (
          <NoData title="NO PAYMENTS MATCH YOUR SEARCH" />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-center font-semibold">Period</th>
                  <th className="px-4 py-3 text-center font-semibold">Total Payments</th>
                  <th className="px-4 py-3 text-center font-semibold">Payment Count</th>
                  <th className="px-4 py-3 text-center font-semibold">Customer Count</th>
                  <th className="px-4 py-3 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentsByPeriod.map((item) => {
                  const customerCount = new Set(
                    item.payments.map((p) => p.customerName.trim().toLowerCase()),
                  ).size;
                  return (
                    <tr key={item.periodKey} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-center font-medium text-gray-900">{item.period}</td>
                      <td className="px-4 py-3 text-center text-gray-900">
                        {item.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">{item.paymentCount}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{customerCount}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedPeriod(item);
                            setDetailMode('period');
                            setLastPeriodSelection((prev: any) => ({ ...prev, [periodType]: item.periodKey }));
                          }}
                          className="px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t border-gray-200">
                <tr>
                  <td className="px-4 py-3 text-center">Total</td>
                  <td className="px-4 py-3 text-center">
                    {periodTotals.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">{periodTotals.paymentCount}</td>
                  <td className="px-4 py-3 text-center">{periodTotals.customerCount}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (detailMode === 'period' && selectedPeriod) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{selectedPeriod.period}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Total: {periodDetailPayments.reduce((sum, p) => sum + (p.credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' · '}{periodDetailPayments.filter(p => p.rawCredit > 0.01).length} payments
            </p>
          </div>
          <button
            onClick={() => { setDetailMode('none'); setSelectedPeriod(null); }}
            className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-white text-sm"
          >
            ← Back
          </button>
        </div>

        {periodDetailPayments.length === 0 ? (
          <NoData title="NO PAYMENTS FOUND" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-gray-600 text-center">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Customer Name</th>
                <th className="px-4 py-2">Number</th>
                <th className="px-4 py-2">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodDetailPayments.map((payment, idx) => (
                <tr
                  key={`${payment.number}-${idx}`}
                  className={`text-center hover:bg-gray-50 ${payment.credit < 0 ? 'bg-red-50' : payment.matchedOpeningBalance ? 'bg-gray-50' : ''}`}
                >
                  <td className="px-4 py-2 text-gray-700">{formatDate(payment.parsedDate)}</td>
                  <td className="px-4 py-2 text-gray-700">{payment.customerName}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{payment.number}</td>
                  <td className={`px-4 py-2 font-medium ${payment.credit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {payment.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return null;
};

export default PaymentTPeriodTab;
