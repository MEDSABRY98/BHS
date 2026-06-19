'use client';

import React from 'react';
import NoData from '@/app/Components/NoDataTab';
import {
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { formatDate } from './PaymentTUtilsTab';
import { 
  PaymentByCustomer, 
  PaymentEntry, 
  DetailMode 
} from './PaymentTTypesTab';

interface PaymentTCustomerTabProps {
  detailMode: DetailMode;
  setDetailMode: (mode: DetailMode) => void;
  selectedCustomer: PaymentByCustomer | null;
  setSelectedCustomer: (customer: PaymentByCustomer | null) => void;
  filteredByCustomer: PaymentByCustomer[];
  customerTotals: { totalPayments: number; paymentCount: number };
  customerDetailPayments: PaymentEntry[];
  customerChartData: any[];
  customerAvgDays: number;
  lastCustomerSelection: string | null;
  setLastCustomerSelection: (name: string | null) => void;
  sortColumn: string;
  setSortColumn: (col: any) => void;
  sortDirection: 'asc' | 'desc';
  setSortDirection: (dir: 'asc' | 'desc') => void;
}

const PaymentTCustomerTab: React.FC<PaymentTCustomerTabProps> = ({
  detailMode,
  setDetailMode,
  selectedCustomer,
  setSelectedCustomer,
  filteredByCustomer,
  customerTotals,
  customerDetailPayments,
  customerChartData,
  customerAvgDays,
  setLastCustomerSelection,
  sortColumn,
  setSortColumn,
  sortDirection,
  setSortDirection,
}) => {
  // --- SUB PAGE: Customer List ---
  if (detailMode === 'none') {
    if (filteredByCustomer.length === 0) {
      return <NoData title="NO PAYMENTS MATCH YOUR SEARCH" />;
    }

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-600">
              <tr>
                <th
                  className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => {
                    if (sortColumn === 'customerName') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('customerName');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    Customer Name
                    {sortColumn === 'customerName' && (
                      <span className="text-gray-700">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                  onClick={() => {
                    if (sortColumn === 'totalPayments') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('totalPayments');
                      setSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    Total Payments
                    {sortColumn === 'totalPayments' && (
                      <span className="text-gray-700">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                  onClick={() => {
                    if (sortColumn === 'paymentCount') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('paymentCount');
                      setSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    Payment Count
                    {sortColumn === 'paymentCount' && (
                      <span className="text-gray-700">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                  onClick={() => {
                    if (sortColumn === 'lastPayment') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('lastPayment');
                      setSortDirection('desc');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    Last Payment
                    {sortColumn === 'lastPayment' && (
                      <span className="text-gray-700">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  className="px-5 py-3 text-center font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none w-40"
                  onClick={() => {
                    if (sortColumn === 'daysSince') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('daysSince');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    Days Since
                    {sortColumn === 'daysSince' && (
                      <span className="text-gray-700">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-5 py-3 text-center font-semibold w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredByCustomer.map((item) => (
                <tr key={item.customerName} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-center font-medium text-gray-900">{item.customerName}</td>
                  <td className="px-5 py-3 text-center font-medium text-gray-900 w-40">
                    {item.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-center w-40 text-gray-700">
                    {item.paymentCount}
                  </td>
                  <td className="px-5 py-3 text-center w-40">
                    {item.lastPayment ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {item.lastPayment.credit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-gray-500">
                          {item.lastPayment.parsedDate ? item.lastPayment.parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : item.lastPayment.date}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center w-40">
                    {item.daysSinceLastPayment !== null ? (
                      <span className="text-sm font-semibold text-gray-900">
                        {item.daysSinceLastPayment} {item.daysSinceLastPayment === 1 ? 'day' : 'days'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center w-40">
                    <button
                      onClick={() => {
                        setSelectedCustomer(item);
                        setDetailMode('customer');
                        setLastCustomerSelection(item.customerName.trim().toLowerCase());
                      }}
                      className="px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
              <tr>
                <td className="px-5 py-3 text-center">Total</td>
                <td className="px-5 py-3 text-center w-40">
                  {customerTotals.totalPayments.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="px-5 py-3 text-center w-40">{customerTotals.paymentCount}</td>
                <td className="px-5 py-3 text-center w-40">-</td>
                <td className="px-5 py-3 text-center w-40">-</td>
                <td className="px-5 py-3 text-center w-40"></td>
              </tr>
            </tfoot>
          </table>
      </div>
    );
  }

  // --- SUB PAGE: Customer Details ---
  if (detailMode === 'customer' && selectedCustomer) {
    const groupedMap = new Map<string, any>();
    customerDetailPayments.forEach(p => {
      const key = p.number.trim().toUpperCase();
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          date: p.parsedDate,
          number: p.number,
          totalCredit: 0,
          matches: [],
          hasNegative: false,
          hasOB: false
        });
      }
      const group = groupedMap.get(key)!;
      group.totalCredit += p.credit;
      if (p.credit < 0) group.hasNegative = true;
      if (p.matching) {
        const matchId = p.matching.toString().trim();
        const matchIdLower = matchId.toLowerCase();
        if (!group.matches.some((m: any) => m.id.toLowerCase() === matchIdLower)) {
          group.matches.push({ id: matchId, isOB: p.matchedOpeningBalance });
          if (p.matchedOpeningBalance) group.hasOB = true;
        }
      }
    });
    const groupedPayments = Array.from(groupedMap.values()).sort(
      (a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0),
    );

    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{selectedCustomer.customerName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Payment history</p>
          </div>
          <button
            onClick={() => {
              setDetailMode('none');
              setSelectedCustomer(null);
              setLastCustomerSelection(null);
            }}
            className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-white text-sm"
          >
            ← Back
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Collected', value: customerDetailPayments.reduce((sum, p) => sum + (p.credit || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
              { label: 'Avg Payment', value: (() => { const total = customerDetailPayments.reduce((sum, p) => sum + (p.credit || 0), 0); const count = customerDetailPayments.filter(p => p.rawCredit > 0.01).length; return (count > 0 ? total / count : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); })() },
              { label: 'Payment Count', value: customerDetailPayments.filter(p => p.rawCredit > 0.01).length.toString() },
              { label: 'Avg Days', value: `${Math.round(customerAvgDays)} days` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg border border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="border border-gray-200 rounded-lg p-3 h-72">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Last 12 Months</h4>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={customerChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB' }}
                  formatter={(value: number) => [new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(value), 'Amount']}
                />
                <Bar dataKey="amount" name="Amount" fill="#374151" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {groupedPayments.length === 0 ? (
            <NoData title="NO PAYMENTS FOUND" />
          ) : (
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-600 text-center">
                  <th className="px-4 py-2 text-center font-semibold">Date</th>
                  <th className="px-4 py-2 text-center font-semibold">Number</th>
                  <th className="px-4 py-2 text-center font-semibold">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedPayments.map((group, idx) => (
                  <tr
                    key={`${group.number}-${idx}`}
                    className={`text-center hover:bg-gray-50 ${group.hasNegative ? 'bg-red-50' : group.hasOB ? 'bg-gray-50' : ''}`}
                  >
                    <td className="px-4 py-2 text-center text-gray-700">{formatDate(group.date)}</td>
                    <td className="px-4 py-2 text-center font-medium text-gray-900">{group.number}</td>
                    <td className={`px-4 py-2 text-center font-medium ${group.totalCredit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {group.totalCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default PaymentTCustomerTab;
