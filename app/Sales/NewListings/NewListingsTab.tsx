'use client';

import { useState } from 'react';
import { ChevronLeft, Calendar, Package, Users, Search } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import NoData from '@/app/Components/DataState/NoDataTab';
import SalesNewListingsProducts from './NewListingsProducts';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';
import SalesNewListingsCustomers from './NewListingsCustomers';
import { getNewListingsData } from '../Service/sales_core_service';
import { useSalesDataContext } from '@/app/Sales/Context/SalesDataContext';
import { useSalesTabFetch } from '@/app/Sales/Hooks/useSalesTabFetch';
import TabFetchError from '@/app/Components/DataState/TabFetchError';

interface SalesNewListingsTabProps {
  userId: string;
}

export default function SalesNewListingsTab({ userId }: SalesNewListingsTabProps) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const { dataVersion } = useSalesDataContext();

  const { data, isInitialLoading, error, reload, loading } = useSalesTabFetch<any[]>({
    tabKey: 'new-listings',
    userId,
    filters,
    dataVersion,
    fetcher: () => getNewListingsData(userId, filters),
    initialData: [] as any[],
  });

  const [includeLegacyProducts, setIncludeLegacyProducts] = useState(false);

  const listingRows = (data ?? []).map((month: any) => {
    if (includeLegacyProducts) return month;

    const filteredProducts = month.products.filter((p: any) => {
      const name = (p.productName || '').toUpperCase();
      return !name.includes('HASI') && !name.includes('CAMEL') && !name.includes('حاشي') && !name.includes('كاميل');
    });

    if (filteredProducts.length === month.products.length) return month;

    const uniqueCusts = new Set();
    filteredProducts.forEach((p: any) => {
      p.customers.forEach((c: any) => uniqueCusts.add(c.id));
    });

    return {
      ...month,
      products: filteredProducts,
      uniqueProductsCount: filteredProducts.length,
      uniqueCustomersCount: uniqueCusts.size
    };
  }).filter((month: any) => month.uniqueProductsCount > 0);

  // Navigation State
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const selectedMonth = selectedMonthKey ? listingRows.find(m => m.monthKey === selectedMonthKey) : null;
  const [subTab, setSubTab] = useState<'products' | 'customers'>('products');
  const [searchQuery, setSearchQuery] = useState('');

  if (isInitialLoading) {
    return <SalesTabLoader />;
  }

  if (error) {
    return (
      <TabFetchError
        message={error}
        onRetry={() => void reload()}
        isRetrying={loading}
        className="min-h-[360px]"
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      {!selectedMonth ? (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">New Listings</h1>
            <button
              onClick={() => setIncludeLegacyProducts(!includeLegacyProducts)}
              title={includeLegacyProducts ? "Hide HASI / CAMEL" : "Show HASI / CAMEL"}
              className={`p-2 rounded-xl transition-all border shadow-sm flex items-center justify-center ${
                includeLegacyProducts
                  ? 'bg-emerald-50 border-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded-full transition-colors ${includeLegacyProducts ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => { setSelectedMonthKey(null); setSubTab('products'); setSearchQuery(''); }}
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">{selectedMonth.monthName}</h1>
              <button
                onClick={() => setIncludeLegacyProducts(!includeLegacyProducts)}
                title={includeLegacyProducts ? "Hide HASI / CAMEL" : "Show HASI / CAMEL"}
                className={`p-2 rounded-xl transition-all border shadow-sm flex items-center justify-center ${
                  includeLegacyProducts
                    ? 'bg-emerald-50 border-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full transition-colors ${includeLegacyProducts ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              </button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl ml-2">
              <button
                onClick={() => setSubTab('products')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${subTab === 'products' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Package className="w-4 h-4" />
                Products
              </button>
              <button
                onClick={() => setSubTab('customers')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${subTab === 'customers' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Users className="w-4 h-4" />
                Customers
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:max-w-xs shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={subTab === 'products' ? "Search products..." : "Search customers..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all shadow-sm text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main View: Months Grid */}
      {!selectedMonth && (
        <>
          {listingRows.length === 0 ? (
            <NoData />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {listingRows.map((month: any) => (
                <div
                  key={month.monthKey}
                  onClick={() => setSelectedMonthKey(month.monthKey)}
                  className="bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-lg hover:border-emerald-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800 truncate" title={month.monthName}>{month.monthName}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <Package className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Products</span>
                      </div>
                      <p className="text-xl font-black text-slate-800">{month.uniqueProductsCount}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                        <Users className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider truncate">Customers</span>
                      </div>
                      <p className="text-xl font-black text-slate-800">{month.uniqueCustomersCount}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Sub-Tabs Rendering */}
      {selectedMonth && subTab === 'products' && (
        <SalesNewListingsProducts selectedMonth={selectedMonth} searchQuery={searchQuery} />
      )}

      {selectedMonth && subTab === 'customers' && (
        <SalesNewListingsCustomers selectedMonth={selectedMonth} searchQuery={searchQuery} />
      )}

    </div>
  );
}
