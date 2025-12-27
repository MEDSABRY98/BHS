'use client';

import { useEffect, useMemo, useState } from 'react';
import { DiscountTrackerEntry, InvoiceRow } from '@/types';
import Loading from './Loading';

interface DiscountTrackerTabProps {
  data: InvoiceRow[];
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

export default function DiscountTrackerTab({ data }: DiscountTrackerTabProps) {
  const [entries, setEntries] = useState<DiscountTrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSummary, setSelectedSummary] = useState<DiscountSummary | null>(null);
  const [detailTab, setDetailTab] = useState<'missing' | 'posted' | 'reconciled' | 'posted-details'>('missing');
  const [selectedPostedMonth, setSelectedPostedMonth] = useState<MonthItem | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [reconcilingKey, setReconcilingKey] = useState<string | null>(null);

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
      const invoices = data.filter(
        (row) =>
          row.number?.toString().toUpperCase().startsWith('BIL') &&
          row.customerName.trim().toLowerCase() === customerKey,
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

      const knownKeys = [...monthCounts.keys(), ...reconciliationSet];
      const startKeyCandidate = knownKeys.length
        ? knownKeys.sort(compareMonthKeys)[0]
        : `${currentYear}-${String(1).padStart(2, '0')}`;

      const startKey =
        compareMonthKeys(startKeyCandidate, `${currentYear}-01`) < 0
          ? `${currentYear}-01`
          : startKeyCandidate;

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

      return {
        customerName: entry.customerName,
        missingMonths,
        postedMonths,
        reconciledMonths,
        duplicateMonths,
        totalDiscounts: invoices.length,
        lastDiscountLabel: latestMonth ? formatMonthLabel(latestMonth) : '—',
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

  const exportMissingToCSV = () => {
    try {
      setIsExporting(true);
      const headers = ['Customer', 'Missing Months'];
      const rows = filteredSummaries.map((item) => {
        const missing = item.missingMonths.map((m) => m.label).join(' | ');
        return [item.customerName, missing || ''];
      });
      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell) => `"${(cell ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `missing_discounts_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

  const handleReconcile = async (month: MonthItem) => {
    if (!selectedSummary) return;
    setReconcilingKey(month.key);
    try {
      const res = await fetch('/api/discounts/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: selectedSummary.customerName, monthKey: month.key }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to mark reconciliation');
      }

      const updatedKeys: string[] = data.reconciliationMonths || [];

      setEntries((prev) =>
        prev.map((entry) =>
          entry.customerName === selectedSummary.customerName
            ? { ...entry, reconciliationMonths: updatedKeys }
            : entry,
        ),
      );

      setSelectedSummary((prev) => {
        if (!prev) return prev;
        const newMissing = prev.missingMonths.filter((m) => m.key !== month.key);
        const newReconciled = Array.from(
          new Set([...prev.reconciledMonths.map((m) => m.key), month.key]),
        )
          .sort(compareMonthKeys)
          .map((key) => ({ key, label: formatMonthLabel(key) }));
        return {
          ...prev,
          missingMonths: newMissing,
          reconciledMonths: newReconciled,
        };
      });
      setDetailTab('reconciled');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to mark reconciliation');
    } finally {
      setReconcilingKey(null);
    }
  };


  if (loading) {
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
          onClick={exportMissingToCSV}
          disabled={isExporting}
          className="inline-flex items-center gap-2 p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          title="Export missing months to CSV"
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
                <th className="px-5 py-3 text-left font-semibold w-2/5">Customer Name</th>
                <th className="px-5 py-3 text-center font-semibold w-1/5">Missing</th>
                <th className="px-5 py-3 text-center font-semibold w-1/5">Posted (BIL)</th>
                <th className="px-5 py-3 text-center font-semibold w-1/5">Reconciled</th>
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
                              setDetailTab('missing');
                            }}
                            className="text-left text-blue-700 hover:text-blue-900 font-semibold"
                          >
                            {summary.customerName}
                          </button>
                          <div className="text-xs text-gray-500">
                            Missing {missingCount} · Posted {postedCount} · Reconciled {reconciledCount}
                          </div>
                        </div>
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
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No customers match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSummary && (
        <div className="fixed inset-0 bg-white/5 backdrop-blur-[2px] flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedSummary.customerName}</h3>
                <p className="text-sm text-gray-500">
                  Missing: {selectedSummary.missingMonths.length} • Posted: {selectedSummary.postedMonths.length} • Reconciled: {selectedSummary.reconciledMonths.length}
                </p>
              </div>
              <button
                onClick={() => setSelectedSummary(null)}
                className="text-gray-500 hover:text-gray-700 text-lg"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setDetailTab('missing')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                    detailTab === 'missing'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white text-red-700 border-red-200 hover:bg-red-50'
                  }`}
                >
                  Missing · {selectedSummary.missingMonths.length}
                </button>
                <button
                  onClick={() => setDetailTab('posted')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                    detailTab === 'posted'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  Posted · {selectedSummary.postedMonths.length}
                </button>
                <button
                  onClick={() => setDetailTab('reconciled')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                    detailTab === 'reconciled'
                      ? 'bg-green-600 text-white border-green-600 shadow-sm'
                      : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
                  }`}
                >
                  Reconciled · {selectedSummary.reconciledMonths.length}
                </button>
                <button
                  onClick={() => setDetailTab('posted-details')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                    detailTab === 'posted-details'
                      ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Posted Details
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 overflow-y-auto" style={{ maxHeight: '55vh' }}>
              {detailTab === 'missing' && (
                <div className="space-y-3">
                  {selectedSummary.missingMonths.length === 0 ? (
                    <div className="text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                      <span className="text-lg">✓</span>
                      كل الشهور مسجلة أو تم عمل Reconciliation لها.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedSummary.missingMonths.map((m) => (
                        <div
                          key={m.key}
                          className="flex items-center justify-between px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm font-semibold"
                        >
                          <span>{m.label}</span>
                          <button
                            onClick={() => handleReconcile(m)}
                            disabled={reconcilingKey === m.key}
                            className="text-xs font-semibold px-3 py-1 rounded-full border border-red-300 bg-white/80 text-red-700 hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {reconcilingKey === m.key ? 'Saving...' : 'Reconcile'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'reconciled' && (
                <div className="space-y-3">
                  {selectedSummary.reconciledMonths.length === 0 ? (
                    <div className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                      <span className="text-lg">ℹ</span>
                      لا توجد شهور Reconciled بعد.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedSummary.reconciledMonths.map((m) => (
                        <div
                          key={m.key}
                          className="flex items-center justify-between px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm font-semibold"
                        >
                          <span>{m.label}</span>
                          <span className="text-xs font-medium bg-white/70 text-green-700 px-2 py-1 rounded-full border border-green-200">
                            Reconciled
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'posted' && (
                <div className="space-y-3">
                  {selectedSummary.postedMonths.length === 0 ? (
                    <div className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                      <span className="text-lg">ℹ</span>
                      لا توجد خصومات BIL مسجلة.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedSummary.postedMonths.map((m) => {
                        const isDup = (m.count || 0) > 1;
                        return (
                          <button
                            key={m.key}
                            className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-semibold border ${
                              isDup
                                ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                            } hover:shadow-sm transition cursor-pointer`}
                            onClick={() => {
                              setSelectedPostedMonth(m);
                              setDetailTab('posted-details');
                            }}
                          >
                            <div className="flex flex-col">
                              <span>{m.label}</span>
                              {isDup && (
                                <span className="text-xs font-medium text-yellow-700">
                                  Duplicates: {m.count}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-medium bg-white/60 px-2 py-1 rounded-full border border-white/70 text-gray-700">
                              {m.count || 1} BIL
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'posted-details' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedSummary.postedMonths.map((m) => {
                      const isActive = selectedPostedMonth?.key === m.key;
                      return (
                        <button
                          key={m.key}
                          onClick={() => setSelectedPostedMonth(m)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                            isActive
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                          }`}
                        >
                          {m.label}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPostedMonth ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr className="text-left text-gray-600">
                            <th className="px-4 py-3">Number</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3 text-right">Debit</th>
                            <th className="px-4 py-3 text-right">Credit</th>
                            <th className="px-4 py-3">Matching</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {getPostedInvoices(selectedSummary.customerName, selectedPostedMonth.key).map((inv, idx) => (
                            <tr key={`${inv.number}-${idx}`} className="hover:bg-gray-50">
                              <td className="px-4 py-2 font-semibold text-gray-900">{inv.number}</td>
                              <td className="px-4 py-2 text-gray-700">{formatDisplayDate(inv.date)}</td>
                              <td className="px-4 py-2 text-right text-gray-800">{inv.debit?.toLocaleString('en-US')}</td>
                              <td className="px-4 py-2 text-right text-gray-800">{inv.credit?.toLocaleString('en-US')}</td>
                              <td className="px-4 py-2 text-gray-500">{inv.matching || '—'}</td>
                            </tr>
                          ))}
                          {getPostedInvoices(selectedSummary.customerName, selectedPostedMonth.key).length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                                لا توجد فواتير BIL لهذا الشهر.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
                      اختر شهر من القائمة بالأعلى لعرض الفواتير.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

