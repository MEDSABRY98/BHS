'use client';

import React from 'react';
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
    return (
      <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th
                  className="px-5 py-3 text-left font-semibold cursor-pointer hover:bg-gray-100 transition-colors select-none"
                  onClick={() => {
                    if (sortColumn === 'customerName') {
                      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                    } else {
                      setSortColumn('customerName');
                      setSortDirection('asc');
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Customer Name
                    {sortColumn === 'customerName' && (
                      <span className="text-blue-600">
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
                      <span className="text-blue-600">
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
                      <span className="text-blue-600">
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
                      <span className="text-blue-600">
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
                      <span className="text-blue-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-5 py-3 text-center font-semibold w-40">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredByCustomer.map((item, index) => (
                <tr key={item.customerName} className="bg-white hover:bg-blue-50/40 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="font-semibold text-gray-900">{item.customerName}</div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-center font-semibold text-gray-900 w-40">
                    {item.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-4 text-center w-40">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                      {item.paymentCount}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center w-40">
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
                  <td className="px-5 py-4 text-center w-40">
                    <button
                      onClick={() => {
                        setSelectedCustomer(item);
                        setDetailMode('customer');
                        setLastCustomerSelection(item.customerName.trim().toLowerCase());
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredByCustomer.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No payments match your search.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
              <tr>
                <td className="px-5 py-3 text-left">Total</td>
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
      </div>
    );
  }

  // --- SUB PAGE: Customer Details ---
  if (detailMode === 'customer' && selectedCustomer) {
    return (
      <div className="mt-6 bg-white/90 backdrop-blur-md rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{selectedCustomer.customerName}</h3>
            <p className="text-sm text-gray-500 mt-1">Detailed payment history analysis</p>
          </div>
          <button
            onClick={() => {
              setDetailMode('none');
              setSelectedCustomer(null);
              setLastCustomerSelection(null);
            }}
            className="px-4 py-2 bg-white border border-gray-300 shadow-sm text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center gap-2"
          >
            <span>←</span> Back to list
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-6 rounded-[24px] bg-emerald-50/50 border border-emerald-100/50 flex flex-col items-center text-center shadow-sm">
              <span className="text-emerald-600 font-medium text-sm uppercase tracking-wider mb-1">Total Collected</span>
              <span className="text-3xl font-bold text-emerald-700">
                {customerDetailPayments
                  .reduce((sum, p) => sum + (p.credit || 0), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-6 rounded-[24px] bg-cyan-50/50 border border-cyan-100/50 flex flex-col items-center text-center shadow-sm">
              <span className="text-cyan-600 font-medium text-sm uppercase tracking-wider mb-1">Avg. Payment Amount</span>
              <span className="text-3xl font-bold text-cyan-700">
                {(() => {
                  const total = customerDetailPayments.reduce((sum, p) => sum + (p.credit || 0), 0);
                  const count = customerDetailPayments.filter(p => p.rawCredit > 0.01).length;
                  return (count > 0 ? total / count : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                })()}
              </span>
            </div>

            <div className="p-6 rounded-[24px] bg-blue-50/50 border border-blue-100/50 flex flex-col items-center text-center shadow-sm">
              <span className="text-blue-600 font-medium text-sm uppercase tracking-wider mb-1">Payment Count</span>
              <span className="text-3xl font-bold text-blue-700">
                {customerDetailPayments.filter(p => p.rawCredit > 0.01).length}
              </span>
            </div>

            <div className="p-6 rounded-[24px] bg-purple-50/50 border border-purple-100/50 flex flex-col items-center text-center shadow-sm">
              <span className="text-purple-600 font-medium text-sm uppercase tracking-wider mb-1">Avg. Payment Days</span>
              <span className="text-3xl font-bold text-purple-700">
                {Math.round(customerAvgDays)} <span className="text-lg font-normal text-purple-600">days</span>
              </span>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl p-4 h-80">
            <h4 className="text-xl font-bold text-gray-800 mb-4 px-2">Payments Last 12 Months</h4>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customerChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPayment" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#374151', fontSize: 13, fontWeight: '600' }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: '#EFF6FF', radius: 4 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-xl border border-blue-100 text-sm">
                          <p className="font-bold text-gray-800 mb-1">{label}</p>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-blue-600">
                              {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(data.amount)}
                            </span>
                            <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">AED</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-4">
                            <span className="text-gray-500 text-xs">Transactions</span>
                            <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full text-xs">
                              {data.count}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="amount"
                  name="Amount"
                  fill="url(#colorPayment)"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  activeBar={{ fill: '#1D4ED8' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-12">
            <div className="px-5 py-3 border-b bg-gray-50">
              <h4 className="font-semibold text-gray-800">Payment History</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-gray-600 text-center">
                    <th className="px-4 py-3 text-center">Date</th>
                    <th className="px-4 py-3 text-center">Number</th>
                    <th className="px-4 py-3 text-center">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
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

                    const groupedPayments = Array.from(groupedMap.values()).sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

                    if (groupedPayments.length === 0) {
                      return (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-gray-400">No payments found</td>
                        </tr>
                      );
                    }

                    return groupedPayments.map((group, idx) => (
                      <tr
                        key={`${group.number}-${idx}`}
                        className={`hover:bg-gray-50 text-center ${group.hasNegative
                          ? 'bg-red-100 border-l-4 border-red-500'
                          : group.hasOB
                            ? 'bg-emerald-50/60'
                            : ''
                          }`}
                      >
                        <td className="px-4 py-2 text-gray-700 text-center">{formatDate(group.date)}</td>
                        <td className="px-4 py-2 font-semibold text-gray-900 text-center">{group.number}</td>
                        <td className={`px-4 py-2 font-semibold text-center text-base ${group.totalCredit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {group.totalCredit.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default PaymentTCustomerTab;
