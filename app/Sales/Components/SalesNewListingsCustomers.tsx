'use client';

import { useState, useMemo } from 'react';
import { Search, Eye, X, Users, Package } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';

interface SalesNewListingsCustomersProps {
  selectedMonth: any;
  searchQuery: string;
}

export default function SalesNewListingsCustomers({ selectedMonth, searchQuery }: SalesNewListingsCustomersProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  // Derive customer-centric data from selectedMonth.products
  const customersData = useMemo(() => {
    if (!selectedMonth || !selectedMonth.products) return [];

    const cMap = new Map<string, { id: string, name: string, products: any[] }>();

    for (const p of selectedMonth.products) {
      for (const c of p.customers) {
        if (!cMap.has(c.id)) {
          cMap.set(c.id, { id: c.id, name: c.name, products: [] });
        }
        cMap.get(c.id)!.products.push({
          productId: p.productId,
          barcode: p.barcode,
          productName: p.productName
        });
      }
    }

    const data = Array.from(cMap.values()).map(c => ({
      ...c,
      productsCount: c.products.length
    }));

    // Sort by productsCount (descending), then alphabetically
    data.sort((a, b) => {
      if (b.productsCount !== a.productsCount) {
        return b.productsCount - a.productsCount;
      }
      return a.name.localeCompare(b.name);
    });

    return data;
  }, [selectedMonth]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customersData;
    const query = searchQuery.toLowerCase();
    return customersData.filter((c: any) =>
      c.name?.toLowerCase().includes(query) ||
      c.id?.toLowerCase().includes(query)
    );
  }, [customersData, searchQuery]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* Details View: Customers Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-auto">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold text-center">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Customer ID</th>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Products Count</th>
                <th className="px-6 py-4">View Products</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((c: any, idx: number) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors text-center">
                  <td className="px-6 py-4 text-sm text-slate-500 font-medium">{idx + 1}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 font-mono">{c.id}</td>
                  <td className="px-6 py-4 text-sm text-slate-800 font-bold max-w-md truncate mx-auto" title={c.name}>
                    {c.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-50 text-emerald-700 font-black px-3 py-1 rounded-full text-sm">
                      {c.productsCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedCustomer(c)}
                      className="inline-flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-700 rounded-xl transition-colors"
                      title="View Products"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <NoData />
                    <p className="text-slate-400 text-sm mt-2">No customers match your search.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Level 3: Product Details Popup */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)} />
          <div className="relative bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-1" title={selectedCustomer.name}>
                    {selectedCustomer.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">New Products in {selectedMonth?.monthName}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Product Name</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">
                  Total: {selectedCustomer.productsCount}
                </span>
              </div>

              <ul className="space-y-2">
                {selectedCustomer.products.map((p: any, idx: number) => (
                  <li
                    key={`${p.productId}-${idx}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{p.productName}</p>
                      <p className="text-xs text-slate-400 font-mono">{p.barcode}</p>
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
