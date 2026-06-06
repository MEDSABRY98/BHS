'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Loader2, DollarSign, User, TrendingUp, FileSpreadsheet, BarChart2, X } from 'lucide-react';
import NoData from '../01-Unified/NoDataTab';
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
        const last = stats.lastPrice;
        const cost = stats.cost;
        const diff = most - cost;
        const margin = most > 0 ? (diff / most) * 100 : 0;

        exportData.push({
          'Barcode': p.barcode,
          'Product Name': p.product,
          'Customer Name': stats.customerName,
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
    <div className="flex items-start justify-center pt-24 min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

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
            const customerList = p.customers
              .filter((c: any) => !appliedCustomerQuery.trim() || c.customerName.toLowerCase().includes(appliedCustomerQuery.toLowerCase().trim()))
              .sort((a: any, b: any) => a.customerName.localeCompare(b.customerName));
            
            if (customerList.length === 0) return null;
            
            // Calculate column averages
            const columnTotals = customerList.reduce((acc: any, stats: any) => {
              acc.most += stats.mostPrice;
              acc.last += stats.lastPrice;
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
                      <th className="py-4 px-8 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-[450px]">Customer</th>
                      <th className="py-4 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-48">Most Price ({avgMost.toFixed(1)})</th>
                      <th className="py-4 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-48">Last Price ({avgLast.toFixed(1)})</th>
                      <th className="py-4 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-48">Cost ({avgCost.toFixed(1)})</th>
                      <th className="py-4 px-4 text-center text-[14px] font-black text-slate-500 uppercase tracking-[0.2em] w-64">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {customerList.map((stats: any, i: number) => {
                      const most = stats.mostPrice;
                      const last = stats.lastPrice;
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
                          <td className="py-4 px-4 text-center">
                            <span className="text-xl font-medium text-slate-900 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200/60">
                              {most.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-xl font-medium text-indigo-600 bg-indigo-50/50 px-4 py-1.5 rounded-xl border border-indigo-100/40">
                              {last.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="text-xl font-medium text-slate-500 bg-slate-50 px-4 py-1.5 rounded-xl border border-slate-200/60">
                              {cost.toLocaleString('en-US', { minimumFractionDigits: 1 })}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="inline-flex items-center justify-center gap-4">
                              <span className={`text-xl font-black ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'} bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm`}>
                                {margin.toFixed(1)}%
                              </span>
                              <span className={`text-sm font-bold ${diff >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
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
          <div className="bg-white rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
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
            
            <div className="p-8">
              <div className="h-[450px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={(() => {
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
                      return Object.entries(counts)
                        .map(([price, count]) => ({
                          price: parseFloat(price),
                          count,
                          percentage: (count / total) * 100
                        }))
                        .sort((a, b) => b.count - a.count);
                    })()}
                    margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="price" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Price Point</p>
                              <p className="text-xl font-black text-slate-900 mb-2">{data.price.toLocaleString()} AED</p>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <p className="text-sm font-bold text-slate-600">
                                  Frequency: <span className="text-indigo-600">{data.percentage.toFixed(1)}%</span>
                                </p>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold mt-1">({data.count} occurrences)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="percentage" 
                      radius={[8, 8, 0, 0]} 
                      barSize={40}
                    >
                      <LabelList 
                        dataKey="percentage" 
                        position="top" 
                        formatter={(val: any) => typeof val === 'number' ? `${val.toFixed(1)}%` : val}
                        style={{ fill: '#1e293b', fontSize: 14, fontWeight: 900 }}
                        offset={10}
                      />
                      <Cell fill="#4f46e5" fillOpacity={0.8} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
              <p className="text-xs font-bold text-slate-400">Analysis based on prices from {selectedProductData.customers.size} distinct customers</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

