import React, { useState, useMemo } from 'react';
import { PurchaseRecord, Product, Supplier } from './page';
import { Search, Package, Users, TrendingDown, TrendingUp, ArrowLeft, Award, AlertTriangle } from 'lucide-react';

interface Props {
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
}

export default function SupplierComparison({ purchases, products, suppliers }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [supplierFilterTab, setSupplierFilterTab] = useState<'multi' | 'single'>('multi');

  const getSupplierName = (id: string) => {
    return suppliers.find(s => s.id === id)?.name || id;
  };

  const productSupplierCounts = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    purchases.forEach(p => {
      if (!counts.has(p.productId)) counts.set(p.productId, new Set());
      counts.get(p.productId)!.add(p.supplierId);
    });
    return new Map(Array.from(counts.entries()).map(([productId, supplierSet]) => [productId, supplierSet.size]));
  }, [purchases]);

  const filteredProducts = useMemo(() => {
    const productsWithHistory = new Set(purchases.map(p => p.productId));
    const lower = searchTerm.toLowerCase();
    
    return products
      .filter(p => productsWithHistory.has(p.id))
      .filter(p => {
        const supplierCount = productSupplierCounts.get(p.id) || 0;
        return supplierFilterTab === 'multi' ? supplierCount >= 2 : supplierCount === 1;
      })
      .filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.id.toLowerCase().includes(lower) ||
        (p.barcode && p.barcode.toLowerCase().includes(lower))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchTerm, products, purchases, productSupplierCounts, supplierFilterTab]);

  const tabCounts = useMemo(() => {
    const productsWithHistory = new Set(purchases.map(p => p.productId));
    let multi = 0;
    let single = 0;
    products.forEach(p => {
      if (!productsWithHistory.has(p.id)) return;
      const count = productSupplierCounts.get(p.id) || 0;
      if (count >= 2) multi += 1;
      else if (count === 1) single += 1;
    });
    return { multi, single };
  }, [products, purchases, productSupplierCounts]);

  const productPurchases = useMemo(() => {
    if (!selectedProductId) return [];
    return purchases.filter(p => p.productId === selectedProductId);
  }, [selectedProductId, purchases]);

  const supplierStats = useMemo(() => {
    if (productPurchases.length === 0) return [];

    const stats = new Map<string, {
      minPrice: number;
      maxPrice: number;
      sumPrice: number;
      count: number;
      totalQty: number;
      latestPrice: number;
      latestDate: string;
      oldestPrice: number;
      oldestDate: string;
    }>();

    productPurchases.forEach(p => {
      const existing = stats.get(p.supplierId);
      if (!existing) {
        stats.set(p.supplierId, {
          minPrice: p.unitPrice,
          maxPrice: p.unitPrice,
          sumPrice: p.unitPrice,
          count: 1,
          totalQty: p.qty,
          latestPrice: p.unitPrice,
          latestDate: p.date,
          oldestPrice: p.unitPrice,
          oldestDate: p.date
        });
      } else {
        existing.minPrice = Math.min(existing.minPrice, p.unitPrice);
        existing.maxPrice = Math.max(existing.maxPrice, p.unitPrice);
        existing.sumPrice += p.unitPrice;
        existing.count += 1;
        existing.totalQty += p.qty;

        if (new Date(p.date) > new Date(existing.latestDate)) {
          existing.latestPrice = p.unitPrice;
          existing.latestDate = p.date;
        }
        if (new Date(p.date) < new Date(existing.oldestDate)) {
          existing.oldestPrice = p.unitPrice;
          existing.oldestDate = p.date;
        }
      }
    });

    return Array.from(stats.entries()).map(([supplierId, data]) => ({
      supplierId,
      supplierName: getSupplierName(supplierId),
      minPrice: data.minPrice,
      maxPrice: data.maxPrice,
      avgPrice: data.sumPrice / data.count,
      latestPrice: data.latestPrice,
      latestDate: data.latestDate,
      oldestPrice: data.oldestPrice,
      oldestDate: data.oldestDate,
      purchaseCount: data.count,
      totalQty: data.totalQty
    }));
  }, [productPurchases, suppliers]);

  const rankedSupplierStats = useMemo(() => {
    if (supplierStats.length === 0) return [];
    const bestLatest = Math.min(...supplierStats.map(s => s.latestPrice));

    return [...supplierStats]
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName))
      .map((stat, index) => ({
        ...stat,
        rank: index + 1,
        isBest: stat.latestPrice === bestLatest
      }));
  }, [supplierStats]);

  const comparisonSummary = useMemo(() => {
    if (supplierStats.length === 0) return null;

    const byPrice = [...supplierStats].sort((a, b) => a.latestPrice - b.latestPrice);
    const best = byPrice[0];
    const worst = byPrice[byPrice.length - 1];
    const priceSpread = worst.latestPrice - best.latestPrice;

    return {
      bestSupplierName: best.supplierName,
      bestLatestPrice: best.latestPrice,
      worstSupplierName: worst.supplierName,
      worstLatestPrice: worst.latestPrice,
      priceSpread,
      spreadPct: best.latestPrice > 0 ? (priceSpread / best.latestPrice) * 100 : 0,
      supplierCount: supplierStats.length,
      totalPurchases: supplierStats.reduce((sum, s) => sum + s.purchaseCount, 0)
    };
  }, [supplierStats]);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // If no product is selected, show Grid View
  if (!selectedProductId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Supplier Comparison</h2>
            <p className="text-slate-500 font-medium mt-1">Select a product to compare prices across different suppliers.</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSupplierFilterTab('multi')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              supplierFilterTab === 'multi'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-[#D4AF37] hover:text-slate-700'
            }`}
          >
            2+ Suppliers ({tabCounts.multi})
          </button>
          <button
            onClick={() => setSupplierFilterTab('single')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              supplierFilterTab === 'single'
                ? 'bg-[#D4AF37] text-black shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:border-[#D4AF37] hover:text-slate-700'
            }`}
          >
            1 Supplier ({tabCounts.single})
          </button>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white/50 border border-slate-200 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center text-slate-400">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold text-lg">
              {searchTerm
                ? 'No products found matching your search.'
                : supplierFilterTab === 'multi'
                  ? 'No products found with 2 or more suppliers.'
                  : 'No products found with a single supplier.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
            {filteredProducts.map(product => (
              <button
                key={product.id}
                onClick={() => setSelectedProductId(product.id)}
                className="bg-white text-left p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 border-t-4 border-t-[#D4AF37] flex flex-col justify-between h-[160px] group"
              >
                <div>
                  <p className="text-xs font-mono font-bold text-[#D4AF37] mb-2 bg-amber-50 inline-block px-2 py-1 rounded-md">
                    {product.barcode || product.id}
                  </p>
                  <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-[#D4AF37] transition-colors text-lg">
                    {product.name}
                  </h3>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">
                    <Users className="w-4 h-4" />
                    <span>Compare Suppliers</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] bg-amber-50 px-2 py-1 rounded-md">
                    {productSupplierCounts.get(product.id) || 0} suppliers
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detail View
  return (
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => setSelectedProductId(null)}
            className="p-3 bg-white border border-slate-200 hover:border-[#D4AF37] hover:text-[#D4AF37] text-slate-500 rounded-2xl transition-all shadow-sm shrink-0"
            title="Back to products"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono font-bold bg-[#D4AF37] text-black px-2 py-1 rounded-md">
                {selectedProduct?.barcode || selectedProduct?.id}
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{selectedProduct?.name}</h2>
            </div>
            <p className="text-slate-500 font-medium">Compare supplier performance and pricing</p>
          </div>
        </div>
      </div>

      {rankedSupplierStats.length === 0 ? (
        <div className="bg-white/50 border border-slate-200 border-dashed rounded-[2rem] p-16 flex flex-col items-center justify-center text-slate-400">
          <Users className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-bold text-lg">No suppliers found for this product.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comparisonSummary && comparisonSummary.supplierCount >= 2 && comparisonSummary.priceSpread > 0 && (
            <div className="bg-gradient-to-r from-emerald-50 to-amber-50 border border-emerald-100 rounded-[2rem] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-2xl text-emerald-600 shadow-sm shrink-0">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Recommended Supplier</p>
                  <h3 className="text-xl font-black text-slate-900">{comparisonSummary.bestSupplierName}</h3>
                  <p className="text-sm font-medium text-slate-600 mt-1">
                    Latest price <span className="font-black text-emerald-700">{comparisonSummary.bestLatestPrice.toFixed(2)} AED</span>
                    {' '}— saves{' '}
                    <span className="font-black text-emerald-700">
                      {comparisonSummary.priceSpread.toFixed(2)} AED ({comparisonSummary.spreadPct.toFixed(1)}%)
                    </span>
                    {' '}vs {comparisonSummary.worstSupplierName}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-white/80 border border-amber-100 px-4 py-3 rounded-xl shrink-0">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Compare using latest purchase price per supplier</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-emerald-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Best Latest Price</p>
              <p className="text-3xl font-black text-emerald-600">{comparisonSummary?.bestLatestPrice.toFixed(2)}</p>
              <p className="text-xs font-bold text-slate-400 mt-1 truncate">{comparisonSummary?.bestSupplierName}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-red-400">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Highest Latest Price</p>
              <p className="text-3xl font-black text-red-500">{comparisonSummary?.worstLatestPrice.toFixed(2)}</p>
              <p className="text-xs font-bold text-slate-400 mt-1 truncate">{comparisonSummary?.worstSupplierName}</p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-[#D4AF37]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Price Spread</p>
              <p className="text-3xl font-black text-slate-900">{comparisonSummary?.priceSpread.toFixed(2)}</p>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {comparisonSummary && comparisonSummary.spreadPct > 0
                  ? `${comparisonSummary.spreadPct.toFixed(1)}% difference`
                  : 'No difference'}
              </p>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-slate-400">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Suppliers / Purchases</p>
              <p className="text-3xl font-black text-slate-900">
                {comparisonSummary?.supplierCount}
                <span className="text-lg text-slate-400 font-bold"> / {comparisonSummary?.totalPurchases}</span>
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1">suppliers / invoice lines</p>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Side-by-Side Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-5 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">#</th>
                    <th className="px-5 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Supplier</th>
                    <th className="px-5 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Latest Price</th>
                    <th className="px-5 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Oldest Price</th>
                    <th className="px-5 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Purchases</th>
                    <th className="px-5 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Last Purchase</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankedSupplierStats.map(stat => {
                    const priceTrend = stat.latestPrice > stat.oldestPrice
                      ? 'up'
                      : stat.latestPrice < stat.oldestPrice
                        ? 'down'
                        : 'flat';

                    return (
                      <tr
                        key={stat.supplierId}
                        className={`transition-colors ${stat.isBest ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-5 py-4 text-center">
                          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black ${
                            stat.isBest ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {stat.rank}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <span className="font-bold text-slate-800">{stat.supplierName}</span>
                            {stat.isBest && (
                              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
                                Best
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className={`font-black text-lg ${stat.isBest ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {stat.latestPrice.toFixed(2)}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">AED</span>
                          {priceTrend !== 'flat' && (
                            <div className={`flex items-center justify-center gap-1 mt-1 text-xs font-bold ${
                              priceTrend === 'up' ? 'text-red-500' : 'text-emerald-600'
                            }`}>
                              {priceTrend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              <span>{priceTrend === 'up' ? 'Rising' : 'Falling'}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-slate-600">{stat.oldestPrice.toFixed(2)}</td>
                        <td className="px-5 py-4 text-center">
                          <span className="font-bold text-slate-700">{stat.purchaseCount}</span>
                          <span className="text-xs text-slate-400 block">({stat.totalQty} qty)</span>
                        </td>
                        <td className="px-5 py-4 text-center font-bold text-slate-600 whitespace-nowrap">{stat.latestDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
