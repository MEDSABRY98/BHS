'use client';

import { useMemo, useState } from 'react';
import { InvoiceRow } from '@/types';
import { getInvoiceType } from '@/lib/invoiceType';

interface PaymentTrackerTabProps {
  data: InvoiceRow[];
}

interface PaymentEntry {
  date: string;
  number: string;
  customerName: string;
  type: string;
  credit: number;
  rawCredit: number;
  debit: number;
  rawDebit: number;
  amountSource: 'credit' | 'debit' | 'netDebt' | 'creditMinusDebit';
  salesRep: string;
  matching?: string;
  parsedDate: Date | null;
  matchedOpeningBalance: boolean;
}

interface PaymentByCustomer {
  customerName: string;
  totalPayments: number;
  paymentCount: number;
  payments: PaymentEntry[];
}

interface PaymentByPeriod {
  period: string;
  periodKey: string;
  totalPayments: number;
  paymentCount: number;
  payments: PaymentEntry[];
}

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const candidate = new Date(y, m, d);
    if (!isNaN(candidate.getTime())) return candidate;
  }

  return null;
};

const formatDate = (date: Date | null): string => {
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateInput = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDailyKey = (date: Date): string => {
  return formatDate(date);
};

const getWeeklyKey = (date: Date): string => {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(days / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
};

const getMonthlyKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getYearlyKey = (date: Date): string => {
  return String(date.getFullYear());
};

const formatPeriodLabel = (key: string, periodType: 'daily' | 'weekly' | 'monthly' | 'yearly'): string => {
  if (periodType === 'daily') {
    return key; // Already formatted as DD/MM/YYYY
  } else if (periodType === 'weekly') {
    const [year, week] = key.split('-W');
    return `Week ${week}, ${year}`;
  } else if (periodType === 'monthly') {
    const [year, month] = key.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    return `${monthNames[monthIndex] || month} ${year}`;
  } else {
    return key;
  }
};

export default function PaymentTrackerTab({ data }: PaymentTrackerTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'customer' | 'period'>('customer');
  const [periodType, setPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showOBClosedPayments, setShowOBClosedPayments] = useState(true);
  const [showOtherPayments, setShowOtherPayments] = useState(true);

  // Pre-calc matching IDs that are tied to OB (opening balance) invoices
  const obMatchingIds = useMemo(() => {
    const set = new Set<string>();
    data.forEach((row) => {
      const num = (row.number || '').toUpperCase();
      const matchId = (row.matching || '').toString().toLowerCase();
      if (num.startsWith('OB') && matchId) {
        set.add(matchId);
      }
    });
    return set;
  }, [data]);

  // Filter payments using the same TYPE logic as the Invoices tab (via shared getInvoiceType).
  const payments = useMemo<PaymentEntry[]>(() => {
    return data
      .filter((row) => getInvoiceType(row) === 'Payment')
      .map((row) => {
        const credit = row.credit || 0;
        const debit = row.debit || 0;
        // User-requested: payments amount = Credit - Debit
        const amountSource: 'creditMinusDebit' = 'creditMinusDebit';
        const amount = credit - debit;

        return {
        date: row.date,
        number: row.number,
        customerName: row.customerName,
          type: getInvoiceType(row),
        credit: amount,
          rawCredit: credit,
        debit: row.debit,
          rawDebit: debit,
          amountSource,
        salesRep: row.salesRep,
        matching: row.matching,
        parsedDate: parseDate(row.date),
        matchedOpeningBalance: row.matching
          ? obMatchingIds.has(row.matching.toString().toLowerCase())
          : false,
      };
      })
      .filter((payment) => {
        // Apply date filter
        if (dateFrom || dateTo) {
          const paymentDate = payment.parsedDate;
          if (!paymentDate) return false;

          if (dateFrom) {
            const fromDate = parseDate(dateFrom);
            if (fromDate && paymentDate < fromDate) return false;
          }

          if (dateTo) {
            const toDate = parseDate(dateTo);
            if (toDate) {
              // Include the entire day
              const toDateEnd = new Date(toDate);
              toDateEnd.setHours(23, 59, 59, 999);
              if (paymentDate > toDateEnd) return false;
            }
          }
        }

        return true;
      });
  }, [data, dateFrom, dateTo, obMatchingIds]);

  // Apply OB-closed / other payments toggles
  const visiblePayments = useMemo<PaymentEntry[]>(() => {
    if (showOBClosedPayments && showOtherPayments) return payments;

    return payments.filter((p) => {
      if (p.matchedOpeningBalance) {
        return showOBClosedPayments;
      }
      return showOtherPayments;
    });
  }, [payments, showOBClosedPayments, showOtherPayments]);

  // Group by customer
  const paymentsByCustomer = useMemo<PaymentByCustomer[]>(() => {
    const grouped = new Map<string, PaymentEntry[]>();

    visiblePayments.forEach((payment) => {
      const key = payment.customerName.trim().toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(payment);
    });

    return Array.from(grouped.entries())
      .map(([key, paymentList]) => {
        const customerName = paymentList[0].customerName;
        const totalPayments = paymentList.reduce((sum, p) => sum + p.credit, 0);
        // Only count actual payments (where Credit > 0.01) based on raw credit data
        // This excludes reversals or purely debit adjustments that might have been included in the list
        const paymentCount = paymentList.filter(p => p.rawCredit > 0.01).length;
        
        return {
          customerName,
          totalPayments,
          paymentCount,
          payments: paymentList.sort((a, b) => {
            if (!a.parsedDate || !b.parsedDate) return 0;
            return b.parsedDate.getTime() - a.parsedDate.getTime();
          }),
        };
      })
      .sort((a, b) => b.totalPayments - a.totalPayments);
  }, [visiblePayments]);

  // Group by period (respecting search so main rows + popup are aligned)
  const paymentsByPeriod = useMemo<PaymentByPeriod[]>(() => {
    const grouped = new Map<string, PaymentEntry[]>();
    const searchLower = search.toLowerCase().trim();

    // If searching, restrict to payments that match customer name or number
    const basePayments = searchLower
      ? visiblePayments.filter(
          (p) =>
            p.customerName.toLowerCase().includes(searchLower) ||
            p.number.toLowerCase().includes(searchLower),
        )
      : visiblePayments;

    basePayments.forEach((payment) => {
      if (!payment.parsedDate) return;

      let key: string;
      if (periodType === 'daily') {
        key = getDailyKey(payment.parsedDate);
      } else if (periodType === 'weekly') {
        key = getWeeklyKey(payment.parsedDate);
      } else if (periodType === 'monthly') {
        key = getMonthlyKey(payment.parsedDate);
      } else {
        key = getYearlyKey(payment.parsedDate);
      }

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(payment);
    });

    return Array.from(grouped.entries())
      .map(([key, paymentList]) => {
        const totalPayments = paymentList.reduce((sum, p) => sum + p.credit, 0);
        const sortedPayments = paymentList.sort((a, b) => {
          if (!a.parsedDate || !b.parsedDate) return 0;
          return b.parsedDate.getTime() - a.parsedDate.getTime();
        });
        
        // Only count actual payments (where Credit > 0.01) based on raw credit data
        const paymentCount = paymentList.filter(p => p.rawCredit > 0.01).length;

        return {
          period: formatPeriodLabel(key, periodType),
          periodKey: key,
          totalPayments,
          paymentCount,
          payments: sortedPayments,
        };
      })
      .sort((a, b) => {
        // For daily view, sort by latest payment date (newest first)
        if (periodType === 'daily') {
          const aTime = a.payments[0]?.parsedDate?.getTime() ?? 0;
          const bTime = b.payments[0]?.parsedDate?.getTime() ?? 0;
          return bTime - aTime;
        }
        // For other views, fall back to period key (chronological)
        return b.periodKey.localeCompare(a.periodKey);
      });
  }, [visiblePayments, periodType, search]);

  // Total collected amount respecting filters (date + search + tab)
  const totalFilteredPayments = useMemo(() => {
    const searchLower = search.toLowerCase().trim();

    let relevantPayments: PaymentEntry[];
    if (!searchLower) {
      relevantPayments = visiblePayments;
    } else if (activeSubTab === 'customer') {
      // Match by customer only
      relevantPayments = visiblePayments.filter((p) =>
        p.customerName.toLowerCase().includes(searchLower),
      );
    } else {
      // For period view, match by customer or number (same as period search logic)
      relevantPayments = visiblePayments.filter(
        (p) =>
          p.customerName.toLowerCase().includes(searchLower) ||
          p.number.toLowerCase().includes(searchLower),
      );
    }

    return relevantPayments.reduce((sum, p) => sum + (p.credit || 0), 0);
  }, [visiblePayments, search, activeSubTab]);

  // Filter by search
  const filteredByCustomer = useMemo(() => {
    if (!search) return paymentsByCustomer;
    const searchLower = search.toLowerCase();
    return paymentsByCustomer.filter(
      (item) => item.customerName.toLowerCase().includes(searchLower)
    );
  }, [paymentsByCustomer, search]);

  const filteredByPeriod = useMemo(() => paymentsByPeriod, [paymentsByPeriod]);

  // Calculate totals for Customer view
  const customerTotals = useMemo(() => {
    return filteredByCustomer.reduce(
      (acc, item) => ({
        totalPayments: acc.totalPayments + item.totalPayments,
        paymentCount: acc.paymentCount + item.paymentCount,
      }),
      { totalPayments: 0, paymentCount: 0 }
    );
  }, [filteredByCustomer]);

  // Calculate totals for Period view
  const periodTotals = useMemo(() => {
    return filteredByPeriod.reduce(
      (acc, item) => {
        const customerCount = new Set(
          item.payments.map((p) => p.customerName.trim().toLowerCase())
        ).size;
        return {
          totalPayments: acc.totalPayments + item.totalPayments,
          paymentCount: acc.paymentCount + item.paymentCount,
          customerCount: acc.customerCount + customerCount,
        };
      },
      { totalPayments: 0, paymentCount: 0, customerCount: 0 }
    );
  }, [filteredByPeriod]);

  const [selectedCustomer, setSelectedCustomer] = useState<PaymentByCustomer | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PaymentByPeriod | null>(null);
  const [detailMode, setDetailMode] = useState<'none' | 'customer' | 'period'>('none');
  const [lastPeriodSelection, setLastPeriodSelection] = useState<
    Partial<Record<'daily' | 'weekly' | 'monthly' | 'yearly', string>>
  >({});
  const [lastCustomerSelection, setLastCustomerSelection] = useState<string | null>(null);

  // Detail payments: show ALL payments for the selected customer/period (do not shrink by the main Search box),
  // so counts match the "Payment by Customer" summary.
  const customerDetailPayments = useMemo(() => {
    if (!selectedCustomer) return [];
    const nameKey = selectedCustomer.customerName.trim().toLowerCase();
    return visiblePayments.filter(
      (p) => p.customerName.trim().toLowerCase() === nameKey,
    );
  }, [visiblePayments, selectedCustomer]);

  const periodDetailPayments = useMemo(() => {
    if (!selectedPeriod) return [];

    // Rebuild base list from visiblePayments so that OB filters are always respected
    const base = visiblePayments.filter((p) => {
      if (!p.parsedDate) return false;

      let key: string;
      if (periodType === 'daily') {
        key = getDailyKey(p.parsedDate);
      } else if (periodType === 'weekly') {
        key = getWeeklyKey(p.parsedDate);
      } else if (periodType === 'monthly') {
        key = getMonthlyKey(p.parsedDate);
      } else {
        key = getYearlyKey(p.parsedDate);
      }

      return key === selectedPeriod.periodKey;
    });

    return base;
  }, [visiblePayments, selectedPeriod, periodType]);

  // (Customer detail restore is handled synchronously in the tab button click handler)

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Payment Tracker</h2>
        <p className="text-gray-600">Track payments and sales</p>
      </div>

      {/* Sub-tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => {
            setActiveSubTab('customer');

            if (lastCustomerSelection) {
              const match = paymentsByCustomer.find(
                (c) => c.customerName.trim().toLowerCase() === lastCustomerSelection,
              );
              if (match) {
                setSelectedCustomer(match);
                setDetailMode('customer');
                return;
              }
            }

            setDetailMode('none');
            setSelectedCustomer(null);
          }}
          className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
            activeSubTab === 'customer'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Payment by Customer
        </button>
        <button
          onClick={() => {
            setActiveSubTab('period');
            setDetailMode('none');
            setSelectedPeriod(null);
          }}
          className={`px-6 py-3 font-semibold border-b-2 transition-colors ${
            activeSubTab === 'period'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Payment by Period
        </button>
      </div>

      {/* Search, Total and Date Filters */}
      <div className="mb-3 flex flex-col lg:flex-row gap-4 items-center lg:items-end justify-between">
        <div className="w-full flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-sm font-semibold text-green-700 whitespace-nowrap shrink-0">
            Total Collected:{' '}
            {totalFilteredPayments.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2 w-full lg:w-auto justify-end">
          <input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* OB matching filters */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-center text-sm text-gray-700">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOBClosedPayments}
            onChange={(e) => setShowOBClosedPayments(e.target.checked)}
            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
          />
          <span>OB Closed Payments</span>
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOtherPayments}
            onChange={(e) => setShowOtherPayments(e.target.checked)}
            className="w-4 h-4 text-slate-600 border-gray-300 rounded focus:ring-slate-500"
          />
          <span>Other / Open Payments</span>
        </label>
      </div>

      {/* Period Type Selector (only for period tab) */}
      {activeSubTab === 'period' && (
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => {
              setPeriodType('daily');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              periodType === 'daily'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => {
              setPeriodType('weekly');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              periodType === 'weekly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => {
              setPeriodType('monthly');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              periodType === 'monthly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => {
              setPeriodType('yearly');
              setDetailMode('none');
              setSelectedPeriod(null);
            }}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              periodType === 'yearly'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Yearly
          </button>
        </div>
      )}

      {/* Payment by Customer - Main List */}
      {activeSubTab === 'customer' && detailMode === 'none' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Customer Name</th>
                  <th className="px-5 py-3 text-right font-semibold">Total Payments</th>
                  <th className="px-5 py-3 text-center font-semibold">Payment Count</th>
                  <th className="px-5 py-3 text-center font-semibold">Actions</th>
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
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      {item.totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        {item.paymentCount}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
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
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      No payments match your search.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                <tr>
                  <td className="px-5 py-3 text-left">Total</td>
                  <td className="px-5 py-3 text-right">
                    {customerTotals.totalPayments.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-3 text-center">{customerTotals.paymentCount}</td>
                  <td className="px-5 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Payment by Period - Main List */}
      {activeSubTab === 'period' && detailMode === 'none' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                {filteredByPeriod.map((item, index) => {
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
                            setLastPeriodSelection((prev) => ({
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
                {filteredByPeriod.length === 0 && (
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
      )}

      {/* Customer Details - Full Page inside tab */}
      {activeSubTab === 'customer' && detailMode === 'customer' && selectedCustomer && (
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{selectedCustomer.customerName}</h3>
              <p className="text-sm text-gray-500">
                Total Payments:{' '}
                {customerDetailPayments
                  .reduce((sum, p) => sum + (p.credit || 0), 0)
                  .toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                · Payment Count: {customerDetailPayments.filter(p => p.rawCredit > 0.01).length}
              </p>
            </div>
            <button
              onClick={() => {
                setDetailMode('none');
                setSelectedCustomer(null);
                setLastCustomerSelection(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              ← Back to list
            </button>
          </div>
          <div className="px-6 pb-6 pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-600 text-center">
                  <th className="px-4 py-3 text-center">Date</th>
                  <th className="px-4 py-3 text-center">Number</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Paid</th>
                  <th className="px-4 py-3 text-center">Matching</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerDetailPayments.map((payment, idx) => (
                  <tr
                    key={`${payment.number}-${idx}`}
                    className={`hover:bg-gray-50 text-center ${
                      payment.credit < 0 
                        ? 'bg-red-50/60' 
                        : payment.matchedOpeningBalance 
                          ? 'bg-emerald-50/60' 
                          : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-gray-700 text-center">{formatDate(payment.parsedDate)}</td>
                    <td className="px-4 py-2 font-semibold text-gray-900 text-center">{payment.number}</td>
                    <td className="px-4 py-2 text-gray-700 text-center">{payment.type}</td>
                    <td className={`px-4 py-2 font-semibold text-center text-base ${payment.credit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {payment.credit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-center">
                      {payment.matching || '—'}
                      {payment.matchedOpeningBalance && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          OB Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Period Details - Full Page inside tab */}
      {activeSubTab === 'period' && detailMode === 'period' && selectedPeriod && (
        <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
              ← Back to list
            </button>
          </div>
          <div className="px-6 pb-6 pt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-gray-600 text-center">
                  <th className="px-4 py-3 text-center">Date</th>
                  <th className="px-4 py-3 text-center">Customer Name</th>
                  <th className="px-4 py-3 text-center">Number</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Paid</th>
                  <th className="px-4 py-3 text-center">Matching</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {periodDetailPayments.map((payment, idx) => (
                  <tr
                    key={`${payment.number}-${idx}`}
                    className={`hover:bg-gray-50 text-center ${
                      payment.credit < 0 
                        ? 'bg-red-50/60' 
                        : payment.matchedOpeningBalance 
                          ? 'bg-emerald-50/60' 
                          : ''
                    }`}
                  >
                    <td className="px-4 py-2 text-gray-700 text-center">{formatDate(payment.parsedDate)}</td>
                    <td className="px-4 py-2 text-gray-700 text-center">{payment.customerName}</td>
                    <td className="px-4 py-2 font-semibold text-gray-900 text-center">{payment.number}</td>
                    <td className="px-4 py-2 text-gray-700 text-center">{payment.type}</td>
                    <td className={`px-4 py-2 font-semibold text-center text-base ${payment.credit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {payment.credit.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2 text-gray-500 text-center">
                      {payment.matching || '—'}
                      {payment.matchedOpeningBalance && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          OB Closed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

