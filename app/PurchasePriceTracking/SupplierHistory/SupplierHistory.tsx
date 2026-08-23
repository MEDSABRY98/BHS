import React, { useState, useMemo } from 'react';
import { PurchaseRecord, Product, Supplier } from '../page';
import { Search, Building2, Calendar, FileText, ArrowLeft, Users, Package, X, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { exportPurchasePriceTrackingExcel } from '../Export/ExcelExport';
import {
  FormatPurchasePrice,
  FormatPurchasePriceAed,
  RoundPurchasePrice,
  SamePurchasePrice,
} from '../Utils/PriceFormat';

interface Props {
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
}

export default function SupplierHistory({ purchases, products, suppliers }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<string | null>(null);

  // Clear product search when changing supplier
  React.useEffect(() => {
    setProductSearchTerm('');
  }, [selectedSupplierId]);

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || id;
  };
  
  const getProductBarcode = (id: string) => {
    return products.find(p => p.id === id)?.barcode || id;
  };

  const filteredSuppliers = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return suppliers
      .filter(s => 
        s.name.toLowerCase().includes(lower) || 
        s.id.toLowerCase().includes(lower)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [searchTerm, suppliers]);

  const supplierPurchases = useMemo(() => {
    if (!selectedSupplierId) return [];
    return purchases
      .filter(p => p.supplierId === selectedSupplierId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedSupplierId, purchases]);

  const totalSpent = useMemo(() => {
    return supplierPurchases.reduce((sum, p) => sum + (p.unitPrice * p.qty), 0);
  }, [supplierPurchases]);
  
  const totalItems = useMemo(() => {
    return supplierPurchases.reduce((sum, p) => sum + p.qty, 0);
  }, [supplierPurchases]);

  const supplierProductsAggregated = useMemo(() => {
    if (!selectedSupplierId) return [];
    const map = new Map<string, { qty: number; count: number; exactTotal: number; purchases: { date: string; unitPrice: number }[] }>();
    
    supplierPurchases.forEach(p => {
      const existing = map.get(p.productId);
      if (!existing) {
        map.set(p.productId, {
          qty: p.qty,
          count: 1,
          exactTotal: p.qty * p.unitPrice,
          purchases: [{ date: p.date, unitPrice: p.unitPrice }]
        });
      } else {
        existing.qty += p.qty;
        existing.count += 1;
        existing.exactTotal += (p.qty * p.unitPrice);
        existing.purchases.push({ date: p.date, unitPrice: p.unitPrice });
      }
    });

    return Array.from(map.entries()).map(([productId, data]) => {
      const sorted = [...data.purchases].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      return {
        productId,
        productBarcode: getProductBarcode(productId),
        productName: getProductName(productId),
        totalQty: data.qty,
        purchaseCount: data.count,
        oldestPrice: sorted[0].unitPrice,
        latestPrice: sorted[sorted.length - 1].unitPrice,
        priceDiff: sorted[sorted.length - 1].unitPrice - sorted[0].unitPrice,
        totalSpent: data.exactTotal
      };
    }).sort((a, b) => a.productName.localeCompare(b.productName));
  }, [supplierPurchases, selectedSupplierId, products]);

  const filteredAggregatedProducts = useMemo(() => {
    if (!productSearchTerm) return supplierProductsAggregated;
    const lower = productSearchTerm.toLowerCase();
    return supplierProductsAggregated.filter(p => 
      p.productName.toLowerCase().includes(lower) || 
      p.productId.toLowerCase().includes(lower) ||
      p.productBarcode.toLowerCase().includes(lower)
    );
  }, [supplierProductsAggregated, productSearchTerm]);

  const priceHistoryForModal = useMemo(() => {
    if (!selectedProductForHistory || !selectedSupplierId) return [];
    
    const productPurchases = purchases
      .filter(p => p.supplierId === selectedSupplierId && p.productId === selectedProductForHistory)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const periods: { startDate: string, endDate: string, price: number }[] = [];
    let currentPeriod: any = null;

    productPurchases.forEach((p, idx) => {
      if (!currentPeriod) {
        currentPeriod = { startDate: p.date, endDate: p.date, price: p.unitPrice };
      } else {
        if (SamePurchasePrice(p.unitPrice, currentPeriod.price)) {
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

    return periods.reverse();
  }, [selectedProductForHistory, selectedSupplierId, purchases]);

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  const exportSupplierProductsToExcel = async () => {
    if (!selectedSupplierId || !selectedSupplier) return;
    
    const reportData = supplierProductsAggregated.map(p => ({
      'Barcode': p.productBarcode,
      'Product Name': p.productName,
      'Purchases Count': p.purchaseCount,
      'Total Qty': p.totalQty,
      'Oldest Price (AED)': RoundPurchasePrice(p.oldestPrice),
      'Latest Price (AED)': RoundPurchasePrice(p.latestPrice),
      'Price Diff (AED)': RoundPurchasePrice(p.priceDiff)
    }));

    const fileName = `Supplier_Products_${selectedSupplier.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
    
    await exportPurchasePriceTrackingExcel(reportData, fileName, {
      sheetName: 'Products Log',
      columnWidth: 22,
      numericColumns: ['Purchases Count', 'Total Qty', 'Oldest Price (AED)', 'Latest Price (AED)', 'Price Diff (AED)']
    });
  };

  // If no supplier is selected, show Grid View
  if (!selectedSupplierId) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Supplier History</h2>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search supplier name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 pl-12 pr-4 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] font-medium transition-all shadow-sm"
            />
          </div>
        </div>

        {filteredSuppliers.length === 0 ? (
          <div className="bg-white/50 border border-slate-200 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center text-slate-400">
            <Users className="w-16 h-16 mb-4 opacity-20" />
            <p className="font-bold text-lg">No suppliers found matching your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-12">
            {filteredSuppliers.map(supplier => (
              <button
                key={supplier.id}
                onClick={() => setSelectedSupplierId(supplier.id)}
                className="bg-white text-left p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 border-t-4 border-t-[#D4AF37] flex flex-col justify-between h-[160px] group"
              >
                <div>
                  <p className="text-xs font-mono font-bold text-[#D4AF37] mb-2 bg-amber-50 inline-block px-2 py-1 rounded-md">
                    {supplier.id}
                  </p>
                  <h3 className="font-bold text-slate-800 line-clamp-2 leading-tight group-hover:text-[#D4AF37] transition-colors text-lg">
                    {supplier.name}
                  </h3>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">
                  <Building2 className="w-4 h-4" />
                  <span>View History</span>
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
    <div className="space-y-8 animate-in slide-in-from-right-8 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => setSelectedSupplierId(null)}
            className="p-3 bg-white border border-slate-200 hover:border-[#D4AF37] hover:text-[#D4AF37] text-slate-500 rounded-2xl transition-all shadow-sm shrink-0"
            title="Back to suppliers"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono font-bold bg-[#D4AF37] text-black px-2 py-1 rounded-md">
                {selectedSupplier?.id}
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">{selectedSupplier?.name}</h2>
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <button
            onClick={exportSupplierProductsToExcel}
            title="Export Products to Excel"
            className="flex items-center justify-center bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white p-3 rounded-xl transition-all shadow-sm group"
          >
            <FileSpreadsheet className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {supplierPurchases.length === 0 ? (
        <div className="bg-white/50 border border-slate-200 border-dashed rounded-[2rem] p-16 flex flex-col items-center justify-center text-slate-400">
          <Building2 className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-bold text-lg">No purchase history found for this supplier.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-[#D4AF37]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Unique Products</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">{supplierProductsAggregated.length}</p>
                <p className="text-sm font-bold text-slate-400 mb-1">Products</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-[#D4AF37]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Average Price</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">
                  {supplierPurchases.length > 0 
                    ? FormatPurchasePrice(
                        supplierPurchases.reduce((sum, p) => sum + p.unitPrice, 0) / supplierPurchases.length,
                      )
                    : FormatPurchasePrice(0)}
                </p>
                <p className="text-sm font-bold text-slate-400 mb-1">AED</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm border-t-4 border-t-[#D4AF37]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Transactions</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-slate-900">{supplierPurchases.length}</p>
                <p className="text-sm font-bold text-slate-400 mb-1">Invoices</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#D4AF37]" />
                Aggregated Products Log
              </h3>
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products in history..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] text-sm font-medium transition-all"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Barcode</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Product Name</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Purchases Count</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Total Qty</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Oldest Price</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Latest Price</th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Price Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAggregatedProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-mono text-xs font-bold text-[#D4AF37] px-2.5 py-0.5 bg-amber-50 border border-amber-100 rounded-md">
                          {p.productBarcode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-slate-700 block mx-auto leading-relaxed max-w-[400px]">
                          {p.productName}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{p.purchaseCount} times</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="font-black text-slate-900">{p.totalQty}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setSelectedProductForHistory(p.productId)}
                          className="font-bold text-slate-600 hover:text-amber-600 underline decoration-dashed underline-offset-4 cursor-pointer transition-colors"
                          title="Click to view price evolution"
                        >
                          {FormatPurchasePriceAed(p.oldestPrice)}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setSelectedProductForHistory(p.productId)}
                          className="font-bold text-slate-600 hover:text-amber-600 underline decoration-dashed underline-offset-4 cursor-pointer transition-colors"
                          title="Click to view price evolution"
                        >
                          {FormatPurchasePriceAed(p.latestPrice)}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`font-black ${
                          p.priceDiff > 0 ? 'text-red-500' : p.priceDiff < 0 ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          {p.priceDiff > 0 ? '+' : ''}{FormatPurchasePriceAed(p.priceDiff)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Price Evolution Modal */}
      {selectedProductForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-[#D4AF37] rounded-xl">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 leading-none mb-1">Price Evolution</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{getProductName(selectedProductForHistory)}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProductForHistory(null)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-4">
                {priceHistoryForModal.map((period, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white hover:border-[#D4AF37] transition-colors group shadow-sm">
                    <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Period</p>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">{period.startDate}</span>
                        {period.startDate !== period.endDate && (
                          <>
                            <span className="text-slate-300">→</span>
                            <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">{period.endDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Unit Price</p>
                      <span className="font-black text-amber-600 text-xl group-hover:scale-110 transition-transform inline-block origin-right">
                        {FormatPurchasePrice(period.price)} <span className="text-sm font-bold text-slate-400">AED</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
