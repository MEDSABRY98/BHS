'use client';

import { useState, useMemo, useEffect, memo, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Package, ChevronLeft, ChevronRight, Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown } from 'lucide-react';
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
  const [filterMerchandiser, setFilterMerchandiser] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'area' | 'merchandiser' | 'salesrep' | null>(null);
  
  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const merchandiserDropdownRef = useRef<HTMLDivElement>(null);
  const salesRepDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(prev => prev === 'area' ? null : prev);
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

    return filtered;
  }, [data, filterYear, filterMonth, dateFrom, dateTo, filterArea, filterMerchandiser, filterSalesRep]);

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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <button
            onClick={exportToExcel}
            className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
            title="Export to Excel"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Year Filter */}
            <div>
              <label htmlFor="filterYear" className="block text-sm font-medium text-gray-700 mb-1">
                Year
              </label>
              <input
                id="filterYear"
                type="number"
                placeholder="e.g., 2024"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                min="2000"
                max="2100"
              />
            </div>

            {/* Month Filter */}
            <div>
              <label htmlFor="filterMonth" className="block text-sm font-medium text-gray-700 mb-1">
                Month (1-12)
              </label>
              <input
                id="filterMonth"
                type="number"
                placeholder="e.g., 1-12"
                value={filterMonth}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                    setFilterMonth(value);
                  }
                }}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                min="1"
                max="12"
              />
            </div>

            {/* Date From */}
            <div>
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                From Date
              </label>
              <input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                To Date
              </label>
              <input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Dropdown Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {/* Area Filter */}
            <div className="relative" ref={areaDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                Area
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'area' ? null : 'area')}
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${
                    openDropdown === 'area'
                      ? 'border-green-500 ring-2 ring-green-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={filterArea ? 'text-gray-800' : 'text-gray-400'}>
                    {filterArea || 'All Areas'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                      openDropdown === 'area' ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {openDropdown === 'area' && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto">
                    <div
                      onClick={() => {
                        setFilterArea('');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                        filterArea === ''
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      All Areas
                    </div>
                    {uniqueAreas.map(area => (
                      <div
                        key={area}
                        onClick={() => {
                          setFilterArea(area);
                          setOpenDropdown(null);
                        }}
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${
                          filterArea === area
                            ? 'bg-green-50 text-green-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {area}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Merchandiser Filter */}
            <div className="relative" ref={merchandiserDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                Merchandiser
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'merchandiser' ? null : 'merchandiser')}
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${
                    openDropdown === 'merchandiser'
                      ? 'border-green-500 ring-2 ring-green-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={filterMerchandiser ? 'text-gray-800' : 'text-gray-400'}>
                    {filterMerchandiser || 'All Merchandisers'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                      openDropdown === 'merchandiser' ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {openDropdown === 'merchandiser' && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto">
                    <div
                      onClick={() => {
                        setFilterMerchandiser('');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                        filterMerchandiser === ''
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      All Merchandisers
                    </div>
                    {uniqueMerchandisers.map(merchandiser => (
                      <div
                        key={merchandiser}
                        onClick={() => {
                          setFilterMerchandiser(merchandiser);
                          setOpenDropdown(null);
                        }}
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${
                          filterMerchandiser === merchandiser
                            ? 'bg-green-50 text-green-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {merchandiser}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SalesRep Filter */}
            <div className="relative" ref={salesRepDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-green-600" />
                Sales Rep
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'salesrep' ? null : 'salesrep')}
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${
                    openDropdown === 'salesrep'
                      ? 'border-green-500 ring-2 ring-green-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={filterSalesRep ? 'text-gray-800' : 'text-gray-400'}>
                    {filterSalesRep || 'All Sales Reps'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                      openDropdown === 'salesrep' ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {openDropdown === 'salesrep' && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto">
                    <div
                      onClick={() => {
                        setFilterSalesRep('');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                        filterSalesRep === ''
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      All Sales Reps
                    </div>
                    {uniqueSalesReps.map(salesRep => (
                      <div
                        key={salesRep}
                        onClick={() => {
                          setFilterSalesRep(salesRep);
                          setOpenDropdown(null);
                        }}
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${
                          filterSalesRep === salesRep
                            ? 'bg-green-50 text-green-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {salesRep}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clear Filters Button */}
          {(filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMerchandiser || filterSalesRep) && (
            <div className="mt-3">
              <button
                onClick={() => {
                  setFilterYear('');
                  setFilterMonth('');
                  setDateFrom('');
                  setDateTo('');
                  setFilterArea('');
                  setFilterMerchandiser('');
                  setFilterSalesRep('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Search Box */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by product name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
        </div>

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
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          currentPage === pageNum
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

