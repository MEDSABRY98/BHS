'use client';

import { useState, useMemo } from 'react';
import { Search, Eye, X, Users, Package } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

interface SalesNewListingsProductsProps {
  selectedMonth: any;
  searchQuery: string;
}

export default function SalesNewListingsProducts({ selectedMonth, searchQuery }: SalesNewListingsProductsProps) {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const filteredProducts = useMemo(() => {
    if (!selectedMonth || !searchQuery) return selectedMonth?.products || [];
    const query = searchQuery.toLowerCase();
    return selectedMonth.products.filter((p: any) =>
      p.productName?.toLowerCase().includes(query) ||
      p.barcode?.toLowerCase().includes(query) ||
      p.productId?.toLowerCase().includes(query)
    );
  }, [selectedMonth, searchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* Details View: Products Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold text-center">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Barcode</th>
                <th className="px-6 py-4">Product Name</th>
                <th className="px-6 py-4">Customers Count</th>
                <th className="px-6 py-4">View Customers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p: any, idx: number) => (
                <tr key={p.productId} className="hover:bg-slate-50 transition-colors text-center">
                  <td className="px-6 py-4 text-sm text-slate-500 font-medium">{idx + 1}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">{p.barcode}</td>
                  <td className="px-6 py-4 text-sm text-slate-800 font-bold max-w-md truncate mx-auto" title={p.productName}>
                    {p.productName}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-50 text-emerald-700 font-black px-3 py-1 rounded-full text-sm">
                      {p.customersCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedProduct(p)}
                      className="inline-flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded-xl transition-colors"
                      title="View Customers"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <NoData />
                    <p className="text-slate-400 text-sm mt-2">No products match your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Level 3: Customer Details Popup */}
      {selectedProduct && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-1" title={selectedProduct.productName}>
                    {selectedProduct.productName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Customers who bought this in {selectedMonth?.monthName}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Customer Name</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
                  Total: {selectedProduct.customersCount}
                </span>
              </div>

              <ul className="space-y-2">
                {selectedProduct.customers.map((c: any, idx: number) => (
                  <li
                    key={`${c.id}-${idx}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{c.id}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
