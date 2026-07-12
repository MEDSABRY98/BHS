import React, { useState, useMemo } from 'react';
import { PurchaseRecord, Product, Supplier } from './page';
import { Search, Package, Users, Building2, TrendingDown, Calendar, ArrowLeft } from 'lucide-react';

interface Props {
  purchases: PurchaseRecord[];
  products: Product[];
  suppliers: Supplier[];
}

export default function SupplierComparison({ purchases, products, suppliers }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
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
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 50); // limit for performance in grid
  }, [searchTerm, products, purchases]);

  const productPurchases = useMemo(() => {
    if (!selectedProductId) return [];
    return purchases.filter(p => p.productId === selectedProductId);
  }, [selectedProductId, purchases]);

  const supplierStats = useMemo(() => {
    if (productPurchases.length === 0) return [];

    const stats = new Map<string, { minPrice: number, maxPrice: number, sumPrice: number, count: number, latestPrice: number, latestDate: string }>();

    productPurchases.forEach(p => {
      const existing = stats.get(p.supplierId);
      if (!existing) {
        stats.set(p.supplierId, {
          minPrice: p.unitPrice,
          maxPrice: p.unitPrice,
          sumPrice: p.unitPrice,
          count: 1,
          latestPrice: p.unitPrice,
          latestDate: p.date
        });
      } else {
        existing.minPrice = Math.min(existing.minPrice, p.unitPrice);
        existing.maxPrice = Math.max(existing.maxPrice, p.unitPrice);
        existing.sumPrice += p.unitPrice;
        existing.count += 1;
        
        if (new Date(p.date) > new Date(existing.latestDate)) {
          existing.latestPrice = p.unitPrice;
          existing.latestDate = p.date;
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
      purchaseCount: data.count
    })).sort((a, b) => a.avgPrice - b.avgPrice); // Sort by lowest average price
  }, [productPurchases]);

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
                  <Users className="w-4 h-4" />
                  <span>Compare Suppliers</span>
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

      {supplierStats.length === 0 ? (
        <div className="bg-white/50 border border-slate-200 border-dashed rounded-[2rem] p-16 flex flex-col items-center justify-center text-slate-400">
          <Users className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-bold text-lg">No suppliers found for this product.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supplierStats.map((stat, index) => (
              <div 
                key={stat.supplierId}
                className={`bg-white rounded-[2rem] p-6 border shadow-sm flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-md ${
                  index === 0 ? 'border-[#D4AF37] border-t-4' : 'border-slate-100 border-t-4 border-t-transparent'
                }`}
              >
                {index === 0 && (
                  <div className="absolute top-0 right-0 bg-[#D4AF37] text-black text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                    Best Value
                  </div>
                )}
                
                <div className="flex items-start gap-3 mb-6">
                  <div className={`p-3 rounded-xl shrink-0 ${index === 0 ? 'bg-amber-50 text-[#D4AF37]' : 'bg-slate-50 text-slate-400'}`}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 leading-tight">{stat.supplierName}</h3>
                    <p className="text-xs font-mono text-slate-400 mt-1">{stat.supplierId}</p>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg Price</span>
                    <span className="font-black text-lg text-slate-900">{stat.avgPrice.toFixed(2)} <span className="text-xs text-slate-400">AED</span></span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Min - Max</span>
                    <span className="font-bold text-sm text-slate-600">{stat.minPrice.toFixed(2)} - {stat.maxPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Purchases</span>
                    <span className="font-bold text-sm text-slate-600">{stat.purchaseCount} times</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>Latest Date</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{stat.latestDate}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
