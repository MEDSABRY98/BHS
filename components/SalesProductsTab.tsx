'use client';

import { useState, useMemo, useEffect, memo, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Package, ChevronLeft, ChevronRight, Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, Filter, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesProductDetails from './SalesProductDetails';

interface SalesProductsTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const ProductRow = memo(({ item, rowNumber, onBarcodeClick }: { item: { barcode: string; product: string; amount: number; qty: number; transactions: number }; rowNumber: number; onBarcodeClick: (barcode: string) => void }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{rowNumber}</td>
      <td
        className="py-3 px-4 text-sm text-gray-800 font-medium text-center cursor-pointer hover:text-green-600 hover:underline"
        onClick={() => item.barcode && onBarcodeClick(item.barcode)}
      >
        {item.barcode || '-'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center">{item.product}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
    </tr>
  );
});

ProductRow.displayName = 'ProductRow';

export default function SalesProductsTab({ data, loading }: SalesProductsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const [filterMerchandiser, setFilterMerchandiser] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'area' | 'market' | 'merchandiser' | 'salesrep' | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const hasActiveFilters = Boolean(filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMarket || filterMerchandiser || filterSalesRep);

  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const marketDropdownRef = useRef<HTMLDivElement>(null);
  const merchandiserDropdownRef = useRef<HTMLDivElement>(null);
  const salesRepDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(prev => prev === 'area' ? null : prev);
      }
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(prev => prev === 'market' ? null : prev);
      }
      if (merchandiserDropdownRef.current && !merchandiserDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(prev => prev === 'merchandiser' ? null : prev);
      }
      if (salesRepDropdownRef.current && !salesRepDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(prev => prev === 'salesrep' ? null : prev);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter data based on filters
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Year filter
    if (filterYear.trim()) {
      const yearNum = parseInt(filterYear.trim(), 10);
      if (!isNaN(yearNum)) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          try {
            const date = new Date(item.invoiceDate);
            return !isNaN(date.getTime()) && date.getFullYear() === yearNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Month filter
    if (filterMonth.trim()) {
      const monthNum = parseInt(filterMonth.trim(), 10);
      if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
        filtered = filtered.filter(item => {
          if (!item.invoiceDate) return false;
          try {
            const date = new Date(item.invoiceDate);
            return !isNaN(date.getTime()) && date.getMonth() + 1 === monthNum;
          } catch (e) {
            return false;
          }
        });
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filtered = filtered.filter(item => {
        if (!item.invoiceDate) return false;
        try {
          const itemDate = new Date(item.invoiceDate);
          if (isNaN(itemDate.getTime())) return false;

          if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (itemDate < fromDate) return false;
          }

          if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (itemDate > toDate) return false;
          }

          return true;
        } catch (e) {
          return false;
        }
      });
    }

    // Area filter
    if (filterArea) {
      filtered = filtered.filter(item => item.area === filterArea);
    }

    // Merchandiser filter
    if (filterMerchandiser) {
      filtered = filtered.filter(item => item.merchandiser === filterMerchandiser);
    }

    // SalesRep filter
    if (filterSalesRep) {
      filtered = filtered.filter(item => item.salesRep === filterSalesRep);
    }

    // Market filter
    if (filterMarket) {
      filtered = filtered.filter(item => item.market === filterMarket);
    }

    return filtered;
  }, [data, filterYear, filterMonth, dateFrom, dateTo, filterArea, filterMarket, filterMerchandiser, filterSalesRep]);

  // Group data by product ID
  const productsData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    const productMap = new Map<string, {
      barcode: string;
      product: string;
      totalAmount: number;
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();

    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      const key = item.productId || item.barcode || item.product;
      let existing = productMap.get(key);

      if (!existing) {
        existing = {
          barcode: item.barcode || '',
          product: item.product,
          totalAmount: 0,
          totalQty: 0,
          invoiceNumbers: new Set<string>()
        };
        productMap.set(key, existing);
      }

      existing.totalAmount += item.amount;
      existing.totalQty += item.qty;

      // Add invoice number for transaction count (only invoices starting with "SAL")
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }
    }

    // Pre-calculate array length
    const result = new Array(productMap.size);
    let index = 0;

    productMap.forEach(item => {
      result[index++] = {
        barcode: item.barcode,
        product: item.product,
        amount: item.totalAmount,
        qty: item.totalQty,
        transactions: item.invoiceNumbers.size
      };
    });

    return result;
  }, [filteredData]);

  // Get unique values for dropdown filters
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    data.forEach(item => {
      if (item.area && item.area.trim()) {
        areas.add(item.area.trim());
      }
    });
    return Array.from(areas).sort();
  }, [data]);

  const uniqueMarkets = useMemo(() => {
    const markets = new Set<string>();
    data.forEach(item => {
      if (item.market && item.market.trim()) {
        markets.add(item.market.trim());
      }
    });
    return Array.from(markets).sort();
  }, [data]);

  const uniqueMerchandisers = useMemo(() => {
    const merchandisers = new Set<string>();
    data.forEach(item => {
      if (item.merchandiser && item.merchandiser.trim()) {
        merchandisers.add(item.merchandiser.trim());
      }
    });
    return Array.from(merchandisers).sort();
  }, [data]);

  const uniqueSalesReps = useMemo(() => {
    const salesReps = new Set<string>();
    data.forEach(item => {
      if (item.salesRep && item.salesRep.trim()) {
        salesReps.add(item.salesRep.trim());
      }
    });
    return Array.from(salesReps).sort();
  }, [data]);

  // Filter and sort products - optimized
  const filteredProducts = useMemo(() => {
    if (productsData.length === 0) return [];

    let filtered: typeof productsData;

    // Apply search filter using debounced query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = productsData.filter(item =>
        item.product.toLowerCase().includes(query) ||
        item.barcode.toLowerCase().includes(query)
      );
    } else {
      filtered = productsData;
    }

    // Sort by amount descending (in-place for better performance)
    filtered.sort((a, b) => b.amount - a.amount);

    return filtered;
  }, [productsData, debouncedSearchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Calculate totals (for all filtered products, not just current page) - optimized single pass
  const totals = useMemo(() => {
    if (filteredProducts.length === 0) {
      return {
        totalAmount: 0,
        totalQty: 0,
        totalTransactions: 0
      };
    }

    // Single reduce pass instead of 3 separate reduces
    const result = filteredProducts.reduce((acc, item) => {
      acc.totalAmount += item.amount;
      acc.totalQty += item.qty;
      acc.totalTransactions += item.transactions;
      return acc;
    }, {
      totalAmount: 0,
      totalQty: 0,
      totalTransactions: 0
    });

    return result;
  }, [filteredProducts]);

  // Reset to first page when filtered products change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = ['#', 'Barcode', 'Product Name', 'Amount', 'Qty', 'Transactions'];

    // Use all filtered products (not just current page), same columns as table
    const rows = filteredProducts.map((item, index) => [
      index + 1,
      item.barcode || '-',
      item.product,
      item.amount.toFixed(2),
      item.qty.toFixed(0),
      item.transactions,
    ]);

    // Totals row (same logic as table footer)
    if (filteredProducts.length > 0) {
      rows.push([
        '',
        '',
        'Total',
        totals.totalAmount.toFixed(2),
        totals.totalQty.toFixed(0),
        totals.totalTransactions,
      ]);
    }

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');

    const filename = `sales_products_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products data...</p>
        </div>
      </div>
    );
  }

  // If a barcode is selected, show its details
  if (selectedBarcode) {
    return (
      <SalesProductDetails
        barcode={selectedBarcode}
        data={data}
        onBack={() => setSelectedBarcode(null)}
      />
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 relative">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black text-gray-800 tracking-tight">Products Analytics</h1>
          </div>

          {/* Centered Search Bar */}
          <div className="w-full md:absolute md:left-1/2 md:-translate-x-1/2 md:max-w-md lg:max-w-xl">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search products by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all font-medium text-gray-700 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto">
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 group ${hasActiveFilters
                ? 'bg-green-600 text-white shadow-lg shadow-green-200 ring-4 ring-green-500/10 border-green-500'
                : 'bg-white text-gray-600 border border-gray-200 shadow-sm hover:border-green-500 hover:text-green-600'
                }`}
            >
              <div className="relative">
                <Filter className={`w-5 h-5 ${hasActiveFilters ? 'animate-pulse text-white' : 'group-hover:scale-110 transition-transform'}`} />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-green-600 animate-bounce"></span>
                )}
              </div>
              <span className="text-sm font-bold uppercase tracking-wider">Filters</span>
            </button>

            <button
              onClick={exportToExcel}
              className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-green-200 shrink-0"
              title="Export to Excel"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFilterModalOpen(false)} />
            <div className="relative rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-white/10 animate-in fade-in zoom-in duration-300 overflow-hidden isolation-auto">
              {/* Modal Header */}
              <div className="px-10 py-8 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-2xl shadow-inner">
                    <Filter className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">Products Filters</h2>
                  </div>
                </div>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-3 hover:bg-gray-200 rounded-full transition-colors group">
                  <X className="w-7 h-7 text-gray-400 group-hover:text-gray-700 transition-colors" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-10 overflow-y-auto flex-1 bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="space-y-12 pb-20">
                  {/* 01. Time Period */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-indigo-500" /> 01. Time Period
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 bg-slate-50/50 p-8 rounded-[32px] border border-slate-100 shadow-sm">
                      <div className="space-y-2 text-slate-700">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Year</label>
                        <input value={filterYear} onChange={e => setFilterYear(e.target.value)} type="number" placeholder="YYYY" className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all outline-none" />
                      </div>
                      <div className="space-y-2 text-slate-700">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Month</label>
                        <input value={filterMonth} onChange={e => setFilterMonth(e.target.value)} type="number" placeholder="1-12" className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all outline-none" />
                      </div>
                      <div className="space-y-2 text-slate-700">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">From Date</label>
                        <input value={dateFrom} onChange={e => setDateFrom(e.target.value)} type="date" className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all outline-none text-slate-700" />
                      </div>
                      <div className="space-y-2 text-slate-700">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">To Date</label>
                        <input value={dateTo} onChange={e => setDateTo(e.target.value)} type="date" className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all outline-none text-slate-700" />
                      </div>
                    </div>
                  </div>

                  {/* 02. Categorization */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-emerald-500" /> 02. Categorization
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 bg-green-50/30 p-10 rounded-[32px] border border-green-100/50 shadow-sm text-slate-700">
                      {/* Area Dropdown */}
                      <div className="relative" ref={areaDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Territory / Area</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'area' ? null : 'area')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterArea ? 'text-slate-900' : 'text-slate-400'}>{filterArea || 'Select Area'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'area' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'area' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                              <button onClick={() => { setFilterArea(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Selection</button>
                              {uniqueAreas.map(a => <button key={a} onClick={() => { setFilterArea(a); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors uppercase">{a}</button>)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Sales Rep Dropdown */}
                      <div className="relative" ref={salesRepDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Account Executive</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'salesrep' ? null : 'salesrep')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterSalesRep ? 'text-slate-900' : 'text-slate-400'}>{filterSalesRep || 'Select Rep'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'salesrep' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'salesrep' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                              <button onClick={() => { setFilterSalesRep(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Selection</button>
                              {uniqueSalesReps.map(r => <button key={r} onClick={() => { setFilterSalesRep(r); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors uppercase">{r}</button>)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Market Dropdown */}
                      <div className="relative" ref={marketDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Market Category</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'market' ? null : 'market')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterMarket ? 'text-slate-900' : 'text-slate-400'}>{filterMarket || 'Select Market'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'market' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'market' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                              <button onClick={() => { setFilterMarket(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Selection</button>
                              {uniqueMarkets.map(m => <button key={m} onClick={() => { setFilterMarket(m); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors uppercase">{m}</button>)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Merchandiser Dropdown */}
                      <div className="relative" ref={merchandiserDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Store Merchandiser</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'merchandiser' ? null : 'merchandiser')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterMerchandiser ? 'text-slate-900' : 'text-slate-400'}>{filterMerchandiser || 'Select Merchandiser'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'merchandiser' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'merchandiser' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                              <button onClick={() => { setFilterMerchandiser(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Selection</button>
                              {uniqueMerchandisers.map(m => <button key={m} onClick={() => { setFilterMerchandiser(m); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors uppercase">{m}</button>)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    setFilterYear(''); setFilterMonth(''); setDateFrom(''); setDateTo('');
                    setFilterArea(''); setFilterMarket(''); setFilterMerchandiser(''); setFilterSalesRep('');
                  }}
                  className="px-6 py-4 text-[11px] font-black text-slate-400 hover:text-red-500 uppercase tracking-[0.2em] transition-all hover:bg-red-50 rounded-2xl"
                >
                  Clear All Filters
                </button>
                <button onClick={() => setIsFilterModalOpen(false)} className="px-12 py-4 bg-green-600 text-white font-black text-sm uppercase tracking-[0.2em] rounded-[20px] shadow-xl shadow-green-100 hover:bg-green-700 hover:scale-105 active:scale-95 transition-all outline-none">
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Barcode</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Product Name</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((item, index) => (
                  <ProductRow
                    key={`${item.barcode}-${item.product}-${startIndex + index}`}
                    item={item}
                    rowNumber={startIndex + index + 1}
                    onBarcodeClick={setSelectedBarcode}
                  />
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      {searchQuery ? 'No products found matching your search' : 'No data available'}
                    </td>
                  </tr>
                )}
                {filteredProducts.length > 0 && (
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                    <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={3}>Total</td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalQty.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalTransactions}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredProducts.length > ITEMS_PER_PAGE && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${currentPage === pageNum
                          ? 'bg-green-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

