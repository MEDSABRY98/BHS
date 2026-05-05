'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Loader2, DollarSign, User, TrendingUp, FileSpreadsheet } from 'lucide-react';
import NoData from '../01-Unified/NoDataTab';
import * as XLSX from 'xlsx';

interface SalesST_ByProductProps {
  data: SalesInvoice[];
  loading: boolean;
}

const calculateMode = (numbers: number[]): number => {
  if (!numbers || numbers.length === 0) return 0;
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = numbers[0];
  for (const n of numbers) {
    const val = parseFloat(n.toFixed(2));
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      mode = val;
    }
  }
  return mode;
};

export default function SalesST_ByProduct({ data, loading }: SalesST_ByProductProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setAppliedSearchQuery(searchQuery);
    }
  };

  const productList = useMemo(() => {
    if (!data || data.length === 0) return [];
    const map = new Map<string, {
      barcode: string;
      product: string;
      priceRange: { min: number, max: number };
      customers: Map<string, { prices: number[]; cost: number }>;
    }>();

    data.forEach(item => {
      const productKey = item.barcode || item.product || item.productId;
      if (!map.has(productKey)) {
        map.set(productKey, {
          barcode: item.barcode || '-',
          product: item.product || '-',
          priceRange: { min: Infinity, max: -Infinity },
          customers: new Map()
        });
      }
      const prod = map.get(productKey)!;
      const custName = item.customerMainName || item.customerName || 'Unknown';
      if (!prod.customers.has(custName)) {
        prod.customers.set(custName, { prices: [], cost: item.productCost || 0 });
      }
      const cust = prod.customers.get(custName)!;

      const itemAny = item as any;
      let price = itemAny.price || itemAny.unitPrice || 0;
      if (!price && itemAny.amount && itemAny.qty) price = itemAny.amount / itemAny.qty;
      const pNum = parseFloat(price);

      if (!isNaN(pNum) && pNum > 0) {
        cust.prices.push(pNum);
        prod.priceRange.min = Math.min(prod.priceRange.min, pNum);
        prod.priceRange.max = Math.max(prod.priceRange.max, pNum);
      }
      if (item.productCost > 0) cust.cost = item.productCost;
    });

    return Array.from(map.values()).sort((a, b) => a.product.localeCompare(b.product));
  }, [data]);

  const filteredProducts = useMemo(() => {
    if (!appliedSearchQuery.trim()) return [];
    const query = appliedSearchQuery.toLowerCase().trim();
    return productList.filter(p =>
      p.product.toLowerCase().includes(query) ||
      p.barcode.toLowerCase().includes(query)
    );
  }, [productList, appliedSearchQuery]);

  const handleExportExcel = () => {
    if (filteredProducts.length === 0) return;
    const exportData: any[] = [];
    filteredProducts.forEach(p => {
      Array.from(p.customers.entries()).forEach(([custName, stats]) => {
        const most = calculateMode(stats.prices);
        const last = stats.prices[stats.prices.length - 1] || 0;
        const cost = stats.cost;
        const diff = most - cost;
        const margin = most > 0 ? (diff / most) * 100 : 0;

        exportData.push({
          'Barcode': p.barcode,
          'Product Name': p.product,
          'Customer Name': custName,
          'Most Price': most,
          'Last Price': last,
          'Cost': cost,
          'Diff': diff,
          'Margin %': `${margin.toFixed(1)}%`
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analysis');
    XLSX.writeFile(wb, `Pricing_Analysis_By_Product_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[200px]">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col items-center justify-center pt-2">
        <div className="flex items-center gap-3 w-full max-w-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by Product Name or Barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-all shadow-sm text-sm font-semibold placeholder:text-slate-400"
            />
          </div>
          <button
            onClick={handleExportExcel}
            disabled={filteredProducts.length === 0}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group disabled:opacity-30 shrink-0"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {!appliedSearchQuery.trim() ? (
          <div className="bg-white rounded-[40px] p-20 border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Ready to Search</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">Enter a product name or scan a barcode to view customer pricing analysis</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl p-20 border border-slate-100 shadow-sm"><NoData /></div>
        ) : (
          filteredProducts.map((p, idx) => {
            const customerList = Array.from(p.customers.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            
            // Calculate column averages
            const columnTotals = customerList.reduce((acc, [_, stats]) => {
              acc.most += calculateMode(stats.prices);
              acc.last += stats.prices[stats.prices.length - 1] || 0;
              acc.cost += stats.cost;
              return acc;
            }, { most: 0, last: 0, cost: 0 });

            const avgMost = customerList.length > 0 ? columnTotals.most / customerList.length : 0;
            const avgLast = customerList.length > 0 ? columnTotals.last / customerList.length : 0;
            const avgCost = customerList.length > 0 ? columnTotals.cost / customerList.length : 0;

            return (
              <div key={idx} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-500">
              {/* Header */}
              <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-none mb-1">{p.product}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded-md border border-slate-100">{p.barcode}</span>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">{p.customers.size} Customers</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead>
                    <tr className="bg-white border-b border-slate-100">
                      <th className="py-6 px-8 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-64">Customer</th>
                      <th className="py-6 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-48">Most Price ({avgMost.toFixed(1)})</th>
                      <th className="py-6 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-48">Last Price ({avgLast.toFixed(1)})</th>
                      <th className="py-6 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-48">Cost ({avgCost.toFixed(1)})</th>
                      <th className="py-6 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-40">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {customerList.map(([custName, stats], i) => {
                      const most = calculateMode(stats.prices);
                      const last = stats.prices[stats.prices.length - 1] || 0;
                      const cost = stats.cost;
                      const diff = most - cost;
                      const margin = most > 0 ? (diff / most) * 100 : 0;

                      return (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-6 px-8">
                            <div className="flex items-center justify-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-slate-500" />
                              </div>
                              <span className="text-base font-semibold text-slate-800 text-center w-64 truncate" title={custName}>{custName}</span>
                            </div>
                          </td>
                          <td className="py-6 px-4 text-center">
                            <span className="text-xl font-medium text-slate-900 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60">
                              {most.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                          </td>
                          <td className="py-6 px-4 text-center">
                            <span className="text-xl font-medium text-indigo-600 bg-indigo-50/50 px-4 py-2 rounded-xl border border-indigo-100/40">
                              {last.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                          </td>
                          <td className="py-6 px-4 text-center">
                            <span className="text-xl font-medium text-slate-500 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200/60">
                              {cost.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                          </td>
                          <td className="py-6 px-4 text-center">
                            <div className="inline-flex flex-col items-center justify-center">
                              <span className={`text-xl font-medium ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {diff >= 0 ? '+' : ''}{diff.toFixed(1)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 tracking-widest mt-0.5">
                                {margin.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
