'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Calendar,
  FileSpreadsheet,
  ListFilter,
  Loader2,
  Search,
  Users,
  X,
} from 'lucide-react';
import { getDebitData } from '@/app/Debit/Service/debit_service';
import { bhs_supabase, fetchAllData } from '@/lib/supabase';
import type { InvoiceRow } from '@/types';
import type { CustomerView } from '../page';
import { buildNetSalesByCustomerId } from './DiscountValuesNetSales';
import {
  classifyCustomerMonth,
  getCustomerMonthStats,
} from '../Utils/settlementUtils';
import { exportDiscountValuesExcel } from './ExportExcel';
import { toast } from '@/app/Components/Notification';

interface DiscountValuesProps {
  customers: CustomerView[];
}

type CustomerScope = 'all' | 'unsettled';

type SettlementLite = {
  customerId: string;
  month: number;
  year: number;
  status: string;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return {
    from: `${y}-${pad2(m)}-01`,
    to: `${y}-${pad2(m)}-${pad2(d)}`,
  };
}

function formatAed(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseYearMonth(dateStr: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || month < 1 || month > 12) return null;
  return { year, month };
}

type ValueRow = {
  customerId: string;
  customerName: string;
  city: string;
  discountPercent: number;
  netSales: number;
  discountValue: number;
  rent: number;
};

