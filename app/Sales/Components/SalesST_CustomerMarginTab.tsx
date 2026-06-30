'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import SalesTabLoader from './SalesTabLoader';
import { exportSalesExcel } from '@/app/Sales/Export/SalesExcelExport';
import { generateCustomerMarginProducts } from '@/app/Sales/Pdf/CustomerMarginProducts';

interface SalesST_CustomerMarginProps {
  subCustomersData: any[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

function buildProductExportRows(products: any[]) {
  return products.map((p, index) => {
    const cost = p.cost || 0;
    const sellPrice = p.mostPrice || 0;
    const diff = sellPrice - cost;
    const marginPct = sellPrice > 0 ? (diff / sellPrice) * 100 : 0;
    return {
      '#': index + 1,
      Barcode: p.barcode || '-',
      Product: p.product || '-',
      Cost: Number(cost.toFixed(2)),
      'Sell Price': Number(sellPrice.toFixed(2)),
      Diff: Number(diff.toFixed(2)),
      'Diff %': `${marginPct.toFixed(1)}%`,
    };
  });
}

function toExportProducts(products: any[]) {
  return products.map((p) => ({
    barcode: p.barcode || '-',
    product: p.product || '-',
    cost: p.cost || 0,
    sellPrice: p.mostPrice || 0,
  }));
}

function computeCustomerMargin(customer: any) {
  const products = customer.products || [];
  if (products.length === 0) return null;

  const avgCost =
    products.reduce((sum: number, p: any) => sum + (p.cost || 0), 0) / products.length;
  const avgSell =
    products.reduce((sum: number, p: any) => sum + (p.mostPrice || 0), 0) / products.length;
  const diff = avgSell - avgCost;
  const marginPct = avgSell > 0 ? (diff / avgSell) * 100 : 0;

  return { avgCost, avgSell, diff, marginPct, productCount: products.length };
}

export default function SalesST_CustomerMarginTab({
  subCustomersData,
  loading,
}: SalesST_CustomerMarginProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const rows = useMemo(() => {
    return subCustomersData
      .map((c) => {
        const metrics = computeCustomerMargin(c);
        if (!metrics) return null;
        return {
          customer: c.customer,
          customerId: c.customerId,
          products: c.products || [],
          ...metrics,
        };
      })
      .filter(Boolean) as Array<{
        customer: string;
        customerId: string;
        products: any[];
        avgCost: number;
        avgSell: number;
        diff: number;
        marginPct: number;
        productCount: number;
      }>;
  }, [subCustomersData]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.customer.toLowerCase().includes(q) ||
          (r.customerId && r.customerId.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => a.customer.localeCompare(b.customer));
  }, [rows, debouncedSearch]);

  const totals = useMemo(() => {
    if (filteredRows.length === 0) {
      return { avgCost: 0, avgSell: 0, diff: 0, marginPct: 0 };
    }
    const sum = filteredRows.reduce(
      (acc, r) => {
        acc.avgCost += r.avgCost;
        acc.avgSell += r.avgSell;
        acc.diff += r.diff;
        return acc;
      },
      { avgCost: 0, avgSell: 0, diff: 0 }
    );
    const n = filteredRows.length;
    const avgCost = sum.avgCost / n;
    const avgSell = sum.avgSell / n;
    const diff = sum.diff / n;
    const marginPct = avgSell > 0 ? (diff / avgSell) * 100 : 0;
    return { avgCost, avgSell, diff, marginPct };
  }, [filteredRows]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleExport = async () => {
    if (filteredRows.length === 0) return;
    const data = filteredRows.map((r, i) => ({
      '#': i + 1,
      'Sub Customer': r.customer,
      'Avg Cost': Number(r.avgCost.toFixed(2)),
      'Avg Sell Price': Number(r.avgSell.toFixed(2)),
      Diff: Number(r.diff.toFixed(2)),
      'Margin %': `${r.marginPct.toFixed(1)}%`,
      Products: r.productCount,
    }));
    await exportSalesExcel(data, `Customer_Margin_${new Date().toISOString().split('T')[0]}`, {
      sheetName: 'Customer Margin',
      numericColumns: ['Avg Cost', 'Avg Sell Price', 'Diff'],
      highlightNegativeInColumns: ['Diff'],
    });
  };

  const rowKey = (row: { customerId: string; customer: string }) =>
    `${row.customerId}::${row.customer}`;

  const handleExportCustomerExcel = async (row: { customer: string; products: any[] }) => {
    if (!row.products.length) return;
    const exportData = buildProductExportRows(row.products);
    await exportSalesExcel(
      exportData,
      `Margin_Products_${row.customer.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}`,
      {
        sheetName: 'Products',
        numericColumns: ['Cost', 'Sell Price', 'Diff'],
        highlightNegativeInColumns: ['Diff'],
      }
    );
  };

  const handleExportCustomerReport = async (row: {
    customer: string;
    customerId: string;
    products: any[];
  }) => {
    if (!row.products.length) return;
    const key = rowKey(row);
    setExportingKey(key);
    try {
      await generateCustomerMarginProducts(row.customer, toExportProducts(row.products));
    } catch (err) {
      console.error(err);
    } finally {
      setExportingKey(null);
    }
  };

  if (loading) return <SalesTabLoader />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-center items-center gap-3 w-full max-w-md mx-auto">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
          <input
            type="text"
            placeholder="Filter sub customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-none shadow-sm text-sm font-semibold text-center"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={filteredRows.length === 0}
          className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-30 shrink-0"
          title="Export to Excel"
        >
          <FileSpreadsheet className="h-5 w-5" />
        </button>
      </div>

      {filteredRows.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-center">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  <th className="py-4 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-12">
                    #
                  </th>
                  <th className="py-4 px-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Sub Customer
                  </th>
                  <th className="py-4 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-32">
                    Avg Cost
                  </th>
                  <th className="py-4 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-36">
                    Avg Sell
                  </th>
                  <th className="py-4 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-28">
                    Diff
                  </th>
                  <th className="py-4 px-4 text-center text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] w-28">
                    Margin %
                  </th>
                  <th className="py-4 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-24">
                    SKUs
                  </th>
                  <th className="py-4 px-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedRows.map((row, idx) => {
                  const isProfit = row.diff >= 0;
                  const key = rowKey(row);
                  const isExporting = exportingKey === key;
                  return (
                    <tr
                      key={`${row.customerId}-${row.customer}`}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="py-4 px-4 text-center text-sm font-medium text-slate-500">
                        {startIndex + idx + 1}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-sm font-bold text-slate-800">{row.customer}</span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm font-black text-slate-600">
                          {row.avgCost.toLocaleString('en-US', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm font-black text-slate-800">
                          {row.avgSell.toLocaleString('en-US', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`text-sm font-black ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}
                        >
                          {isProfit ? '+' : ''}
                          {row.diff.toLocaleString('en-US', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-block text-sm font-black px-3 py-1 rounded-xl ${
                            isProfit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-rose-50 text-rose-700 border border-rose-100'
                          }`}
                        >
                          {row.marginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center text-sm font-bold text-slate-500">
                        {row.productCount}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleExportCustomerExcel(row)}
                            disabled={row.productCount === 0 || isExporting}
                            className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-30"
                            title="Download products Excel"
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportCustomerReport(row)}
                            disabled={row.productCount === 0 || isExporting}
                            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-30"
                            title="Download products report"
                          >
                            {isExporting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t border-slate-100">
                <tr>
                  <td
                    colSpan={2}
                    className="py-4 px-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest"
                  >
                    Averages ({filteredRows.length} sub customers)
                  </td>
                  <td className="py-4 px-4 text-center text-sm font-black text-slate-600">
                    {totals.avgCost.toFixed(1)}
                  </td>
                  <td className="py-4 px-4 text-center text-sm font-black text-slate-800">
                    {totals.avgSell.toFixed(1)}
                  </td>
                  <td className="py-4 px-4 text-center text-sm font-black text-emerald-600">
                    {totals.diff >= 0 ? '+' : ''}
                    {totals.diff.toFixed(1)}
                  </td>
                  <td className="py-4 px-4 text-center text-sm font-black text-emerald-700">
                    {totals.marginPct.toFixed(1)}%
                  </td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {filteredRows.length > ITEMS_PER_PAGE && (
            <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-center gap-4">
              <span className="text-sm text-slate-500 font-medium">
                {filteredRows.length} sub customers
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
