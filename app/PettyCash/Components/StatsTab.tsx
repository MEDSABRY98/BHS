import React, { useState } from 'react';
import { Search, Calendar, TrendingUp, TrendingDown, Clock, BarChart3, Wallet, Eye, EyeOff } from 'lucide-react';

interface Entry {
  id: string;
  date: string;
  amount: number;
  source: string;
  description: string;
  paid: string;
}

interface PendingPayment {
  recipient: string;
  amount: number;
}

interface StatsTabProps {
  receipts: Entry[];
  expenses: Entry[];
  filteredReceipts: Entry[];
  filteredExpenses: Entry[];
  pendingPayments: PendingPayment[];
  totalReceipts: number;
  totalExpenses: number;
  totalPending: number;
  balance: number;
  pendingCount: number;

  // Search & Filter state passed down (so the parent can export the filtered lists to Excel easily)
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  recipientFilter: string;
  setRecipientFilter: (r: string) => void;
  statusFilter: 'All' | 'Yes' | 'No';
  setStatusFilter: (s: 'All' | 'Yes' | 'No') => void;
  fromDate: string;
  setFromDate: (d: string) => void;
  toDate: string;
  setToDate: (d: string) => void;

  uniqueRecipients: string[];
  onOpenEditModal: (entry: Entry, type: 'receipt' | 'expense') => void;
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
}

