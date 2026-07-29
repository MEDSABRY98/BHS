'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search, Package, TrendingUp, TrendingDown, RefreshCcw,
  FileSpreadsheet, Calendar, Eye, X, ArrowUpRight, ArrowDownLeft,
  Layers, Filter, Box, ChevronLeft, ChevronRight, ChevronDown, Check, CalendarCheck, MapPin
} from 'lucide-react';
import TabLoader from '@/app/Components/TabLoader';
import NoData from '@/app/Components/NoDataTab';
import { getProductsBalanceReportData } from '../Service/inventory_service';
import type { ProductBalanceRow } from '../Service/inventory_types';
import { INTERNAL_WAREHOUSES_SORTED } from '../Utils/locationTypes';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import InventoryProductsBalanceDetailsTab from './InventoryProductsBalanceDetailsTab';

type BalanceFilter = 'All' | 'Positive' | 'Negative' | 'Zero';

const BALANCE_FILTER_OPTIONS: { value: BalanceFilter; label: string }[] = [
  { value: 'All', label: 'All Balances' },
  { value: 'Positive', label: 'Positive (> 0)' },
  { value: 'Negative', label: 'Negative (< 0)' },
  { value: 'Zero', label: 'Zero (= 0)' },
];

export default function InventoryProductsBalanceTab() {
  const [data, setData] = useState<ProductBalanceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedBalanceFilter, setSelectedBalanceFilter] = useState<BalanceFilter>('All');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [appliedDateFrom, setAppliedDateFrom] = useState<string>('');
  const [appliedDateTo, setAppliedDateTo] = useState<string>('');

  // Selected Product Modal State
  const [selectedProduct, setSelectedProduct] = useState<ProductBalanceRow | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const fetchRequestId = useRef(0);

  useEffect(() => {
    fetchReport(appliedDateFrom, appliedDateTo, selectedLocation);
  }, [appliedDateFrom, appliedDateTo, selectedLocation]);

  const fetchReport = async (from = appliedDateFrom, to = appliedDateTo, location = selectedLocation) => {
    const requestId = ++fetchRequestId.current;
    try {
      setLoading(true);
      const res = await getProductsBalanceReportData({
        dateFrom: from,
        dateTo: to,
        location: location !== 'All' ? location : undefined,
      });
      if (requestId !== fetchRequestId.current) return;
      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch inventory balance data');
      }
      setData(res.data || []);
      setError(null);
    } catch (err: any) {
      if (requestId !== fetchRequestId.current) return;
      console.error('Error fetching Products Balance:', err);
      setError(err.message || 'Failed to load report data');
    } finally {
      if (requestId === fetchRequestId.current) {
        setLoading(false);
      }
    }
  };

  const handleApplyDateFilter = () => {
    setAppliedDateFrom(dateFrom);
    setAppliedDateTo(dateTo);
    setCurrentPage(1);
  };

  const hasPendingDateChanges = dateFrom !== appliedDateFrom || dateTo !== appliedDateTo;

  // Custom Searchable Category Dropdown State
  const [isLocationOpen, setIsLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const locationRef = useRef<HTMLDivElement>(null);

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const categoryRef = useRef<HTMLDivElement>(null);

  const [isBalanceFilterOpen, setIsBalanceFilterOpen] = useState(false);
  const balanceFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
        setIsLocationOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
      if (balanceFilterRef.current && !balanceFilterRef.current.contains(event.target as Node)) {
        setIsBalanceFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const locations = useMemo(() => ['All', ...INTERNAL_WAREHOUSES_SORTED], []);

  const filteredLocations = useMemo(() => {
    if (!locationSearch.trim()) return locations;
    const q = locationSearch.toLowerCase().trim();
    return locations.filter((loc) => loc.toLowerCase().includes(q));
  }, [locations, locationSearch]);

  // Extract unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    data.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [data]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase().trim()));
  }, [categories, categorySearch]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return data.filter(item => {
      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      // Ending balance filter
      if (selectedBalanceFilter === 'Positive' && item.endingStock <= 0) {
        return false;
      }
      if (selectedBalanceFilter === 'Negative' && item.endingStock >= 0) {
        return false;
      }
      if (selectedBalanceFilter === 'Zero' && item.endingStock !== 0) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.productName.toLowerCase().includes(q);
        const matchesCode = item.productId.toLowerCase().includes(q);
        const matchesBarcode = item.barcode.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesBarcode && !matchesCategory) {
          return false;
        }
      }
      return true;
    });
  }, [data, selectedCategory, selectedBalanceFilter, searchQuery]);

  // KPI Metrics Calculation
  const metrics = useMemo(() => {
    return filteredProducts.reduce(
      (acc, item) => {
        acc.openingStock += item.openingStock;
        acc.netVendors += item.netVendors;
        acc.netCustomers += item.netCustomers;
        acc.netProduction += item.netProduction;
        acc.netAdjustment += item.netAdjustment;
        acc.endingStock += item.endingStock;
        return acc;
      },
      {
        openingStock: 0,
        netVendors: 0,
        netCustomers: 0,
        netProduction: 0,
        netAdjustment: 0,
        endingStock: 0,
      }
    );
  }, [filteredProducts]);

  // Export Table to Excel
  const handleExportExcel = async () => {
    const headers = [
      '#',
      'Product Code',
      'Barcode',
      'Product Name',
      'Category',
      'Opening Stock',
      'Net Purchases (Vendors)',
      'Net Sales (Customers)',
      'Net Production & Sub.',
      'Net Adjustment',
      'Ending Stock Balance',
    ];

    const rows = filteredProducts.map((item, index) => [
      index + 1,
      item.productId,
      item.barcode || '-',
      item.productName,
      item.category || '-',
      item.openingStock,
      item.netVendors,
      item.netCustomers,
      item.netProduction,
      item.netAdjustment,
      item.endingStock,
    ]);

    rows.push([
      '',
      '',
      '',
      'TOTALS',
      '',
      metrics.openingStock,
      metrics.netVendors,
      metrics.netCustomers,
      metrics.netProduction,
      metrics.netAdjustment,
      metrics.endingStock,
    ]);

    const filename = `inventory_products_balance_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Products Balance',
      numericColumns: [
        'Opening Stock',
        'Net Purchases (Vendors)',
        'Net Sales (Customers)',
        'Net Production & Sub.',
        'Net Adjustment',
        'Ending Stock Balance',
      ],
    });
  };

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const renderBadge = (val: number | undefined | null, isSales = false) => {
    const n = Number(val) || 0;
    if (n === 0) return <span className="text-slate-400 font-medium">0</span>;

    // For sales: negative value means items went out (sold)
    const isPositive = n > 0;
    const formatted = n.toLocaleString('en-US');

    return (
      <span
        className={`inline-flex items-center gap-1 font-bold text-sm ${
          isPositive ? 'text-emerald-600' : 'text-rose-600'
        }`}
      >
        {isPositive ? `+${formatted}` : formatted}
      </span>
    );
  };

  if (loading && data.length === 0) return <TabLoader />;

  // Render Full Page Details Tab View if a product is selected
  if (selectedProduct) {
    return (
      <InventoryProductsBalanceDetailsTab
        selectedProduct={selectedProduct}
        dateFrom={appliedDateFrom}
        dateTo={appliedDateTo}
        location={selectedLocation !== 'All' ? selectedLocation : undefined}
        onBack={() => setSelectedProduct(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Box className="w-5 h-5 text-indigo-600" />
            Products Inventory Balance & Period Movement
          </h2>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* Search Bar */}
          <div className="relative flex items-center h-11 w-full sm:w-64 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
            <input
              type="text"
              placeholder="Search Name, Code, Barcode..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Location Dropdown */}
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
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search location..."
                    value={locationSearch}
                    onChange={e => setLocationSearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                    autoFocus
                  />
                  {locationSearch && (
                    <button
                      onClick={() => setLocationSearch('')}
                      className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 text-xs">
                  {filteredLocations.length === 0 ? (
                    <div className="p-3 text-center text-xs font-semibold text-slate-400">
                      No location found
                    </div>
                  ) : (
                    filteredLocations.map(loc => {
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
                            isSelected
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="truncate" title={label}>{label}</span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Custom Searchable Category Dropdown */}
          <div className="relative w-full sm:w-56" ref={categoryRef}>
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs cursor-pointer ${
                isCategoryOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Category: <strong className="text-indigo-900 font-bold">{selectedCategory}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isCategoryOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {isCategoryOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2.5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search Bar inside Dropdown */}
                <div className="relative flex items-center h-9 bg-slate-50 border border-slate-200 rounded-xl px-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Search category..."
                    value={categorySearch}
                    onChange={e => setCategorySearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
                    autoFocus
                  />
                  {categorySearch && (
                    <button
                      onClick={() => setCategorySearch('')}
                      className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Categories Scrollable List */}
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 text-xs">
                  {filteredCategories.length === 0 ? (
                    <div className="p-3 text-center text-xs font-semibold text-slate-400">
                      No category found
                    </div>
                  ) : (
                    filteredCategories.map(cat => {
                      const isSelected = selectedCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat);
                            setCurrentPage(1);
                            setIsCategoryOpen(false);
                            setCategorySearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="truncate">{cat}</span>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ending Balance Filter */}
          <div className="relative w-full sm:w-52" ref={balanceFilterRef}>
            <button
              type="button"
              onClick={() => setIsBalanceFilterOpen(!isBalanceFilterOpen)}
              className={`w-full flex items-center justify-between h-11 bg-slate-50/80 hover:bg-slate-100/60 border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs cursor-pointer ${
                isBalanceFilterOpen ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/20' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Layers className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-700 truncate">
                  Balance: <strong className="text-indigo-900 font-bold">{selectedBalanceFilter}</strong>
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isBalanceFilterOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {isBalanceFilterOpen && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="space-y-0.5 text-xs">
                  {BALANCE_FILTER_OPTIONS.map(option => {
                    const isSelected = selectedBalanceFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setSelectedBalanceFilter(option.value);
                          setCurrentPage(1);
                          setIsBalanceFilterOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="truncate">{option.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Date From */}
          <div className="relative flex items-center h-11 w-full sm:w-56 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1.5 uppercase">From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>

          {/* Date To */}
          <div className="relative flex items-center h-11 w-full sm:w-56 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <span className="text-[11px] font-bold text-slate-400 shrink-0 mr-1.5 uppercase">To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
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
              onClick={() => fetchReport()}
              disabled={loading}
              className="h-11 w-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {loading && data.length > 0 && (
          <p className="text-xs font-semibold text-indigo-600 flex items-center gap-2">
            <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
            Updating balance columns for the selected date range...
          </p>
        )}

        {error && (
          <p className="text-xs font-semibold text-rose-600">{error}</p>
        )}
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Opening Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Opening Stock</p>
            <p className="text-2xl font-black text-slate-800">
              {metrics.openingStock.toLocaleString('en-US')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Net Purchases */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net Purchases (Vendors)</p>
            <p className="text-2xl font-black text-emerald-600">
              {metrics.netVendors >= 0 ? `+${metrics.netVendors.toLocaleString('en-US')}` : metrics.netVendors.toLocaleString('en-US')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
        </div>

        {/* Net Sales */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Net Sales (Customers)</p>
            <p className="text-2xl font-black text-rose-600">
              {metrics.netCustomers.toLocaleString('en-US')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        {/* Ending Stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ending Stock Balance</p>
            <p className="text-2xl font-black text-indigo-600">
              {metrics.endingStock.toLocaleString('en-US')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className={`bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden transition-all duration-300 ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
        {filteredProducts.length === 0 ? (
          <NoData />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1150px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3.5 px-3 text-center w-12">#</th>
                    <th className="py-3.5 px-3 text-center w-36">Product Code</th>
                    <th className="py-3.5 px-4 text-center min-w-[260px]">Product Name</th>
                    <th className="py-3.5 px-3 text-center w-36">Category</th>
                    <th className="py-3.5 px-3 text-center w-28 bg-slate-100/60">Opening</th>
                    <th className="py-3.5 px-3 text-center w-28">Net Vendors</th>
                    <th className="py-3.5 px-3 text-center w-28">Net Sales</th>
                    <th className="py-3.5 px-3 text-center w-32">Net Production & Sub.</th>
                    <th className="py-3.5 px-3 text-center w-28 bg-amber-50/60 text-amber-800">Net Adjustment</th>
                    <th className="py-3.5 px-3 text-center w-32 bg-indigo-50/50 text-indigo-900">Ending Balance</th>
                    <th className="py-3.5 px-2 text-center w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {paginatedProducts.map((item, index) => {
                    const globalIdx = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-bold">{globalIdx}</td>
                        <td className="py-3.5 px-3 text-center font-mono text-slate-600 text-[11px]">
                          {item.barcode || item.productId}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800 truncate max-w-[280px]" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="py-3.5 px-3 text-center text-slate-500 font-medium">
                          <span className="inline-block px-2.5 py-0.5 bg-slate-100 rounded-md text-[11px] truncate max-w-[130px]" title={item.category}>
                            {item.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold bg-slate-50/50 text-slate-800">
                          {item.openingStock.toLocaleString('en-US')}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {renderBadge(item.netVendors)}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {renderBadge(item.netCustomers, true)}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          {renderBadge(item.netProduction)}
                        </td>
                        <td className="py-3.5 px-3 text-center bg-amber-50/20">
                          {renderBadge(item.netAdjustment)}
                        </td>
                        <td className="py-3.5 px-3 text-center font-black text-sm bg-indigo-50/30 text-indigo-900">
                          {item.endingStock.toLocaleString('en-US')}
                        </td>
                        <td className="py-3.5 px-2 text-center">
                          <button
                            onClick={() => setSelectedProduct(item)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-lg transition-all"
                            title="View Product Movements Ledger"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
                <div>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} items
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
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
