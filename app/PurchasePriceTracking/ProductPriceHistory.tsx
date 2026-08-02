import React, { useState, useMemo, useEffect } from 'react';
import { PurchaseRecord, Product, Supplier } from './page';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, TrendingUp, TrendingDown, Minus, Calendar, Building2, Package, ArrowLeft, ChevronLeft, ChevronRight, FileText, X, Pencil, Loader2 } from 'lucide-react';
import { updatePurchaseUnitPrice } from '@/app/DataBase/PurchasePriceTracking/PurchaseDetailsService';
import { toast } from '@/app/Components/Notification';

interface Props {
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
  onPurchasePriceUpdated?: (id: string, unitPrice: number) => void;
}

function canEditPurchaseLinePrice(roleStr?: string, userName?: string): boolean {
  if (userName?.trim().toLowerCase() === 'med sabry') return true;
  if (!roleStr) return false;
  if (roleStr === 'Admin') return true;

  try {
    const actions = JSON.parse(roleStr)['purchase-price-tracking-actions'];
    return Array.isArray(actions) && actions.includes('edit-price');
  } catch {
    return false;
  }
}

export default function ProductPriceHistory({ purchases, products, suppliers, onPurchasePriceUpdated }: Props) {
  const [canEditPrice, setCanEditPrice] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseRecord | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [isSavingPrice, setIsSavingPrice] = useState(false);
  const itemsPerPage = 50;

  useEffect(() => {
    try {
      const mainUserStr = localStorage.getItem('currentUser');
      if (!mainUserStr) {
        setCanEditPrice(false);
        return;
      }
      const user = JSON.parse(mainUserStr);
      setCanEditPrice(canEditPurchaseLinePrice(user.role, user.name));
    } catch {
      setCanEditPrice(false);
    }
  }, []);

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
      const invoice = (p.invoiceNumber || '').toLowerCase();
      const price = p.unitPrice.toString();
      const qty = p.qty.toString();
      return sName.includes(lower) || date.includes(lower) || invoice.includes(lower) || price.includes(lower) || qty.includes(lower);
    });
  }, [productPurchases, tableSearchTerm, getSupplierName]);

  useEffect(() => {
    setTablePage(1);
  }, [tableSearchTerm, selectedProductId]);

  const tableRows = useMemo(
    () => [...filteredTablePurchases].reverse(),
    [filteredTablePurchases]
  );

  const totalTablePages = Math.ceil(tableRows.length / itemsPerPage);
  const paginatedTablePurchases = useMemo(() => {
    const start = (tablePage - 1) * itemsPerPage;
    return tableRows.slice(start, start + itemsPerPage);
  }, [tableRows, tablePage]);

  const chartData = useMemo(() => {
    if (productPurchases.length === 0) return [];

    const chronologicalPeriods: {
      startDate: string;
      endDate: string;
      price: number;
      periodStr: string;
    }[] = [];

    let currentPeriod: { startDate: string; endDate: string; price: number } | null = null;

    productPurchases.forEach((p, idx) => {
      if (!currentPeriod) {
        currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
      } else if (p.unitPrice.toFixed(2) === currentPeriod.price.toFixed(2)) {
        currentPeriod.endDate = p.date;
      } else {
        chronologicalPeriods.push({
          ...currentPeriod,
          periodStr: currentPeriod.startDate === currentPeriod.endDate
            ? currentPeriod.startDate
            : `${currentPeriod.startDate} → ${currentPeriod.endDate}`,
        });
        currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
      }

      if (idx === productPurchases.length - 1 && currentPeriod) {
        chronologicalPeriods.push({
          ...currentPeriod,
          periodStr: currentPeriod.startDate === currentPeriod.endDate
            ? currentPeriod.startDate
            : `${currentPeriod.startDate} → ${currentPeriod.endDate}`,
        });
      }
    });

    const byPrice = new Map<number, {
      price: number;
      displayPrice: string;
      periods: { startDate: string; endDate: string; periodStr: string }[];
    }>();

    chronologicalPeriods.forEach(period => {
      const priceKey = Number(period.price.toFixed(2));
      if (!byPrice.has(priceKey)) {
        byPrice.set(priceKey, {
          price: period.price,
          displayPrice: `${period.price.toFixed(2)} AED`,
          periods: [],
        });
      }
      byPrice.get(priceKey)!.periods.push({
        startDate: period.startDate,
        endDate: period.endDate,
        periodStr: period.periodStr,
      });
    });

    return Array.from(byPrice.values())
      .map(item => ({
        ...item,
        periods: [...item.periods].sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        ),
      }))
      .sort((a, b) => a.price - b.price);
  }, [productPurchases]);

  const PriceChartTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;

    const item = payload[0].payload as {
      displayPrice: string;
      periods: { periodStr: string }[];
    };

    return (
      <div className="bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-100 shadow-xl min-w-[220px]">
        <p className="text-slate-900 text-base font-black border-b border-slate-100 pb-2 mb-3">
          {item.displayPrice}
        </p>
        <div className="flex flex-col gap-2">
          {item.periods.map((period, index) => (
            <div key={`${period.periodStr}-${index}`} className="flex items-start gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
              <span className="text-slate-600 text-sm font-semibold leading-snug">{period.periodStr}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

  const openEditPriceModal = (purchase: PurchaseRecord) => {
    if (!canEditPrice) return;
    setEditingPurchase(purchase);
    setEditPrice(purchase.unitPrice.toFixed(2));
  };

  const closeEditPriceModal = () => {
    if (isSavingPrice) return;
    setEditingPurchase(null);
    setEditPrice('');
  };

  const handleSavePrice = async () => {
    if (!editingPurchase || !canEditPrice) return;

    const parsedPrice = Number(editPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error('Please enter a valid unit price greater than zero.');
      return;
    }

    setIsSavingPrice(true);
    try {
      const result = await updatePurchaseUnitPrice(editingPurchase.id, parsedPrice);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      onPurchasePriceUpdated?.(editingPurchase.id, parsedPrice);
      toast.success('Unit price updated successfully.');
      setEditingPurchase(null);
      setEditPrice('');
    } catch (error) {
      console.error('Failed to update unit price:', error);
      toast.error('Failed to update unit price.');
    } finally {
      setIsSavingPrice(false);
    }
  };

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
              Price Trend (Grouped by Price)
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
                    <Tooltip cursor={{ fill: '#f8fafc' }} content={<PriceChartTooltip />} />
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
                  placeholder="Search date, invoice, supplier, qty..."
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
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Invoice</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Supplier</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTablePurchases.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No purchases match your search.
                      </td>
                    </tr>
                  ) : (
                    paginatedTablePurchases.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => openEditPriceModal(p)}
                      className={`transition-colors ${canEditPrice ? 'hover:bg-amber-50/60 cursor-pointer group' : 'hover:bg-slate-50'}`}
                      title={canEditPrice ? 'Click to edit unit price' : undefined}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-700">{p.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          <span className="font-bold text-slate-700 font-mono text-sm">{p.invoiceNumber || '-'}</span>
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
                        <span className={`inline-flex items-center gap-2 font-bold text-amber-600 ${canEditPrice ? 'group-hover:text-[#b8962e]' : ''}`}>
                          {p.unitPrice.toFixed(2)} AED
                          {canEditPrice && (
                            <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </span>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>

            {tableRows.length > 0 && totalTablePages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 bg-slate-50/50">
                <div>
                  Showing {((tablePage - 1) * itemsPerPage) + 1} to {Math.min(tablePage * itemsPerPage, tableRows.length)} of {tableRows.length} purchases
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTablePage(p => Math.max(p - 1, 1))}
                    disabled={tablePage === 1}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {tablePage} of {totalTablePages}</span>
                  <button
                    type="button"
                    onClick={() => setTablePage(p => Math.min(p + 1, totalTablePages))}
                    disabled={tablePage === totalTablePages}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-[#D4AF37] rounded-xl">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 leading-none mb-1">Edit Unit Price</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Invoice line</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditPriceModal}
                disabled={isSavingPrice}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</p>
                  <p className="font-bold text-slate-700">{editingPurchase.date}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Invoice</p>
                  <p className="font-bold text-slate-700 font-mono">{editingPurchase.invoiceNumber || '-'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Supplier</p>
                  <p className="font-bold text-slate-700">{getSupplierName(editingPurchase.supplierId)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Qty</p>
                  <p className="font-bold text-slate-700">{editingPurchase.qty}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Price</p>
                  <p className="font-bold text-amber-600">{editingPurchase.unitPrice.toFixed(2)} AED</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                  New Unit Price (AED)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  autoFocus
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePrice();
                    if (e.key === 'Escape') closeEditPriceModal();
                  }}
                  className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditPriceModal}
                disabled={isSavingPrice}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-white transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePrice}
                disabled={isSavingPrice}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-[#D4AF37] hover:text-black transition-colors disabled:opacity-40 inline-flex items-center gap-2"
              >
                {isSavingPrice ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Price'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