export default function StatsTab({
  receipts,
  expenses,
  filteredReceipts,
  filteredExpenses,
  pendingPayments,
  totalReceipts,
  totalExpenses,
  totalPending,
  balance,
  pendingCount,
  searchQuery,
  setSearchQuery,
  recipientFilter,
  setRecipientFilter,
  statusFilter,
  setStatusFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  uniqueRecipients,
  onOpenEditModal,
  showBalance,
  setShowBalance
}: StatsTabProps) {
  const [statsSubTab, setStatsSubTab] = useState<'receipts' | 'expenses' | 'pending'>('receipts');

  return (
    <div className="max-w-7xl mx-auto space-y-6 no-print">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-green-50 to-white rounded-xl shadow-lg p-4 border-2 border-green-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-green-500 text-white p-2 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Total Receipts</h3>
          </div>
          <p className="text-2xl font-bold mb-1 text-gray-900">{totalReceipts.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mb-3">AED</p>
          <div className="pt-3 border-t border-green-100">
            <p className="text-xs text-gray-600">Transactions: <span className="font-bold">{filteredReceipts.length}</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-white rounded-xl shadow-lg p-4 border-2 border-red-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-red-500 text-white p-2 rounded-lg">
              <TrendingDown className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Total Expenses</h3>
          </div>
          <p className="text-2xl font-bold mb-1 text-gray-900">{totalExpenses.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mb-3">AED</p>
          <div className="pt-3 border-t border-red-100">
            <p className="text-xs text-gray-600">Transactions: <span className="font-bold">{filteredExpenses.filter(e => e.paid === 'Yes').length}</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-white rounded-xl shadow-lg p-4 border-2 border-orange-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-orange-500 text-white p-2 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Pending (Unpaid)</h3>
          </div>
          <p className="text-2xl font-bold mb-1 text-gray-900">{totalPending.toFixed(2)}</p>
          <p className="text-xs text-gray-600 mb-3">AED</p>
          <div className="pt-3 border-t border-orange-100">
            <p className="text-xs text-gray-600">Transactions: <span className="font-bold">{pendingCount}</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-white text-black p-2 rounded-lg">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">Current Balance</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="text-gray-400 hover:text-white transition-colors p-0.5 rounded"
              title={showBalance ? "Hide Balance" : "Show Balance"}
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-2xl font-bold mb-1 select-none">
            {showBalance ? balance.toFixed(2) : '••••••'}
          </p>
          <p className="text-xs text-gray-300 mb-3">AED</p>
          <div className="pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-300">
              {showBalance ? (balance > 0 ? '✓ Positive' : balance < 0 ? '✗ Deficit' : '• Balanced') : '• Hidden'}
            </p>
          </div>
        </div>
      </div>

      {/* Search and Date Filter */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Box */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by source, description, amount, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 h-11 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>

          {/* Recipient Filter */}
          <div className="md:w-48">
            <select
              value={recipientFilter}
              onChange={(e) => setRecipientFilter(e.target.value)}
              className="w-full px-4 py-2 h-11 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors bg-white font-semibold text-gray-700"
            >
              {uniqueRecipients.map(recipient => (
                <option key={recipient} value={recipient}>{recipient === 'All' ? 'All Recipients' : recipient}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-4 py-2 h-11 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors bg-white font-semibold text-gray-700"
            >
              <option value="All">All Status</option>
              <option value="Yes">PAID</option>
              <option value="No">UNPAID</option>
            </select>
          </div>

          {/* Date Filters */}
          <div className="flex gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                placeholder="From Date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 font-semibold">To</span>
              <input
                type="date"
                placeholder="To Date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="bg-white rounded-xl shadow-lg p-2">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setStatsSubTab('receipts')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${statsSubTab === 'receipts'
              ? 'bg-green-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            Receipts Tracking
          </button>
          <button
            type="button"
            onClick={() => setStatsSubTab('expenses')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${statsSubTab === 'expenses'
              ? 'bg-red-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            Expenses Tracking
          </button>
          <button
            type="button"
            onClick={() => setStatsSubTab('pending')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${statsSubTab === 'pending'
              ? 'bg-amber-500 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            Pending Payments
          </button>
        </div>

        <div className="p-4">
          {statsSubTab === 'receipts' ? (
            <>
              {filteredReceipts.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No receipts available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-gray-50">
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[140px]">Date</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[160px]">Amount</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[250px]">Source</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-auto">Description</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[120px]">Paid?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceipts.slice().sort((a, b) => b.date.localeCompare(a.date)).map((receipt, index) => (
                        <tr
                          key={receipt.id}
                          onClick={() => onOpenEditModal(receipt, 'receipt')}
                          className={`border-b border-gray-100 hover:bg-green-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <td className="py-3 px-3 text-center text-base text-gray-600">{receipt.date}</td>
                          <td className="py-3 px-3 text-center text-base font-bold text-gray-900">{receipt.amount.toFixed(2)} AED</td>
                          <td className="py-3 px-3 text-center text-base text-gray-700">{receipt.source}</td>
                          <td className="py-3 px-3 text-center text-base text-gray-600">{receipt.description}</td>
                          <td className="py-3 px-3 text-center text-base">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${receipt.paid === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {receipt.paid}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : statsSubTab === 'expenses' ? (
            <>
              {filteredExpenses.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No expenses available</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-gray-50">
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[140px]">Date</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[160px]">Amount</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[250px]">Recipient</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-auto">Description</th>
                        <th className="text-center py-4 px-3 text-sm font-black text-gray-500 uppercase tracking-widest w-[120px]">Paid?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.slice().sort((a, b) => b.date.localeCompare(a.date)).map((expense, index) => (
                        <tr
                          key={expense.id}
                          onClick={() => onOpenEditModal(expense, 'expense')}
                          className={`border-b border-gray-100 hover:bg-red-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <td className="py-3 px-3 text-center text-base text-gray-600">{expense.date}</td>
                          <td className="py-3 px-3 text-center text-base font-bold text-gray-900">{expense.amount.toFixed(2)} AED</td>
                          <td className="py-3 px-3 text-center text-base text-gray-700">{expense.source}</td>
                          <td className="py-3 px-3 text-center text-base text-gray-600">{expense.description}</td>
                          <td className="py-3 px-3 text-center text-base">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${expense.paid === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {expense.paid}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              {pendingPayments.length === 0 ? (
                <div className="text-center py-16">
                  <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-6 rounded-full inline-block mb-6 shadow-lg">
                    <TrendingUp className="w-12 h-12 text-green-600" />
                  </div>
                  <h3 className="text-2xl font-black text-gray-800 mb-2">All Payments Settled!</h3>
                  <p className="text-gray-500 text-lg">There are no pending payments at the moment.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Card */}
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 shadow-xl text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-amber-100 text-sm font-semibold uppercase tracking-wide mb-1">Total Outstanding</p>
                        <h2 className="text-4xl font-black">
                          {pendingPayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2)} <span className="text-2xl">AED</span>
                        </h2>
                      </div>
                      <div className="bg-white/20 p-4 rounded-xl backdrop-blur-sm">
                        <Wallet className="w-10 h-10" />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/20">
                      <p className="text-amber-100 text-sm">
                        <span className="font-bold text-white">{pendingPayments.length}</span> recipient{pendingPayments.length > 1 ? 's' : ''} with pending payments
                      </p>
                    </div>
                  </div>

                  {/* Recipients Table */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest w-[80px]">#</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest w-auto">Recipient</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest w-[250px]">Outstanding Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {pendingPayments.map((payment, index) => (
                          <tr key={index} className="hover:bg-amber-50/50 transition-all group">
                            <td className="px-6 py-4 text-center">
                              <span className="text-sm font-black text-amber-600 bg-amber-100 px-3 py-1 rounded-lg">#{index + 1}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-lg font-bold text-gray-800 group-hover:text-amber-600 transition-colors uppercase">
                                {payment.recipient}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-2xl font-black text-red-600">
                                {payment.amount.toFixed(2)} <span className="text-xs text-red-400">AED</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