export default function DiscountValues({ customers }: DiscountValuesProps) {
  const defaults = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [debitRows, setDebitRows] = useState<InvoiceRow[]>([]);
  const [settlements, setSettlements] = useState<SettlementLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerScope, setCustomerScope] = useState<CustomerScope>('all');
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const [debitResult, settlementsData] = await Promise.all([
          getDebitData(),
          fetchAllData(() =>
            bhs_supabase
              .from('web_CUSTOMERS_DISCOUNTS_SETTLEMENTS')
              .select('CUSTOMER_ID, MONTH, YEAR, STATUS'),
          ),
        ]);
        if (cancelled) return;
        setDebitRows(debitResult.data || []);
        setSettlements(
          (settlementsData || []).map((d: any) => ({
            customerId: String(d.CUSTOMER_ID || '').trim(),
            month: Number(d.MONTH),
            year: Number(d.YEAR),
            status: d.STATUS || 'Pending',
          })),
        );
      } catch (err) {
        console.error('Failed to load Values tab data:', err);
        if (!cancelled) {
          setDebitRows([]);
          setSettlements([]);
          setError('Failed to load Debit invoices or settlements.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterMonth = useMemo(() => parseYearMonth(dateFrom), [dateFrom]);

  const unsettledCustomerIds = useMemo(() => {
    const ids = new Set<string>();
    if (!filterMonth) return ids;

    const byCustomer = new Map<string, SettlementLite[]>();
    settlements.forEach((s) => {
      if (s.year !== filterMonth.year || s.month !== filterMonth.month) return;
      if (!s.customerId) return;
      const list = byCustomer.get(s.customerId) || [];
      list.push(s);
      byCustomer.set(s.customerId, list);
    });

    byCustomer.forEach((rows, customerId) => {
      const bucket = classifyCustomerMonth(getCustomerMonthStats(rows));
      if (bucket === 'pending' || bucket === 'semi') {
        ids.add(customerId);
      }
    });

    return ids;
  }, [settlements, filterMonth]);

  const netSalesByCustomer = useMemo(
    () => buildNetSalesByCustomerId(debitRows, dateFrom, dateTo),
    [debitRows, dateFrom, dateTo],
  );

  const rows = useMemo<ValueRow[]>(() => {
    return customers
      .map((c) => {
        let discountPercent = 0;
        let rent = 0;
        c.discounts.forEach((d) => {
          const val = Number(d.value) || 0;
          if (d.type === 'percentage') discountPercent += val;
          else rent += val;
        });

        let netSales = netSalesByCustomer.get(String(c.customerId).trim()) || 0;
        if (netSales <= 0) {
          netSales = 0;
        }

        const discountValue = netSales * (discountPercent / 100);

        return {
          customerId: c.customerId,
          customerName: c.customerName,
          city: c.city || 'Unknown',
          discountPercent,
          netSales,
          discountValue,
          rent,
        };
      })
      .filter((row) => row.netSales > 0 || row.rent > 0)
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [customers, netSalesByCustomer]);

  const scopedRows = useMemo(() => {
    if (customerScope === 'all') return rows;
    return rows.filter((row) => unsettledCustomerIds.has(String(row.customerId).trim()));
  }, [rows, customerScope, unsettledCustomerIds]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scopedRows;
    return scopedRows.filter(
      (row) =>
        row.customerName.toLowerCase().includes(q) ||
        row.customerId.toLowerCase().includes(q) ||
        row.city.toLowerCase().includes(q),
    );
  }, [scopedRows, searchQuery]);

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.netSales += row.netSales;
          acc.discountValue += row.discountValue;
          acc.rent += row.rent;
          return acc;
        },
        { netSales: 0, discountValue: 0, rent: 0 },
      ),
    [filteredRows],
  );

  const filterMonthLabel = filterMonth
    ? `${MONTH_NAMES[filterMonth.month - 1]} ${filterMonth.year}`
    : '';

  const handleExportExcel = async () => {
    if (filteredRows.length === 0 || exporting) return;
    try {
      setExporting(true);
      await exportDiscountValuesExcel(filteredRows, dateFrom, dateTo);
      toast.success('Excel downloaded successfully');
    } catch (err) {
      console.error('Failed to export Values Excel:', err);
      toast.error('Failed to export Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 animate-in fade-in duration-300">
      <div className="max-w-[1450px] mx-auto space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#D4AF37]/10 p-3 rounded-2xl">
              <Calculator className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Values</h2>
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting || loading || filteredRows.length === 0}
              className="inline-flex items-center justify-center w-10 h-10 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl transition-all disabled:opacity-50 shadow-sm shrink-0"
              title="Export table to Excel"
              aria-label="Export table to Excel"
            >
              {exporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-gray-400" />
              From
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
              />
            </label>
            <span className="text-gray-300 font-light">—</span>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
              To
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-700 font-semibold text-sm rounded-2xl px-5 py-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
            <p className="text-sm font-bold uppercase tracking-wider">Loading Debit invoices…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
            <Users className="mx-auto h-14 w-14 text-gray-300 mb-4" />
            <h3 className="text-xl font-bold text-gray-900">No Customers Found</h3>
            <p className="text-gray-500 mt-2">Add discount or rent configs to see calculated values.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="flex items-center gap-2 w-full max-w-md">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by name, ID, or city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all font-medium text-gray-900 placeholder-gray-400 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setScopeMenuOpen(true)}
                  className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl border shadow-sm transition-all shrink-0 ${
                    customerScope === 'unsettled'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  title="Customer filter"
                  aria-label="Customer filter"
                >
                  <ListFilter className="w-5 h-5" />
                </button>
              </div>
            </div>

            {scopeMenuOpen && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setScopeMenuOpen(false)}
              >
                <div
                  className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200"
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="values-scope-title"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3
                        id="values-scope-title"
                        className="text-2xl font-bold text-gray-900"
                      >
                        Show customers
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScopeMenuOpen(false)}
                      className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                      aria-label="Close"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-6 space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerScope('all');
                        setScopeMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                        customerScope === 'all'
                          ? 'border-gray-900 bg-gray-900 text-white shadow-lg'
                          : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <span className="block font-bold text-base">All customers</span>
                      <span
                        className={`block text-sm mt-1 ${
                          customerScope === 'all' ? 'text-gray-300' : 'text-gray-500'
                        }`}
                      >
                        Show every customer with discount or rent config
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCustomerScope('unsettled');
                        setScopeMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-4 rounded-2xl border transition-all ${
                        customerScope === 'unsettled'
                          ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-lg shadow-amber-100'
                          : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-300'
                      }`}
                    >
                      <span className="block font-bold text-base">Unsettled only</span>
                      <span
                        className={`block text-sm mt-1 ${
                          customerScope === 'unsettled'
                            ? 'text-amber-700/80'
                            : 'text-gray-500'
                        }`}
                      >
                        Pending discount collection
                        {filterMonthLabel ? ` · ${filterMonthLabel}` : ''}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {filteredRows.length === 0 ? (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-16 text-center">
                <Search className="mx-auto h-14 w-14 text-gray-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-900">No Matches</h3>
                <p className="text-gray-500 mt-2">
                  {customerScope === 'unsettled'
                    ? `No unsettled customers for ${filterMonthLabel || 'this month'}.`
                    : 'Try a different search query.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-center table-fixed min-w-[1000px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-black uppercase tracking-wider text-gray-400 whitespace-nowrap">
                        <th className="px-5 py-4 w-[25%]">Customer</th>
                        <th className="px-5 py-4 w-[12%]">City</th>
                        <th className="px-5 py-4 w-[10%]">Discount %</th>
                        <th className="px-5 py-4 w-[13%]">Net Sales</th>
                        <th className="px-5 py-4 w-[14%]">Discount Value</th>
                        <th className="px-5 py-4 w-[8%] text-[#D4AF37]">D %</th>
                        <th className="px-5 py-4 w-[10%]">Rent</th>
                        <th className="px-5 py-4 w-[8%] text-purple-400">R %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr
                          key={row.customerId}
                          className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors"
                        >
                          <td className="px-5 py-4">
                            <p className="font-bold text-gray-900">{row.customerName}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 whitespace-nowrap">
                              {row.city}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-bold text-emerald-700">
                            {row.discountPercent.toLocaleString('en-US', {
                              maximumFractionDigits: 2,
                            })}
                            %
                          </td>
                          <td className="px-5 py-4 font-semibold text-gray-700">
                            {formatAed(row.netSales)}
                          </td>
                          <td className="px-5 py-4 font-black text-[#D4AF37]">
                            {formatAed(row.discountValue)}
                          </td>
                          <td className="px-5 py-4 font-bold text-gray-500">
                            {totals.discountValue > 0 ? ((row.discountValue / totals.discountValue) * 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}%
                          </td>
                          <td className="px-5 py-4 font-bold text-purple-700">
                            {formatAed(row.rent)}
                          </td>
                          <td className="px-5 py-4 font-bold text-gray-500">
                            {totals.rent > 0 ? ((row.rent / totals.rent) * 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0'}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white">
                        <td className="px-5 py-4 font-black uppercase tracking-wider text-sm" colSpan={3}>
                          Totals ({filteredRows.length} customers)
                        </td>
                        <td className="px-5 py-4 font-bold">{formatAed(totals.netSales)}</td>
                        <td className="px-5 py-4 font-black text-[#D4AF37]">
                          {formatAed(totals.discountValue)}
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-300">
                          {totals.discountValue > 0 ? '100%' : '0%'}
                        </td>
                        <td className="px-5 py-4 font-bold text-purple-300">
                          {formatAed(totals.rent)}
                        </td>
                        <td className="px-5 py-4 font-bold text-gray-300">
                          {totals.rent > 0 ? '100%' : '0%'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
