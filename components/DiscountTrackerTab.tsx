'use client';

import { useEffect, useMemo, useState } from 'react';
import { DiscountTrackerEntry, InvoiceRow } from '@/types';
import Loading from './Loading';
import * as XLSX from 'xlsx';

interface DiscountTrackerTabProps {
  data: InvoiceRow[];
  isLoading?: boolean;
}

interface MonthItem {
  key: string;
  label: string;
  count?: number;
}

interface DiscountSummary {
  customerName: string;
  missingMonths: MonthItem[];
  postedMonths: MonthItem[];
  reconciledMonths: MonthItem[];
  duplicateMonths: MonthItem[];
  totalDiscounts: number;
  lastDiscountLabel: string;
  startKey: string;
  averageMonthlyDiscount: number;
  activeMonthsCount: number;
  monthlyRebate?: string;
  qRent?: string;
  bRent?: string;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;

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

const toMonthKey = (date: Date | null): string | null => {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (key: string) => {
  const [year, month] = key.split('-');
  const idx = parseInt(month, 10) - 1;
  const name = MONTH_NAMES[idx] || month;
  return `${name}${year.slice(-2)}`;
};

const formatDisplayDate = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-GB');
};

const compareMonthKeys = (a: string, b: string) => a.localeCompare(b);

const addMonth = (key: string): string => {
  const [yStr, mStr] = key.split('-');
  let year = parseInt(yStr, 10);
  let month = parseInt(mStr, 10) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
};

const getMonthRange = (startKey: string, endKey: string) => {
  const result: string[] = [];
  let current = startKey;
  while (compareMonthKeys(current, endKey) <= 0) {
    result.push(current);
    const next = addMonth(current);
    if (next === current) break;
    current = next;
  }
  return result;
};

const normalizeMonthKey = (key: string, fallbackYear: number) => {
  // Accept keys that already look like YYYY-MM
  if (/^\d{4}-\d{2}$/.test(key)) return key;

  const cleaned = key.trim().toUpperCase();
  if (!cleaned) return null;
  const match = cleaned.match(/^([A-Z]{3})[-\/]?(\d{2}|\d{4})$/);
  if (!match) return null;
  const [, monthText, yearText] = match;
  const idx = MONTH_NAMES.findIndex((m) => m.toUpperCase() === monthText);
  if (idx === -1) return null;

  let year = parseInt(yearText, 10);
  if (year < 100) {
    year += 2000;
  }
  if (Number.isNaN(year)) year = fallbackYear;

  return `${year}-${String(idx + 1).padStart(2, '0')}`;
};

export default function DiscountTrackerTab({ data, isLoading }: DiscountTrackerTabProps) {
  const [entries, setEntries] = useState<DiscountTrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<DiscountSummary | null>(null);
  // Removed detailTab state as we switch to unified Heatmap view
  const [selectedPostedMonth, setSelectedPostedMonth] = useState<MonthItem | null>(null); // Kept if we want to show details for posted
  const [isExporting, setIsExporting] = useState(false);
  const [reconcilingKey, setReconcilingKey] = useState<string | null>(null);
  const [showPostedDetails, setShowPostedDetails] = useState(false);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/discounts');
        const res = await response.json();
        if (!response.ok) {
          throw new Error(res.details || res.error || 'Failed to load discount tracker');
        }
        setEntries(res.entries || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch discount tracker entries:', err);
        setError(err instanceof Error ? err.message : 'Failed to load discount tracker data');
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, []);

  const summaries = useMemo<DiscountSummary[]>(() => {
    if (!entries.length) return [];

    const currentYear = new Date().getFullYear();
    const currentMonthKey = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    return entries.map((entry) => {
      const customerKey = entry.customerName.trim().toLowerCase();

      // Get all customer invoices to find First Sale Date
      const customerAllRows = data.filter(
        (row) => row.customerName.trim().toLowerCase() === customerKey
      );

      // Find first SALE month
      let firstSaleMonthKey: string | null = null;
      customerAllRows.forEach((row) => {
        if (row.number?.toString().toUpperCase().startsWith('SAL')) {
          const d = parseDate(row.date);
          const key = toMonthKey(d);
          if (key) {
            if (!firstSaleMonthKey || compareMonthKeys(key, firstSaleMonthKey) < 0) {
              firstSaleMonthKey = key;
            }
          }
        }
      });

      // Filter for Discount Invoices (BIL) for posted counts
      const invoices = customerAllRows.filter(
        (row) => row.number?.toString().toUpperCase().startsWith('BIL')
      );

      const monthCounts = new Map<string, number>();
      let latestMonth: string | null = null;

      invoices.forEach((inv) => {
        const date = parseDate(inv.date);
        const key = toMonthKey(date);
        if (!key) return;
        monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
        if (!latestMonth || compareMonthKeys(key, latestMonth) > 0) {
          latestMonth = key;
        }
      });

      const reconciliationMonths = (entry.reconciliationMonths || [])
        .map((m) => normalizeMonthKey(m, currentYear))
        .filter((m): m is string => Boolean(m));
      const reconciliationSet = new Set(reconciliationMonths);

      // Start Logic: Use First Sale Month if available.
      // If no sales found, maybe fallback to first BIL/Reconciled or just Empty?
      // User said "from [first sales month] to today". If no sales, technically no range.
      // But let's fallback to "earliest activity" (BIL/Reconciled) to be safe if sales data is missing but they are active.

      const knownKeys = [...monthCounts.keys(), ...reconciliationSet];
      const earliestActivity = knownKeys.length ? knownKeys.sort(compareMonthKeys)[0] : null;

      const startKey = firstSaleMonthKey || earliestActivity || `${currentYear}-01`;

      // Range from startKey to today
      const monthRange = compareMonthKeys(startKey, currentMonthKey) <= 0
        ? getMonthRange(startKey, currentMonthKey)
        : [];

      const missingMonths: MonthItem[] = monthRange
        .filter((key) => !monthCounts.has(key) && !reconciliationSet.has(key))
        .map((key) => ({ key, label: formatMonthLabel(key) }));

      const postedMonths: MonthItem[] = Array.from(monthCounts.entries())
        .sort(([a], [b]) => compareMonthKeys(a, b))
        .map(([key, count]) => ({ key, label: formatMonthLabel(key), count }));

      const duplicateMonths = postedMonths.filter((m) => (m.count || 0) > 1);

      const reconciledMonths: MonthItem[] = Array.from(reconciliationSet)
        .sort(compareMonthKeys)
        .map((key) => ({ key, label: formatMonthLabel(key) }));

      // Calculate Total Discount Value (sum of credit - debit for BIL invoices)
      const totalDiscountValue = invoices.reduce((sum, inv) => sum + ((inv.credit || 0) - (inv.debit || 0)), 0);

      // Calculate Active Months Count (distinct months with SAL invoices)
      const salesMonthsSet = new Set<string>();
      customerAllRows.forEach((row) => {
        if (row.number?.toString().toUpperCase().startsWith('SAL')) {
          const d = parseDate(row.date);
          const key = toMonthKey(d);
          if (key) {
            salesMonthsSet.add(key);
          }
        }
      });
      const activeMonthsCount = salesMonthsSet.size;

      const averageMonthlyDiscount = activeMonthsCount > 0 ? totalDiscountValue / activeMonthsCount : 0;

      return {
        customerName: entry.customerName,
        missingMonths,
        postedMonths,
        reconciledMonths,
        duplicateMonths,
        totalDiscounts: invoices.length,
        lastDiscountLabel: latestMonth ? formatMonthLabel(latestMonth) : '—',
        startKey: startKey, // Return startKey for heatmap
        averageMonthlyDiscount,
        activeMonthsCount,
        monthlyRebate: entry.monthlyRebate,
        qRent: entry.qRent,
        bRent: entry.bRent,
      };
    });
  }, [data, entries]);

  const filteredSummaries = useMemo(
    () =>
      summaries
        .filter((summary) => summary.customerName.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => a.customerName.localeCompare(b.customerName)),
    [summaries, search],
  );



  const exportMissingToExcel = () => {
    try {
      setIsExporting(true);

      // Sheet 1: Summary (Customer | Concatenated Missing Months)
      const summaryData = filteredSummaries.map((item) => ({
        Customer: item.customerName,
        'Missing Months': item.missingMonths.map((m) => m.label).join(' | '),
        'Avg. Monthly Discount': item.averageMonthlyDiscount,
        'Active Months count': item.activeMonthsCount
      }));

      // Sheet 2: Details (Customer | Month | Due Amount)
      const detailsData: any[] = [];
      filteredSummaries.forEach((item) => {
        item.missingMonths.forEach((month) => {
          detailsData.push({
            Customer: item.customerName,
            Month: month.label,
            'Due Amount': item.averageMonthlyDiscount // Using the average as the due amount per missing month
          });
        });
      });

      const wb = XLSX.utils.book_new();

      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      const wsDetails = XLSX.utils.json_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(wb, wsDetails, 'Due Amounts');

      const fileName = `missing_discounts_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export Excel file.');
    } finally {
      setIsExporting(false);
    }
  };

  const getPostedInvoices = (customerName: string, monthKey?: string | null) => {
    if (!monthKey) return [];
    return data.filter((row) => {
      if (!row.number?.toUpperCase().startsWith('BIL')) return false;
      if (row.customerName.trim().toLowerCase() !== customerName.trim().toLowerCase()) return false;
      const d = parseDate(row.date);
      const key = toMonthKey(d);
      return key === monthKey;
    });
  };

  const handleReconcile = async (monthKey: string, action: 'reconcile' | 'unreconcile' = 'reconcile') => {
    if (!selectedSummary) return;
    setReconcilingKey(monthKey);
    try {
      const res = await fetch('/api/discounts/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: selectedSummary.customerName,
          monthKey: monthKey,
          action: action
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update reconciliation');
      }

      const updatedKeys: string[] = data.reconciliationMonths || [];

      setEntries((prev) =>
        prev.map((entry) =>
          entry.customerName === selectedSummary.customerName
            ? { ...entry, reconciliationMonths: updatedKeys }
            : entry,
        ),
      );

      // Optimistic/Immediate update for the modal
      setSelectedSummary((prev) => {
        if (!prev) return prev;

        // Re-calculate based on the action
        let newMissing = [...prev.missingMonths];
        let newReconciled = [...prev.reconciledMonths];

        if (action === 'reconcile') {
          newMissing = newMissing.filter((m) => m.key !== monthKey);
          if (!newReconciled.find(m => m.key === monthKey)) {
            newReconciled.push({ key: monthKey, label: formatMonthLabel(monthKey) });
          }
        } else {
          // Unlock/Unfix
          newReconciled = newReconciled.filter((m) => m.key !== monthKey);
          if (!newMissing.find(m => m.key === monthKey)) {
            newMissing.push({ key: monthKey, label: formatMonthLabel(monthKey) });
          }
        }

        return {
          ...prev,
          missingMonths: newMissing.sort((a, b) => compareMonthKeys(a.key, b.key)),
          reconciledMonths: newReconciled.sort((a, b) => compareMonthKeys(a.key, b.key)),
        };
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update reconciliation');
    } finally {
      setReconcilingKey(null);
    }
  };

  const [currentUserName, setCurrentUserName] = useState('');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    if (storedUser && storedUser.name) {
      setCurrentUserName(storedUser.name);
    }
  }, []);

  // Heatmap rendering helpers
  const renderHeatmap = (summary: DiscountSummary) => {
    const startYear = parseInt(summary.startKey.split('-')[0], 10);
    const endYear = new Date().getFullYear();
    const currentMonthKey = `${endYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const years = [];
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }

    const canFix = currentUserName === 'MED Sabry';

    return (
      <div className="space-y-6">
        {years.map(year => (
          <div key={year} className="bg-gray-50/50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-lg font-bold text-gray-700 mb-3">{year}</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                const isFuture = compareMonthKeys(monthKey, currentMonthKey) > 0;
                const isBeforeStart = compareMonthKeys(monthKey, summary.startKey) < 0;
                if (isBeforeStart) return null;

                // Determine Status
                const isPosted = summary.postedMonths.find(m => m.key === monthKey);
                const isReconciled = summary.reconciledMonths.find(m => m.key === monthKey);
                const isMissing = !isPosted && !isReconciled && !isFuture;

                let baseClasses = "relative h-20 rounded-lg border flex flex-col items-center justify-center transition-all duration-200 p-1";
                let statusColor = "";
                let content = null;
                let onClick = undefined;
                let disabled = false;

                if (isFuture) {
                  statusColor = "bg-gray-50 border-gray-100 opacity-40";
                  content = <span className="text-xs text-gray-300 font-medium">{MONTH_NAMES[i]}</span>;
                } else if (isPosted) {
                  statusColor = "bg-green-100 border-green-300 hover:bg-green-200 hover:shadow-sm cursor-pointer";
                  content = (
                    <>
                      <span className="text-xs font-bold text-green-800 uppercase mb-1">{MONTH_NAMES[i]}</span>
                      <span className="text-[10px] font-bold bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">
                        {isPosted.count} BIL
                      </span>
                    </>
                  );
                  onClick = () => {
                    setSelectedPostedMonth(isPosted);
                    setShowPostedDetails(true);
                  };
                } else if (isReconciled) {
                  statusColor = "bg-orange-100 border-orange-300 hover:bg-orange-200";
                  if (canFix) {
                    statusColor += " cursor-pointer hover:shadow-md group relative";
                  }

                  const isReconciling = reconcilingKey === monthKey;
                  content = (
                    <>
                      <span className="text-xs font-bold text-orange-800 uppercase mb-1">{MONTH_NAMES[i]}</span>
                      {isReconciling ? (
                        <svg className="animate-spin h-4 w-4 text-orange-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold bg-white/60 text-orange-700 px-1.5 py-0.5 rounded-full border border-orange-200 group-hover:opacity-0 transition-opacity">
                            REC
                          </span>
                          {canFix && (
                            <span className="absolute inset-x-0 bottom-2 text-[10px] font-bold text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                              Unfix?
                            </span>
                          )}
                        </>
                      )}
                    </>
                  );
                  if (canFix) {
                    onClick = () => {
                      if (window.confirm(`Un-reconcile ${monthKey}? This will mark it as missing.`)) {
                        handleReconcile(monthKey, 'unreconcile');
                      }
                    };
                    disabled = isReconciling;
                  }
                } else if (isMissing) {
                  statusColor = canFix
                    ? "bg-red-100 border-red-300 hover:bg-red-200 hover:shadow-md cursor-pointer group"
                    : "bg-red-50 border-red-200 opacity-80 cursor-default";

                  const isReconciling = reconcilingKey === monthKey;
                  content = (
                    <>
                      <span className={`text-xs font-bold uppercase mb-1 ${canFix ? 'text-red-800' : 'text-red-400'}`}>{MONTH_NAMES[i]}</span>
                      {isReconciling ? (
                        <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        canFix && (
                          <>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-red-700 bg-white/80 px-1 rounded border border-red-200">
                              Fix?
                            </span>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-10 transition-opacity bg-red-400 rounded-lg"></div>
                          </>
                        )
                      )}
                    </>
                  );
                  if (canFix) {
                    onClick = () => handleReconcile(monthKey);
                    disabled = isReconciling;
                  } else {
                    disabled = true;
                  }
                } else {
                  // Default fallback? Should be covered by logic above
                  statusColor = "bg-gray-50 border-gray-200";
                }

                return (
                  <button
                    key={monthKey}
                    className={`${baseClasses} ${statusColor}`}
                    onClick={!disabled ? onClick : undefined}
                    disabled={disabled || (!onClick)}
                    title={isMissing ? (canFix ? "Click to Reconcile" : "Missing Discount") : isPosted ? "View Details" : ""}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };


  if (loading || isLoading) {
    return <Loading message="Loading discount tracker..." />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg max-w-3xl mx-auto">
          {error}
        </div>
      </div>
    );
  }

  if (!entries.length) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg max-w-3xl mx-auto">
          لم يتم العثور على عملاء في شيت DISCOUNTS.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">

      <div className="mb-4 flex flex-col sm:flex-row items-center justify-center gap-3">
        <input
          type="text"
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
        />
        <button
          onClick={exportMissingToExcel}
          disabled={isExporting}
          className="inline-flex items-center gap-2 p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          title="Export missing months to Excel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-5 py-3 text-left font-semibold w-1/3">Customer Name</th>
                <th className="px-5 py-3 text-center font-semibold w-1/6">Avg. Discount</th>
                <th className="px-5 py-3 text-center font-semibold w-1/6">Missing</th>
                <th className="px-5 py-3 text-center font-semibold w-1/6">Posted (BIL)</th>
                <th className="px-5 py-3 text-center font-semibold w-1/6">Reconciled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSummaries.map((summary, index) => {
                const missingCount = summary.missingMonths.length;
                const postedCount = summary.postedMonths.length;
                const reconciledCount = summary.reconciledMonths.length;

                return (
                  <tr
                    key={summary.customerName}
                    className="bg-white hover:bg-blue-50/40 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div className="flex flex-col">
                          <button
                            onClick={() => {
                              setSelectedSummary(summary);
                              setShowPostedDetails(false);
                            }}
                            className="text-left text-blue-700 hover:text-blue-900 font-semibold"
                          >
                            {summary.customerName}
                          </button>
                          <div className="text-xs text-gray-500">
                            Started {formatDisplayDate(summary.startKey)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-gray-800">
                          {summary.averageMonthlyDiscount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          Over {summary.activeMonthsCount} mo.
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      {missingCount === 0 ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                          Up to date
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                          {missingCount} month(s)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      {postedCount === 0 ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">
                          —
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {postedCount} month(s)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-center">
                      {reconciledCount === 0 ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-200">
                          —
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                          {reconciledCount} month(s)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredSummaries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No customers match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSummary && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center px-8 py-5 border-b bg-gray-50">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{selectedSummary.customerName}</h3>
                <div className="flex items-center gap-4 mt-1 text-sm">
                  <span className="flex items-center justify-center w-32 gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200 font-medium shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Posted
                  </span>
                  <span className="flex items-center justify-center w-32 gap-1.5 px-2 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 font-medium shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span> Reconciled
                  </span>
                  <span className="flex items-center justify-center w-32 gap-1.5 px-2 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 font-medium shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Missing
                  </span>
                </div>
              </div>

              {/* Estimated Discounts Section */}
              <div className="flex items-center gap-6 px-6 py-2 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm ml-auto mr-8">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-0.5">Monthly</div>
                  <div className="text-sm font-black text-blue-900 px-3 py-1 bg-white rounded-lg shadow-sm min-w-[60px]">
                    {selectedSummary.monthlyRebate || '—'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-500 font-bold mb-0.5">Q Rent</div>
                  <div className="text-sm font-black text-indigo-900 px-3 py-1 bg-white rounded-lg shadow-sm min-w-[60px]">
                    {selectedSummary.qRent || '—'}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-wider text-violet-500 font-bold mb-0.5">B Rent</div>
                  <div className="text-sm font-black text-violet-900 px-3 py-1 bg-white rounded-lg shadow-sm min-w-[60px]">
                    {selectedSummary.bRent || '—'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedSummary(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-8 overflow-y-auto bg-white flex-1 relative min-h-[600px]">
              {showPostedDetails && selectedPostedMonth ? (
                <div className="flex flex-col animate-in slide-in-from-right duration-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowPostedDetails(false)}
                        className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                      </button>
                      <h4 className="text-xl font-bold text-gray-800">
                        Posted Invoices - {selectedPostedMonth.label}
                      </h4>
                    </div>

                    {/* Navigation Arrows */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const currentIndex = selectedSummary.postedMonths.findIndex(m => m.key === selectedPostedMonth.key);
                          if (currentIndex > 0) {
                            setSelectedPostedMonth(selectedSummary.postedMonths[currentIndex - 1]);
                          }
                        }}
                        disabled={selectedSummary.postedMonths.findIndex(m => m.key === selectedPostedMonth.key) <= 0}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Previous Month"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const currentIndex = selectedSummary.postedMonths.findIndex(m => m.key === selectedPostedMonth.key);
                          if (currentIndex < selectedSummary.postedMonths.length - 1) {
                            setSelectedPostedMonth(selectedSummary.postedMonths[currentIndex + 1]);
                          }
                        }}
                        disabled={selectedSummary.postedMonths.findIndex(m => m.key === selectedPostedMonth.key) >= selectedSummary.postedMonths.length - 1}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Next Month"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="bg-white border boundary-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr className="text-center text-gray-600">
                          <th className="px-6 py-4">Number</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Debit</th>
                          <th className="px-6 py-4">Credit</th>
                          <th className="px-6 py-4">Matching</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(() => {
                          const invoices = getPostedInvoices(selectedSummary.customerName, selectedPostedMonth.key);
                          const totalDebit = invoices.reduce((sum, inv) => sum + (inv.debit || 0), 0);
                          const totalCredit = invoices.reduce((sum, inv) => sum + (inv.credit || 0), 0);
                          const netTotal = totalCredit - totalDebit;

                          return (
                            <>
                              {invoices.map((inv, idx) => (
                                <tr key={`${inv.number}-${idx}`} className="hover:bg-gray-50 text-center">
                                  <td className="px-6 py-4 font-semibold text-gray-900 text-center">{inv.number}</td>
                                  <td className="px-6 py-4 text-gray-700 text-center">{formatDisplayDate(inv.date)}</td>
                                  <td className="px-6 py-4 text-gray-800 text-center">{inv.debit?.toLocaleString('en-US')}</td>
                                  <td className="px-6 py-4 text-gray-800 text-center">{inv.credit?.toLocaleString('en-US')}</td>
                                  <td className="px-6 py-4 text-gray-500 text-center">{inv.matching || '—'}</td>
                                </tr>
                              ))}
                              {/* Total Row */}
                              <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900">
                                <td colSpan={2} className="px-6 py-4 text-right"></td>
                                <td className="px-6 py-4 text-center">{totalDebit.toLocaleString('en-US')}</td>
                                <td className="px-6 py-4 text-center">{totalCredit.toLocaleString('en-US')}</td>
                                <td className="px-6 py-4 text-center text-blue-700">Net: {netTotal.toLocaleString('en-US')}</td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                renderHeatmap(selectedSummary)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

