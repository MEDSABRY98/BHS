'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Search, Loader2, DollarSign, User, TrendingUp, FileSpreadsheet, BarChart2, X } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import Loading from '@/app/Components/Loading';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface SalesST_ByProductProps {
  refreshTrigger?: number;
  productList: any[];
  loading: boolean;
}

export default function SalesST_ByProduct({ productList, loading, refreshTrigger }: SalesST_ByProductProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [appliedCustomerQuery, setAppliedCustomerQuery] = useState('');
  const [selectedProductData, setSelectedProductData] = useState<any>(null);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setAppliedSearchQuery(searchQuery);
      setAppliedCustomerQuery(customerSearchQuery);
    }
  };

  const filteredProducts = useMemo(() => {
    let list = productList || [];

    if (appliedSearchQuery.trim()) {
      const query = appliedSearchQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.product.toLowerCase().includes(query) ||
        p.barcode.toLowerCase().includes(query) ||
        (p.allNames && p.allNames.some((name: string) => name.includes(query))) ||
        (p.allBarcodes && p.allBarcodes.some((bc: string) => bc.includes(query))) ||
        p.productId.toLowerCase().includes(query)
      );
    }

    if (appliedCustomerQuery.trim()) {
      const query = appliedCustomerQuery.toLowerCase().trim();
      list = list.filter(p =>
        p.customers.some((c: any) => c.customerName.toLowerCase().includes(query))
      );
    }

    return (appliedSearchQuery.trim() || appliedCustomerQuery.trim()) ? list : [];
  }, [productList, appliedSearchQuery, appliedCustomerQuery]);

  const handleExportExcel = () => {
    if (filteredProducts.length === 0) return;
    const exportData: any[] = [];
    filteredProducts.forEach(p => {
      p.customers.forEach((stats: any) => {
        const most = stats.mostPrice;
        const maxPrice = (stats.pricesDistribution && Array.isArray(stats.pricesDistribution) && stats.pricesDistribution.length > 0)
          ? Math.max(...stats.pricesDistribution)
          : stats.mostPrice;
        const cost = stats.cost;
        const diff = most - cost;
        const margin = most > 0 ? (diff / most) * 100 : 0;

        exportData.push({
          'Barcode': p.barcode,
          'Product Name': p.product,
          'Customer Name': stats.customerName,
          'Most Price': most,
          'Max Price': maxPrice,
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

  if (loading) return <Loading fullScreen={false} />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col items-center justify-center pt-2">
        <div className="flex items-center gap-3 w-full max-w-4xl">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by Product Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 outline-none transition-all shadow-sm text-sm font-semibold placeholder:text-slate-400"
            />
          </div>
          <div className="relative flex-1 group">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by Customer Name..."
              value={customerSearchQuery}
              onChange={e => setCustomerSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-none transition-all shadow-sm text-sm font-semibold placeholder:text-slate-400"
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
          <NoData title="ENTER SEARCH TO BEGIN" />
        ) : filteredProducts.length === 0 ? (
          <NoData />
        ) : (
          filteredProducts.map((p, idx) => {
            const customerList = p.customers
              .filter((c: any) => !appliedCustomerQuery.trim() || c.customerName.toLowerCase().includes(appliedCustomerQuery.toLowerCase().trim()))
              .sort((a: any, b: any) => a.customerName.localeCompare(b.customerName));

            if (customerList.length === 0) return null;

            // Calculate column averages
            const columnTotals = customerList.reduce((acc: any, stats: any) => {
              const maxPrice = (stats.pricesDistribution && Array.isArray(stats.pricesDistribution) && stats.pricesDistribution.length > 0)
                ? Math.max(...stats.pricesDistribution)
                : stats.mostPrice;

              acc.most += stats.mostPrice;
              acc.max += maxPrice;
              acc.cost += stats.cost;
              return acc;
            }, { most: 0, max: 0, cost: 0 });

            const avgMost = customerList.length > 0 ? columnTotals.most / customerList.length : 0;
            const avgMax = customerList.length > 0 ? columnTotals.max / customerList.length : 0;
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
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-black text-slate-900 leading-none">{p.product}</h3>
                        <button
                          onClick={() => setSelectedProductData(p)}
                          className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm shrink-0"
                          title="View Price Distribution"
                        >
                          <BarChart2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded-md border border-slate-100">{p.barcode}</span>
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-md">{p.customers.length} Customers</span>
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
                        <th className="py-4 px-8 text-center text-[13px] font-black text-slate-500 uppercase tracking-[0.2em] w-[550px]">Customer</th>
                        <th className="py-4 px-2 text-center text-[13px] font-black text-slate-500 uppercase tracking-[0.2em] w-36">Most Price ({avgMost.toFixed(1)})</th>
                        <th className="py-4 px-2 text-center text-[13px] font-black text-amber-500 uppercase tracking-[0.2em] w-36">Max Price ({avgMax.toFixed(1)})</th>
                        <th className="py-4 px-2 text-center text-[13px] font-black text-slate-500 uppercase tracking-[0.2em] w-36">Cost ({avgCost.toFixed(1)})</th>
                        <th className="py-4 px-2 text-center text-[13px] font-black text-slate-500 uppercase tracking-[0.2em] w-48">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {customerList.map((stats: any, i: number) => {
                        const most = stats.mostPrice;
                        const maxPrice = (stats.pricesDistribution && Array.isArray(stats.pricesDistribution) && stats.pricesDistribution.length > 0)
                          ? Math.max(...stats.pricesDistribution)
                          : stats.mostPrice;
                        const cost = stats.cost;
                        const diff = most - cost;
                        const margin = most > 0 ? (diff / most) * 100 : 0;

                        return (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-8">
                              <div className="flex items-center justify-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                  <User className="w-4 h-4 text-slate-500" />
                                </div>
                                <span className="text-base font-semibold text-slate-800 text-center w-full truncate" title={stats.customerName}>{stats.customerName}</span>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-center">
                              <span className="text-lg font-black text-slate-900 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/60">
                                {most.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-center">
                              <span className="text-lg font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-xl border border-amber-200/60 shadow-sm">
                                {maxPrice.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-center">
                              <span className="text-lg font-black text-slate-500 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/60">
                                {cost.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                              </span>
                            </td>
                            <td className="py-4 px-2 text-center">
                              <div className="inline-flex items-center justify-center gap-3">
                                <span className={`text-lg font-black ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'} bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm`}>
                                  {margin.toFixed(1)}%
                                </span>
                                <span className={`text-xs font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  ({diff >= 0 ? '+' : ''}{diff.toFixed(1)})
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
      {/* Price Distribution Modal */}
      {selectedProductData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[32px] w-full max-w-[95vw] xl:max-w-6xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <BarChart2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Price Distribution</h3>
                  <p className="text-sm text-slate-400 font-bold">{selectedProductData.product}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProductData(null)}
                className="w-10 h-10 flex items-center justify-center bg-white text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all border border-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {(() => {
                const counts: Record<number, number> = {};
                let total = 0;
                selectedProductData.customers.forEach((stats: any) => {
                  if (stats.pricesDistribution && Array.isArray(stats.pricesDistribution)) {
                    stats.pricesDistribution.forEach((price: number) => {
                      const p = parseFloat(price.toFixed(1));
                      counts[p] = (counts[p] || 0) + 1;
                      total++;
                    });
                  }
                });
                const data = Object.entries(counts)
                  .map(([price, count]) => ({
                    price: parseFloat(price),
                    count,
                    percentage: (count / total) * 100
                  }))
                  .sort((a, b) => b.price - a.price);

                const maxCount = Math.max(...data.map(d => d.count), 0);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-2 pb-2">
                    {data.map((item, idx) => {
                      const isMostFrequent = item.count === maxCount;
                      return (
                        <div
                          key={idx}
                          className={`relative p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-2 border-2 transition-all hover:-translate-y-1 ${isMostFrequent
                            ? 'bg-gradient-to-br from-amber-50 via-amber-100/30 to-amber-50 border-amber-400 shadow-md shadow-amber-200/40 z-10'
                            : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-slate-200/50'
                            }`}
                        >
                          {isMostFrequent && (
                            <div className="absolute -top-3 bg-amber-400 text-white text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full shadow-sm">
                              Most Popular
                            </div>
                          )}
                          <div className={`text-2xl font-black tracking-tight ${isMostFrequent ? 'text-amber-700' : 'text-slate-800'}`}>
                            {item.price.toLocaleString('en-US', { minimumFractionDigits: 1 })} <span className="text-xs font-bold opacity-50">AED</span>
                          </div>

                          <div className={`w-full h-px my-0.5 ${isMostFrequent ? 'bg-amber-200/50' : 'bg-slate-100'}`} />

                          <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start text-left">
                              <span className={`text-[10px] font-black uppercase tracking-wider ${isMostFrequent ? 'text-amber-600/60' : 'text-slate-400'}`}>Ratio</span>
                              <span className={`text-sm font-black ${isMostFrequent ? 'text-amber-600' : 'text-indigo-600'
                                }`}>
                                {item.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex flex-col items-end text-right">
                              <span className={`text-[10px] font-black uppercase tracking-wider ${isMostFrequent ? 'text-amber-600/60' : 'text-slate-400'}`}>Orders</span>
                              <span className={`text-sm font-bold ${isMostFrequent ? 'text-amber-700' : 'text-slate-600'}`}>
                                {item.count}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
              <p className="text-xs font-bold text-slate-400">Analysis based on prices from {selectedProductData.customers.length} distinct customers</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

