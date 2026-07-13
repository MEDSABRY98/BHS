import React, { useState, useMemo } from 'react';
import { PurchaseRecord, Product, Supplier } from './page';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, TrendingUp, TrendingDown, Minus, Calendar, Building2, Package, ArrowLeft } from 'lucide-react';

interface Props {
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
}

export default function ProductPriceHistory({ purchases, products, suppliers }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const getSupplierName = (id: string) => {
    return suppliers.find(s => s.id === id)?.name || id;
  };

  const filteredProducts = useMemo(() => {
    const productsWithHistory = new Set(purchases.map(p => p.productId));
    const lower = searchTerm.toLowerCase();
    
    return products
      .filter(p => productsWithHistory.has(p.id))
      .filter(p => 
        p.name.toLowerCase().includes(lower) || 
        p.id.toLowerCase().includes(lower) ||
        (p.barcode && p.barcode.toLowerCase().includes(lower))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchTerm, products, purchases]);

  const productPurchases = useMemo(() => {
    if (!selectedProductId) return [];
    return purchases
      .filter(p => p.productId === selectedProductId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedProductId, purchases]);

  const filteredTablePurchases = useMemo(() => {
    if (!tableSearchTerm) return productPurchases;
    const lower = tableSearchTerm.toLowerCase();
    return productPurchases.filter(p => {
      const sName = getSupplierName(p.supplierId).toLowerCase();
      const date = p.date.toLowerCase();
      const price = p.unitPrice.toString();
      const qty = p.qty.toString();
      return sName.includes(lower) || date.includes(lower) || price.includes(lower) || qty.includes(lower);
    });
  }, [productPurchases, tableSearchTerm, getSupplierName]);

  const chartData = useMemo(() => {
    if (productPurchases.length === 0) return [];

    const periods: { startDate: string, endDate: string, price: number, displayPrice: string, periodStr: string }[] = [];
    let currentPeriod: any = null;

    productPurchases.forEach((p, idx) => {
      if (!currentPeriod) {
        currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
      } else {
        if (p.unitPrice.toFixed(2) === currentPeriod.price.toFixed(2)) {
          currentPeriod.endDate = p.date;
        } else {
          periods.push({ ...currentPeriod });
          currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
        }
      }
      
      if (idx === productPurchases.length - 1 && currentPeriod) {
        periods.push({ ...currentPeriod });
      }
    });

    return periods.map(p => ({
      ...p,
      displayPrice: `${p.price.toFixed(2)} AED`,
      periodStr: p.startDate === p.endDate ? p.startDate : `${p.startDate} → ${p.endDate}`
    }));
  }, [productPurchases]);

  const latestPrice = productPurchases.length > 0 ? productPurchases[productPurchases.length - 1].unitPrice : 0;
  const oldestPrice = productPurchases.length > 0 ? productPurchases[0].unitPrice : 0;
  
  let priceChange = 0;
  let priceChangePct = 0;
  let trend: 'up' | 'down' | 'flat' = 'flat';

  if (productPurchases.length > 1) {
    priceChange = latestPrice - oldestPrice;
    priceChangePct = oldestPrice > 0 ? (priceChange / oldestPrice) * 100 : 0;
    if (priceChange > 0) trend = 'up';
    else if (priceChange < 0) trend = 'down';
  }

  const uniqueSuppliersSet = new Set(productPurchases.map(p => p.supplierId));
  const totalSuppliersCount = uniqueSuppliersSet.size;

  const supplierCounts = new Map<string, number>();
  let maxCount = 0;
  let topSupplierId = '';
  productPurchases.forEach(p => {
    const count = (supplierCounts.get(p.supplierId) || 0) + 1;
    supplierCounts.set(p.supplierId, count);
    if (count > maxCount) {
      maxCount = count;
      topSupplierId = p.supplierId;
    }
  });
  const topSupplierName = topSupplierId ? getSupplierName(topSupplierId) : 'N/A';

  const latestPriceBySupplier = new Map<string, number>();
  productPurchases.forEach(p => {
    latestPriceBySupplier.set(p.supplierId, p.unitPrice);
  });

  let minPrice = Infinity;
  let recommendedSupplierId = '';
  latestPriceBySupplier.forEach((price, suppId) => {
    if (price < minPrice) {
      minPrice = price;
      recommendedSupplierId = suppId;
    }
  });
  const recommendedSupplierName = recommendedSupplierId ? getSupplierName(recommendedSupplierId) : 'N/A';

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // If no product is selected, show the Grid View
  if (!selectedProductId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Product Price History</h2>
            <p className="text-slate-500 font-medium mt-1">Select a product to view its price history and trends.</p>
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

        {filteredProducts.length === 0 ? (
          <div className="bg-white/50 border border-slate-200 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center text-slate-400">
            <Package className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold text-lg">No products found matching your search.</p>
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
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">
                  <TrendingUp className="w-4 h-4" />
                  <span>View History</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If product is selected, show Detail View
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
            <p className="text-slate-500 font-medium">Historical price trends and purchases</p>
          </div>
        </div>
      </div>

      {productPurchases.length === 0 ? (
        <div className="bg-white/50 border border-slate-200 border-dashed rounded-[2rem] p-16 flex flex-col items-center justify-center text-slate-400">
          <TrendingUp className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-bold text-lg">No purchase history found for this product.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-[#D4AF37]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Latest Price</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">{latestPrice.toFixed(2)}</p>
                <p className="text-sm font-bold text-slate-400 mb-1">AED</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-[#D4AF37]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Price Change</p>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${
                  trend === 'up' ? 'bg-red-50 text-red-500' : 
                  trend === 'down' ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-500'
                }`}>
                  {trend === 'up' && <TrendingUp className="w-6 h-6" />}
                  {trend === 'down' && <TrendingDown className="w-6 h-6" />}
                  {trend === 'flat' && <Minus className="w-6 h-6" />}
                </div>
                <div>
                  <p className={`text-2xl font-black ${
                    trend === 'up' ? 'text-red-500' : 
                    trend === 'down' ? 'text-emerald-500' : 'text-slate-900'
                  }`}>
                    {trend === 'up' ? '+' : ''}{priceChangePct.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-[#D4AF37]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Purchases</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">{productPurchases.length}</p>
                <p className="text-sm font-bold text-slate-400 mb-1">times</p>
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-blue-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Suppliers</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">{totalSuppliersCount}</p>
                <p className="text-sm font-bold text-slate-400 mb-1">suppliers</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-blue-500">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Top Supplier</p>
              <div className="flex items-center gap-2 h-full">
                <p className="text-sm font-semibold text-slate-700 line-clamp-3 break-words w-full leading-tight">{topSupplierName}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-emerald-500 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute -right-4 -top-4 bg-emerald-100 w-16 h-16 rounded-full opacity-50"></div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1 relative z-10">Recommended</p>
              <div className="flex items-center gap-2 h-full relative z-10 mt-1">
                <p className="text-sm font-semibold text-slate-700 line-clamp-3 break-words w-full leading-tight">{recommendedSupplierName}</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#D4AF37]" />
              Price Trend (Grouped by Period)
            </h3>
            <div className="h-[300px] w-full overflow-x-auto custom-scrollbar">
              <div 
                className="h-full"
                style={{
                  width: chartData.length > 8 ? `${chartData.length * 100}px` : '100%',
                  minWidth: '100%'
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="displayPrice" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#475569', fontSize: 14, fontWeight: 800 }}
                      dy={15}
                    />
                    <YAxis 
                      dataKey="price"
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                      dx={-10}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)' }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0) {
                           return `Period: ${payload[0].payload.periodStr}`;
                        }
                        return label;
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} AED`, 'Price']}
                    />
                    <Bar 
                      dataKey="price" 
                      fill="#D4AF37" 
                      radius={[6, 6, 0, 0]}
                      maxBarSize={60}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#D4AF37]" />
                Purchase History Details
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search date, supplier, qty..."
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 pl-9 pr-4 py-2 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] text-sm font-medium transition-all shadow-sm"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Date</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Supplier</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTablePurchases.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No purchases match your search.
                      </td>
                    </tr>
                  ) : (
                    [...filteredTablePurchases].reverse().map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-700">{p.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-700">{getSupplierName(p.supplierId)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full">{p.qty}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-bold text-amber-600">{p.unitPrice.toFixed(2)} AED</span>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
