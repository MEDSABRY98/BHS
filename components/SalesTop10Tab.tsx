'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Package, Users, ArrowUp, ArrowDown, Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, Filter, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SalesTop10TabProps {
  data: SalesInvoice[];
  loading: boolean;
}

type SortDirection = 'asc' | 'desc';

export default function SalesTop10Tab({ data, loading }: SalesTop10TabProps) {
  const [topCount, setTopCount] = useState<number>(10);
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

  // Sorting states for products
  const [productSortBy, setProductSortBy] = useState<'amount' | 'qty'>('amount');
  const [productSortDirection, setProductSortDirection] = useState<SortDirection>('desc');

  // Sorting states for customers
  const [customerSortBy, setCustomerSortBy] = useState<'amount' | 'qty'>('amount');
  const [customerSortDirection, setCustomerSortDirection] = useState<SortDirection>('desc');

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

  // Products data - grouped by PRODUCT ID
  const productsData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    const productMap = new Map<string, {
      productId: string;
      barcodes: Set<string>;
      products: string[];
      totalAmount: number;
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();

    filteredData.forEach(item => {
      const key = item.productId || item.barcode || item.product;
      const existing = productMap.get(key) || {
        productId: item.productId || '',
        barcodes: new Set<string>(),
        products: [],
        totalAmount: 0,
        totalQty: 0,
        invoiceNumbers: new Set<string>()
      };

      // Add barcode if it exists
      if (item.barcode) {
        existing.barcodes.add(item.barcode);
      }

      // Add product name if not already in the list
      if (!existing.products.includes(item.product)) {
        existing.products.push(item.product);
      }

      existing.totalAmount += item.amount;
      existing.totalQty += item.qty;

      // Add invoice number for transaction count
      if (item.invoiceNumber) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }

      productMap.set(key, existing);
    });

    return Array.from(productMap.values()).map(item => ({
      productId: item.productId,
      barcode: Array.from(item.barcodes).join(', ') || '-',
      products: item.products,
      totalAmount: item.totalAmount,
      totalQty: item.totalQty,
      transactions: item.invoiceNumbers.size
    }));
  }, [filteredData]);

  // Customers data - grouped by customerId, display customerName
  const customersData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      totalAmount: number;
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();

    filteredData.forEach(item => {
      const key = item.customerId || item.customerName; // Fallback to customerName if customerId is missing
      const existing = customerMap.get(key);

      if (!existing) {
        customerMap.set(key, {
          customerId: key,
          customerName: item.customerName,
          totalAmount: 0,
          totalQty: 0,
          invoiceNumbers: new Set<string>()
        });
      }

      const customer = customerMap.get(key)!;
      customer.totalAmount += item.amount;
      customer.totalQty += item.qty;

      // Add invoice number for transaction count
      if (item.invoiceNumber) {
        customer.invoiceNumbers.add(item.invoiceNumber);
      }
    });

    return Array.from(customerMap.values()).map(item => ({
      customer: item.customerName, // Display customerName
      totalAmount: item.totalAmount,
      totalQty: item.totalQty,
      transactions: item.invoiceNumbers.size
    }));
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

  // Sorted and limited products
  const sortedProducts = useMemo(() => {
    let sorted = [...productsData];

    if (productSortBy === 'amount') {
      sorted.sort((a, b) =>
        productSortDirection === 'asc'
          ? a.totalAmount - b.totalAmount
          : b.totalAmount - a.totalAmount
      );
    } else {
      sorted.sort((a, b) =>
        productSortDirection === 'asc'
          ? a.totalQty - b.totalQty
          : b.totalQty - a.totalQty
      );
    }

    return sorted.slice(0, topCount);
  }, [productsData, productSortBy, productSortDirection, topCount]);

  // Sorted and limited customers
  const sortedCustomers = useMemo(() => {
    let sorted = [...customersData];

    if (customerSortBy === 'amount') {
      sorted.sort((a, b) =>
        customerSortDirection === 'asc'
          ? a.totalAmount - b.totalAmount
          : b.totalAmount - a.totalAmount
      );
    } else {
      sorted.sort((a, b) =>
        customerSortDirection === 'asc'
          ? a.totalQty - b.totalQty
          : b.totalQty - a.totalQty
      );
    }

    return sorted.slice(0, topCount);
  }, [customersData, customerSortBy, customerSortDirection, topCount]);

  const toggleProductSortDirection = () => {
    setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
  };

  const toggleCustomerSortDirection = () => {
    setCustomerSortDirection(customerSortDirection === 'asc' ? 'desc' : 'asc');
  };

  // Calculate totals for customers
  const customerTotals = useMemo(() => {
    if (sortedCustomers.length === 0) {
      return { totalAmount: 0, totalQty: 0, totalTransactions: 0 };
    }
    return {
      totalAmount: sortedCustomers.reduce((sum, item) => sum + item.totalAmount, 0),
      totalQty: sortedCustomers.reduce((sum, item) => sum + item.totalQty, 0),
      totalTransactions: sortedCustomers.reduce((sum, item) => sum + item.transactions, 0),
    };
  }, [sortedCustomers]);

  // Calculate totals for products
  const productTotals = useMemo(() => {
    if (sortedProducts.length === 0) {
      return { totalAmount: 0, totalQty: 0, totalTransactions: 0 };
    }
    return {
      totalAmount: sortedProducts.reduce((sum, item) => sum + item.totalAmount, 0),
      totalQty: sortedProducts.reduce((sum, item) => sum + item.totalQty, 0),
      totalTransactions: sortedProducts.reduce((sum, item) => sum + item.transactions, 0),
    };
  }, [sortedProducts]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Customers
    const customerHeaders = ['#', 'Customer', 'Amount', 'Qty', 'Transactions'];
    const customerRows = sortedCustomers.map((item, index) => [
      index + 1,
      item.customer,
      item.totalAmount.toFixed(2),
      item.totalQty.toFixed(0),
      item.transactions
    ]);

    // Add total row
    if (sortedCustomers.length > 0) {
      customerRows.push([
        '',
        'Total',
        customerTotals.totalAmount.toFixed(2),
        customerTotals.totalQty.toFixed(0),
        customerTotals.totalTransactions
      ]);
    }

    const customerData = [customerHeaders, ...customerRows];
    const customerSheet = XLSX.utils.aoa_to_sheet(customerData);
    XLSX.utils.book_append_sheet(workbook, customerSheet, 'Customers');

    // Sheet 2: Products
    const productHeaders = ['#', 'BARCODE', 'Product', 'Amount', 'Qty', 'Transactions'];
    const productRows = sortedProducts.map((item, index) => [
      index + 1,
      item.barcode,
      item.products.join(', '), // Join multiple product names with comma
      item.totalAmount.toFixed(2),
      item.totalQty.toFixed(0),
      item.transactions
    ]);

    // Add total row
    if (sortedProducts.length > 0) {
      productRows.push([
        '',
        '',
        'Total',
        productTotals.totalAmount.toFixed(2),
        productTotals.totalQty.toFixed(0),
        productTotals.totalTransactions
      ]);
    }

    const productData = [productHeaders, ...productRows];
    const productSheet = XLSX.utils.aoa_to_sheet(productData);
    XLSX.utils.book_append_sheet(workbook, productSheet, 'Products');

    // Write and download
    const filename = `sales_top10_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-800">TOP10</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 group ${(filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMarket || filterMerchandiser || filterSalesRep)
                  ? 'bg-green-600 text-white shadow-lg shadow-green-200 ring-2 ring-green-500/20'
                  : 'bg-white text-gray-600 border border-gray-200 shadow-sm hover:border-green-500 hover:text-green-600'
                  }`}
              >
                <Filter className={`w-5 h-5 ${(filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMarket || filterMerchandiser || filterSalesRep) ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                <span className="text-sm font-bold uppercase tracking-wider">Filters</span>
              </button>

              <button
                onClick={exportToExcel}
                className="p-2.5 rounded-full bg-green-600 text-white hover:bg-green-700 transition-all duration-300 shadow-lg shadow-green-200"
                title="Export to Excel"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl shadow-sm border border-gray-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Display</label>
            <input
              type="number"
              min="1"
              max="100"
              value={topCount}
              onChange={(e) => setTopCount(Number(e.target.value))}
              className="w-12 text-center font-bold text-slate-700 focus:outline-none"
            />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-l pl-3">Results</span>
          </div>
        </div>

        {/* Filters Modal */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFilterModalOpen(false)} />
            <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-white/20 animate-in fade-in zoom-in duration-300 overflow-hidden">
              {/* Header */}
              <div className="px-8 py-6 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-green-100 rounded-2xl">
                    <Filter className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-gray-800 tracking-tight">Top 10 Filters</h2>
                  </div>
                </div>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-8 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] min-h-[550px]">
                <div className="space-y-12 pb-60">
                  {/* Row 1: Time */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-indigo-500" /> 01. Time Period
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-6 rounded-[24px] border border-slate-100">
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Year</label>
                        <input value={filterYear} onChange={e => setFilterYear(e.target.value)} type="number" placeholder="YYYY" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold shadow-sm" />
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">Month</label>
                        <input value={filterMonth} onChange={e => setFilterMonth(e.target.value)} type="number" placeholder="1-12" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold shadow-sm" />
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">From</label>
                        <input value={dateFrom} onChange={e => setDateFrom(e.target.value)} type="date" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold shadow-sm" />
                      </div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase ml-1">To</label>
                        <input value={dateTo} onChange={e => setDateTo(e.target.value)} type="date" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold shadow-sm" />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Categorization */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-emerald-500" /> 02. Categorization
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 bg-emerald-50/30 p-8 rounded-[24px] border border-emerald-100/50">
                      {/* Area */}
                      <div className="relative" ref={areaDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block">Area</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'area' ? null : 'area')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 shadow-sm">
                          {filterArea || 'All Areas'} <ChevronDown className={`w-5 h-5 transition-transform ${openDropdown === 'area' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'area' && (
                          <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-1.5 min-h-[100px] bg-white">
                            <button onClick={() => { setFilterArea(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm">All Areas</button>
                            {uniqueAreas.map(a => <button key={a} onClick={() => { setFilterArea(a); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm border-t border-slate-50">{a}</button>)}
                          </div>
                        )}
                      </div>
                      {/* Sales Rep */}
                      <div className="relative" ref={salesRepDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block">Sales Rep</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'salesrep' ? null : 'salesrep')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 shadow-sm">
                          {filterSalesRep || 'All Representatives'} <ChevronDown className={`w-5 h-5 transition-transform ${openDropdown === 'salesrep' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'salesrep' && (
                          <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-1.5 min-h-[100px] bg-white">
                            <button onClick={() => { setFilterSalesRep(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm">All Reps</button>
                            {uniqueSalesReps.map(r => <button key={r} onClick={() => { setFilterSalesRep(r); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm border-t border-slate-50">{r}</button>)}
                          </div>
                        )}
                      </div>
                      {/* Market */}
                      <div className="relative" ref={marketDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block">Market</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'market' ? null : 'market')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 shadow-sm">
                          {filterMarket || 'All Markets'} <ChevronDown className={`w-5 h-5 transition-transform ${openDropdown === 'market' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'market' && (
                          <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-1.5 min-h-[100px] bg-white">
                            <button onClick={() => { setFilterMarket(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm">All Markets</button>
                            {uniqueMarkets.map(m => <button key={m} onClick={() => { setFilterMarket(m); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm border-t border-slate-50">{m}</button>)}
                          </div>
                        )}
                      </div>
                      {/* Merchandiser */}
                      <div className="relative" ref={merchandiserDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase ml-1 mb-2 block">Merchandiser</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'merchandiser' ? null : 'merchandiser')} className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between font-bold text-slate-700 shadow-sm">
                          {filterMerchandiser || 'All Merchandisers'} <ChevronDown className={`w-5 h-5 transition-transform ${openDropdown === 'merchandiser' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'merchandiser' && (
                          <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden p-1.5 min-h-[100px] bg-white">
                            <button onClick={() => { setFilterMerchandiser(''); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm">All Merchandisers</button>
                            {uniqueMerchandisers.map(m => <button key={m} onClick={() => { setFilterMerchandiser(m); setOpenDropdown(null); }} className="w-full text-left px-4 py-3 hover:bg-emerald-50 rounded-xl font-bold text-sm border-t border-slate-50">{m}</button>)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <button
                  onClick={() => {
                    setFilterYear(''); setFilterMonth(''); setDateFrom(''); setDateTo('');
                    setFilterArea(''); setFilterMarket(''); setFilterMerchandiser(''); setFilterSalesRep('');
                  }}
                  className="text-[11px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Clear All Filters
                </button>
                <button onClick={() => setIsFilterModalOpen(false)} className="px-10 py-3.5 bg-green-600 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all">
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customers Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Top Customers</h2>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Top {topCount} Customers
              </h3>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={customerSortBy}
                  onChange={(e) => setCustomerSortBy(e.target.value as 'amount' | 'qty')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm font-medium"
                >
                  <option value="amount">Value (Amount)</option>
                  <option value="qty">Quantity</option>
                </select>
                <button
                  onClick={toggleCustomerSortDirection}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Toggle sort direction"
                >
                  {customerSortDirection === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCustomers.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{index + 1}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center">{item.customer}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                        {item.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                        {item.totalQty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
                    </tr>
                  ))}
                  {sortedCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No data available
                      </td>
                    </tr>
                  )}
                  {sortedCustomers.length > 0 && (
                    <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                      <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={2}>Total</td>
                      <td className="py-3 px-4 text-sm text-gray-800 text-center">
                        {customerTotals.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 text-center">
                        {customerTotals.totalQty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 text-center">
                        {customerTotals.totalTransactions}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Top Products</h2>
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                Top {topCount} Products
              </h3>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Sort by:</label>
                <select
                  value={productSortBy}
                  onChange={(e) => setProductSortBy(e.target.value as 'amount' | 'qty')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-medium"
                >
                  <option value="amount">Value (Amount)</option>
                  <option value="qty">Quantity</option>
                </select>
                <button
                  onClick={toggleProductSortDirection}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Toggle sort direction"
                >
                  {productSortDirection === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">BARCODE</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{index + 1}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center font-mono">{item.barcode}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center">
                        <div className="flex flex-col gap-1">
                          {item.products.map((product, idx) => (
                            <div key={idx}>{product}</div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                        {item.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                        {item.totalQty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
                    </tr>
                  ))}
                  {sortedProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No data available
                      </td>
                    </tr>
                  )}
                  {sortedProducts.length > 0 && (
                    <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                      <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={3}>Total</td>
                      <td className="py-3 px-4 text-sm text-gray-800 text-center">
                        {productTotals.totalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 text-center">
                        {productTotals.totalQty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 text-center">
                        {productTotals.totalTransactions}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

