'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  FileSpreadsheet,
  Layers,
  MapPin,
  RefreshCcw,
  Search,
  X,
} from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { getProductsBalanceReportData, getInternalWarehouseLocationOptions } from '../Service/inventory_service';
import type { CategoryBalanceRow, ProductBalanceRow } from '../Service/inventory_types';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import InventoryCategoryBalanceDetailsTab from './InventoryCategoryBalanceDetailsTab';
import { peekIAPrefetch } from '../Utils/IAPrefetchCache';

function isDefaultBalanceFilters(from: string, to: string, location: string) {
  return !(from || '').trim() && !(to || '').trim() && (!location || location === 'All');
}

function aggregateCategories(products: ProductBalanceRow[]): CategoryBalanceRow[] {
  const map = new Map<string, CategoryBalanceRow>();

  products.forEach((item) => {
    const category = item.category?.trim() || 'Uncategorized';
    const existing = map.get(category);
    if (!existing) {
      map.set(category, {
        category,
        productCount: 1,
        endingStock: item.endingStock,
      });
      return;
    }

    existing.productCount += 1;
    existing.endingStock += item.endingStock;
  });

  return Array.from(map.values()).sort((a, b) =>
    a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }),
  );
}

export default function InventoryCategoryBalanceTab() {
  const [products, setProducts] = useState<ProductBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [warehouseLocations, setWarehouseLocations] = useState<string[]>([]);
  const fetchRequestId = useRef(0);

  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const locationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefetched = peekIAPrefetch();
    if (prefetched?.locations?.length) {
      setWarehouseLocations(prefetched.locations);
      return;
    }
    getInternalWarehouseLocationOptions().then((res) => {
      if (res.data?.length) setWarehouseLocations(res.data);
    });
  }, []);

  useEffect(() => {
    fetchReport(appliedDateFrom, appliedDateTo, selectedLocation);
  }, [appliedDateFrom, appliedDateTo, selectedLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
        setIsLocationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchReport = async (
    from = appliedDateFrom,
    to = appliedDateTo,
    location = selectedLocation,
    opts?: { skipCache?: boolean },
  ) => {
    const requestId = ++fetchRequestId.current;
    try {
      setLoading(true);

      if (!opts?.skipCache && isDefaultBalanceFilters(from, to, location)) {
        const prefetched = peekIAPrefetch();
        if (prefetched?.productsBalance) {
          if (requestId !== fetchRequestId.current) return;
          setProducts(prefetched.productsBalance);
          setError(null);
          setLoading(false);
          return;
        }
      }

      const res = await getProductsBalanceReportData({
        dateFrom: from,
        dateTo: to,
        location: location !== 'All' ? location : undefined,
      });
      if (requestId !== fetchRequestId.current) return;
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch category balance data');
      }
      setProducts(res.data || []);
      setError(null);
    } catch (err: any) {
      if (requestId !== fetchRequestId.current) return;
      console.error('Error fetching category balance:', err);
      setError(err.message || 'Failed to load category balance');
    } finally {
      if (requestId === fetchRequestId.current) {
        setLoading(false);
      }
    }
  };

  const categories = useMemo(() => aggregateCategories(products), [products]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase().trim();
    return categories.filter((item) => item.category.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const totalEnding = useMemo(
    () => filteredCategories.reduce((sum, item) => sum + item.endingStock, 0),
    [filteredCategories],
  );

  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / itemsPerPage));
  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCategories.slice(start, start + itemsPerPage);
  }, [filteredCategories, currentPage]);

  const locations = useMemo(() => ['All', ...warehouseLocations], [warehouseLocations]);
  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return locations;
    const q = locationSearch.toLowerCase().trim();
    return locations.filter((loc) => loc.toLowerCase().includes(q));
  }, [locations, locationSearch]);

  const handleApplyDateFilter = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setCurrentPage(1);
    setSelectedCategory(null);
  };

  const hasPendingDateChanges = dateFrom !== appliedDateFrom || dateTo !== appliedDateTo;

  const handleExportExcel = async () => {
    const headers = ['#', 'Category', 'Products Count', 'Ending Balance'];
    const rows = filteredCategories.map((item, index) => [
      index + 1,
      item.category,
      item.productCount,
      item.endingStock,
    ]);

    await exportSalesExcelTable(
      headers,
      rows,
      `inventory_categories_balance_${new Date().toISOString().split('T')[0]}.xlsx`,
      {
        sheetName: 'Categories Balance',
        numericColumns: ['Products Count', 'Ending Balance'],
      },
    );
  };

  if (loading && products.length === 0) {
    return <TabLoader />;
  }

  if (error && !loading && products.length === 0) {
    return (
      <TabFetchError
        message={error}
        onRetry={() => fetchReport(appliedDateFrom, appliedDateTo, selectedLocation, { skipCache: true })}
        isRetrying={loading}
        className="min-h-[360px]"
      />
    );
  }

  if (selectedCategory) {
    return (
      <InventoryCategoryBalanceDetailsTab
        categoryName={selectedCategory}
        products={products}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Categories Ending Balance
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <div className="relative flex items-center h-11 w-full sm:w-64 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder="Search category..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-56" ref={locationRef}>
            <button
              type="button"
              onClick={() => setIsLocationOpen(!isLocationOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs cursor-pointer ${
                isLocationOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Location: <strong className="text-indigo-900 font-bold">{selectedLocation === 'All' ? 'All' : selectedLocation.split('/').pop()}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isLocationOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {isLocationOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2">
                <div className="relative flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search location..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 text-xs">
                  {filteredLocations.map((loc) => {
                    const isSelected = selectedLocation === loc;
                    const label = loc === 'All' ? 'All Locations' : loc;
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => {
                          setSelectedLocation(loc);
                          setCurrentPage(1);
                          setIsLocationOpen(false);
                          setLocationSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate" title={label}>{label}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center h-11 bg-slate-50/80 border border-slate-200/90 rounded-xl px-3.5 shadow-xs">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
            />
            <span className="mx-2 text-slate-300">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleApplyDateFilter}
              disabled={loading || !hasPendingDateChanges}
              className="h-11 w-11 flex items-center justify-center rounded-xl transition-all shadow-sm border disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
              title="Apply Dates"
            >
              <CalendarCheck className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-11 w-11 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm group shrink-0"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-4 h-4 transition-transform group-hover:scale-110" />
            </button>
            <button
              type="button"
              onClick={() => fetchReport(appliedDateFrom, appliedDateTo, selectedLocation, { skipCache: true })}
              disabled={loading}
              className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {loading && products.length > 0 && (
          <p className="text-xs font-semibold text-indigo-600 flex items-center justify-center gap-2">
            <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
            Updating...
          </p>
        )}

        {error && products.length > 0 && (
          <TabFetchError
            message={error}
            onRetry={() => fetchReport(appliedDateFrom, appliedDateTo, selectedLocation, { skipCache: true })}
            isRetrying={loading}
          />
        )}
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity duration-300 ${loading && products.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Categories</p>
          <p className="text-2xl font-black text-slate-800">{filteredCategories.length.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Ending Balance</p>
          <p className={`text-2xl font-black ${totalEnding < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
            {totalEnding.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden transition-all duration-300 ${loading && products.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
        {!loading && filteredCategories.length === 0 ? (
          <NoData />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse min-w-[540px] text-center">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3.5 px-2 w-[48px]">#</th>
                    <th className="py-3.5 px-3 w-[34%]">Category</th>
                    <th className="py-3.5 px-3 w-[18%]">Products</th>
                    <th className="py-3.5 px-3 w-[28%] bg-indigo-50/50 text-indigo-900">Ending Balance</th>
                    <th className="py-3.5 px-2 w-[56px]">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {paginatedCategories.map((item, index) => {
                    const globalIdx = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr
                        key={item.category}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        onClick={() => setSelectedCategory(item.category)}
                      >
                        <td className="py-3.5 px-2 text-slate-400 font-bold">{globalIdx}</td>
                        <td className="py-3.5 px-3 font-bold text-slate-800 truncate" title={item.category}>
                          {item.category}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600">{item.productCount.toLocaleString('en-US')}</td>
                        <td className="py-3.5 px-3 font-black text-sm bg-indigo-50/30 text-indigo-900">
                          {item.endingStock.toLocaleString('en-US')}
                        </td>
                        <td className="py-3.5 px-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCategory(item.category);
                            }}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View category products"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-black uppercase">
                    <td colSpan={3} className="py-3.5 px-3 text-right text-slate-500">Total</td>
                    <td className="py-3.5 px-3 text-sm bg-indigo-50/40 text-indigo-900">
                      {totalEnding.toLocaleString('en-US')}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
                <div>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
