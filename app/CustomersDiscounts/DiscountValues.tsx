'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Calendar, FileSpreadsheet, Loader2, Users } from 'lucide-react';
import { getDebitData } from '@/app/Debit/Service/debit_service';
import type { InvoiceRow } from '@/types';
import type { CustomerView } from './page';
import { buildNetSalesByCustomerId } from './Utils/DiscountValuesNetSales';
import { exportDiscountValuesExcel } from './ExportExcel';
import { toast } from '@/app/Components/Notification';

interface DiscountValuesProps {
  customers: CustomerView[];
}

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

type ValueRow = {
  customerId: string;
  customerName: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const result = await getDebitData();
        if (cancelled) return;
        setDebitRows(result.data || []);
      } catch (err) {
        console.error('Failed to load debit data for Values tab:', err);
        if (!cancelled) {
          setDebitRows([]);
          setError('Failed to load Debit invoices.');
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

        const netSales = netSalesByCustomer.get(String(c.customerId).trim()) || 0;
        const discountValue = netSales * (discountPercent / 100);

        return {
          customerId: c.customerId,
          customerName: c.customerName,
          discountPercent,
          netSales,
          discountValue,
          rent,
        };
      })
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [customers, netSalesByCustomer]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.netSales += row.netSales;
          acc.discountValue += row.discountValue;
          acc.rent += row.rent;
          return acc;
        },
        { netSales: 0, discountValue: 0, rent: 0 },
      ),
    [rows],
  );

  const handleExportExcel = async () => {
    if (rows.length === 0 || exporting) return;
    try {
      setExporting(true);
      await exportDiscountValuesExcel(rows, dateFrom, dateTo);
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
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#D4AF37]/10 p-3 rounded-2xl">
              <Calculator className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Values</h2>
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={exporting || loading || rows.length === 0}
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
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-center">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-black uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Discount %</th>
                    <th className="px-5 py-4">Net Sales</th>
                    <th className="px-5 py-4">Discount Value</th>
                    <th className="px-5 py-4">Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.customerId}
                      className="border-b border-gray-50 hover:bg-amber-50/30 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-gray-900">{row.customerName}</p>
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
                      <td className="px-5 py-4 font-bold text-purple-700">
                        {formatAed(row.rent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white">
                    <td className="px-5 py-4 font-black uppercase tracking-wider text-sm" colSpan={2}>
                      Totals ({rows.length} customers)
                    </td>
                    <td className="px-5 py-4 font-bold">{formatAed(totals.netSales)}</td>
                    <td className="px-5 py-4 font-black text-[#D4AF37]">
                      {formatAed(totals.discountValue)}
                    </td>
                    <td className="px-5 py-4 font-bold text-purple-300">
                      {formatAed(totals.rent)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
