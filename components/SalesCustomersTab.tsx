'use client';

import { useState, useMemo, useEffect, memo, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Users, ChevronLeft, ChevronRight, Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesCustomerDetails from './SalesCustomerDetails';

interface SalesCustomersTabProps {
  data: SalesInvoice[];
  loading: boolean;
  onUploadMapping?: (mapping: Record<string, any>) => void;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const CustomerRow = memo(({ item, rowNumber, onCustomerClick }: { item: { customer: string; totalAmount: number; totalQty: number; averageAmount: number; averageQty: number; productsCount: number; transactions: number }; rowNumber: number; onCustomerClick: (customer: string) => void }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{rowNumber}</td>
      <td
        className="py-3 px-4 text-sm text-gray-800 font-medium text-center cursor-pointer hover:text-green-600 hover:underline"
        onClick={() => onCustomerClick(item.customer)}
      >
        {item.customer}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.averageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.averageQty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.productsCount}</td>
    </tr>
  );
});

CustomerRow.displayName = 'CustomerRow';

export default function SalesCustomersTab({ data, loading, onUploadMapping }: SalesCustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const [filterMerchandiser, setFilterMerchandiser] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'area' | 'market' | 'merchandiser' | 'salesrep' | null>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'sub'>('main');

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
  }, [data, filterYear, filterMonth, dateFrom, dateTo, filterArea, filterMerchandiser, filterSalesRep, filterMarket]);

  // Group data by customerId - optimized
  const customersData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    const customerMap = new Map<string, {
      customerId: string;
      customer: string;
      merchandiser: string;
      salesRep: string;
      totalAmount: number;
      totalQty: number;
      barcodes: Set<string>;
      months: Set<string>;
      invoiceNumbers: Set<string>;
    }>();

    // Pre-compile date parsing to avoid repeated try-catch
    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];

      // Determine key and display name based on activeTab
      let key: string;
      let displayName: string;

      if (activeTab === 'main') {
        key = item.customerMainName || item.customerName || 'Unknown';
        displayName = item.customerMainName || item.customerName || 'Unknown';
      } else {
        key = item.customerId || item.customerName; // Use customerId for grouping, fallback to customerName
        displayName = item.customerName;
      }

      let existing = customerMap.get(key);

      if (!existing) {
        existing = {
          customerId: key,
          customer: displayName, // Display name based on tab
          merchandiser: item.merchandiser || '',
          salesRep: item.salesRep || '',
          totalAmount: 0,
          totalQty: 0,
          barcodes: new Set<string>(),
          months: new Set<string>(),
          invoiceNumbers: new Set<string>()
        };
        customerMap.set(key, existing);
      }

      existing.totalAmount += item.amount;
      existing.totalQty += item.qty;

      // Add invoice number for transaction count (only invoices starting with "SAL")
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);

        // Add product to count (only for invoices starting with "SAL")
        // Use productId || barcode || product as key to match SalesCustomerDetails logic
        const productKey = item.productId || item.barcode || item.product;
        existing.barcodes.add(productKey);
      }

      // Optimized date parsing
      if (item.invoiceDate) {
        const date = new Date(item.invoiceDate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const monthKey = `${year}-${month < 10 ? '0' : ''}${month}`;
          existing.months.add(monthKey);
        }
      }
    }

    // Pre-calculate array length
    const result = new Array(customerMap.size);
    let index = 0;

    // Get current date for calculating months span
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-based (0 = January)

    customerMap.forEach(item => {
      // Calculate months from first month to current month
      let totalMonths = 1;
      if (item.months.size > 0) {
        // Find earliest month
        const sortedMonths = Array.from(item.months).sort();
        const firstMonthKey = sortedMonths[0];
        const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);

        // Calculate months from first month to current month (inclusive)
        const firstDate = new Date(firstYear, firstMonth - 1, 1);
        const lastDate = new Date(currentYear, currentMonth, 1);

        // Calculate difference in months
        const yearsDiff = lastDate.getFullYear() - firstDate.getFullYear();
        const monthsDiff = lastDate.getMonth() - firstDate.getMonth();
        totalMonths = (yearsDiff * 12) + monthsDiff + 1; // +1 to include both start and end months
      }

      result[index++] = {
        customer: item.customer,
        totalAmount: item.totalAmount,
        totalQty: item.totalQty,
        averageAmount: item.totalAmount / totalMonths,
        averageQty: item.totalQty / totalMonths,
        productsCount: item.barcodes.size,
        transactions: item.invoiceNumbers.size
      };
    });

    return result;
  }, [filteredData, activeTab]);

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

  // Filter and sort customers - optimized
  const filteredCustomers = useMemo(() => {
    if (customersData.length === 0) return [];

    let filtered: typeof customersData;

    // Apply search filter using debounced query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = customersData.filter(item =>
        item.customer.toLowerCase().includes(query)
      );
    } else {
      filtered = customersData;
    }

    // Sort by amount descending (in-place for better performance)
    filtered.sort((a, b) => b.totalAmount - a.totalAmount);

    return filtered;
  }, [customersData, debouncedSearchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Calculate totals (for all filtered customers, not just current page) - optimized single pass
  const totals = useMemo(() => {
    if (filteredCustomers.length === 0) {
      return {
        totalAmount: 0,
        totalAverageAmount: 0,
        totalQty: 0,
        totalAverageQty: 0,
        totalProductsCount: 0,
        totalTransactions: 0
      };
    }

    // Single reduce pass instead of 5 separate reduces
    const result = filteredCustomers.reduce((acc, item) => {
      acc.totalAmount += item.totalAmount;
      acc.totalAverageAmount += item.averageAmount;
      acc.totalQty += item.totalQty;
      acc.totalAverageQty += item.averageQty;
      acc.totalProductsCount += item.productsCount;
      acc.totalTransactions += item.transactions;
      return acc;
    }, {
      totalAmount: 0,
      totalAverageAmount: 0,
      totalQty: 0,
      totalAverageQty: 0,
      totalProductsCount: 0,
      totalTransactions: 0
    });

    return result;
  }, [filteredCustomers]);

  // Reset to first page when filtered customers change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = [
      '#',
      'Customer Name',
      'Amount',
      'Average Amount',
      'Qty',
      'Average Qty',
      'Transactions',
      'Products Count',
    ];

    const rows = filteredCustomers.map((item, index) => [
      index + 1,
      item.customer,
      item.totalAmount.toFixed(2),
      item.averageAmount.toFixed(2),
      item.totalQty.toFixed(0),
      item.averageQty.toFixed(2),
      item.transactions,
      item.productsCount,
    ]);

    // Totals row (same as table footer)
    if (filteredCustomers.length > 0) {
      rows.push([
        '',
        'Total',
        totals.totalAmount.toFixed(2),
        totals.totalAverageAmount.toFixed(2),
        totals.totalQty.toFixed(0),
        totals.totalAverageQty.toFixed(2),
        totals.totalTransactions,
        totals.totalProductsCount,
      ]);
    }

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Customers');

    const filename = `sales_customers_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    setShowExportMenu(false);
  };

  const exportToExcelByMonths = () => {
    if (!data || data.length === 0) return;

    // Group data by customerId and month, but keep customerName for display
    const customerMonthMap = new Map<string, Map<string, { amount: number; qty: number }>>();
    const customerNameMap = new Map<string, string>(); // Map customerId to customerName
    const allMonths = new Set<string>();

    data.forEach(item => {
      if (!item.invoiceDate) return;

      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;

      const year = date.getFullYear();
      const month = date.getMonth();
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

      allMonths.add(monthKey);

      const customerId = item.customerId || item.customerName; // Use customerId for grouping
      if (!customerMonthMap.has(customerId)) {
        customerMonthMap.set(customerId, new Map());
      }

      // Store customerName for this customerId (use first occurrence)
      if (!customerNameMap.has(customerId)) {
        customerNameMap.set(customerId, item.customerName);
      }

      const customerMonths = customerMonthMap.get(customerId)!;
      if (!customerMonths.has(monthKey)) {
        customerMonths.set(monthKey, { amount: 0, qty: 0 });
      }

      const monthData = customerMonths.get(monthKey)!;
      monthData.amount += item.amount;
      monthData.qty += item.qty;
    });

    // Sort months chronologically
    const sortedMonths = Array.from(allMonths).sort();
    const monthLabels = sortedMonths.map(monthKey => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Amount
    const amountHeaders = ['Customer', ...monthLabels, 'Total'];
    const amountRows: any[][] = [];

    customerMonthMap.forEach((months, customerId) => {
      const customerName = customerNameMap.get(customerId) || customerId; // Use customerName for display
      const row: any[] = [customerName];
      let total = 0;

      sortedMonths.forEach(monthKey => {
        const monthData = months.get(monthKey);
        const value = monthData ? monthData.amount : 0;
        row.push(value.toFixed(2));
        total += value;
      });

      row.push(total.toFixed(2));
      amountRows.push(row);
    });

    // Sort by customer name
    amountRows.sort((a, b) => a[0].localeCompare(b[0]));

    // Add total row - calculate from original data
    const amountTotals = new Array(sortedMonths.length + 1).fill(0);
    customerMonthMap.forEach((months) => {
      sortedMonths.forEach((monthKey, index) => {
        const monthData = months.get(monthKey);
        if (monthData) {
          amountTotals[index] += monthData.amount;
        }
      });
    });
    amountTotals[amountTotals.length - 1] = amountTotals.slice(0, -1).reduce((a, b) => a + b, 0);
    amountRows.push(['Total', ...amountTotals.map(t => t.toFixed(2))]);

    const amountData = [amountHeaders, ...amountRows];
    const amountSheet = XLSX.utils.aoa_to_sheet(amountData);
    XLSX.utils.book_append_sheet(workbook, amountSheet, 'Amount');

    // Sheet 2: Quantity
    const qtyHeaders = ['Customer', ...monthLabels, 'Total'];
    const qtyRows: any[][] = [];

    customerMonthMap.forEach((months, customerId) => {
      const customerName = customerNameMap.get(customerId) || customerId; // Use customerName for display
      const row: any[] = [customerName];
      let total = 0;

      sortedMonths.forEach(monthKey => {
        const monthData = months.get(monthKey);
        const value = monthData ? monthData.qty : 0;
        row.push(value.toFixed(0));
        total += value;
      });

      row.push(total.toFixed(0));
      qtyRows.push(row);
    });

    // Sort by customer name
    qtyRows.sort((a, b) => a[0].localeCompare(b[0]));

    // Add total row - calculate from original data
    const qtyTotals = new Array(sortedMonths.length + 1).fill(0);
    customerMonthMap.forEach((months) => {
      sortedMonths.forEach((monthKey, index) => {
        const monthData = months.get(monthKey);
        if (monthData) {
          qtyTotals[index] += monthData.qty;
        }
      });
    });
    qtyTotals[qtyTotals.length - 1] = qtyTotals.slice(0, -1).reduce((a, b) => a + b, 0);
    qtyRows.push(['Total', ...qtyTotals.map(t => t.toFixed(0))]);

    const qtyData = [qtyHeaders, ...qtyRows];
    const qtySheet = XLSX.utils.aoa_to_sheet(qtyData);
    XLSX.utils.book_append_sheet(workbook, qtySheet, 'Qty');

    const filename = `sales_customers_by_months_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    setShowExportMenu(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customers data...</p>
        </div>
      </div>
    );
  }

  // If a customer is selected, show their details
  if (selectedCustomer) {
    return (
      <SalesCustomerDetails
        customerName={selectedCustomer}
        customerType={activeTab}
        data={data}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between mb-8">
          <div className="flex items-center gap-4 bg-gray-200/50 p-1 rounded-xl">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('main')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'main'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-300/50'
                  }`}
              >
                Main Customers
              </button>
              <button
                onClick={() => setActiveTab('sub')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'sub'
                  ? 'bg-white text-green-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-300/50'
                  }`}
              >
                Sub Customers
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="p-3 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all shadow-md hover:shadow-lg active:scale-95"
                title="Export to Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  <button
                    onClick={exportToExcel}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg transition-colors border-b border-gray-100"
                  >
                    Export Current Table
                  </button>
                  <button
                    onClick={exportToExcelByMonths}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg transition-colors"
                  >
                    Export by Months
                  </button>
                </div>
              )}
            </div>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
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
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${openDropdown === 'area'
                    ? 'border-green-500 ring-2 ring-green-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <span className={filterArea ? 'text-gray-800' : 'text-gray-400'}>
                    {filterArea || 'All Areas'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openDropdown === 'area' ? 'transform rotate-180' : ''
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
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${filterArea === ''
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
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${filterArea === area
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

            {/* Market Filter */}
            <div className="relative" ref={marketDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-green-600" />
                Market
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'market' ? null : 'market')}
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${openDropdown === 'market'
                    ? 'border-green-500 ring-2 ring-green-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <span className={filterMarket ? 'text-gray-800' : 'text-gray-400'}>
                    {filterMarket || 'All Markets'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openDropdown === 'market' ? 'transform rotate-180' : ''
                      }`}
                  />
                </button>
                {openDropdown === 'market' && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto">
                    <div
                      onClick={() => {
                        setFilterMarket('');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${filterMarket === ''
                        ? 'bg-green-50 text-green-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      All Markets
                    </div>
                    {uniqueMarkets.map(market => (
                      <div
                        key={market}
                        onClick={() => {
                          setFilterMarket(market);
                          setOpenDropdown(null);
                        }}
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${filterMarket === market
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        {market}
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
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${openDropdown === 'merchandiser'
                    ? 'border-green-500 ring-2 ring-green-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <span className={filterMerchandiser ? 'text-gray-800' : 'text-gray-400'}>
                    {filterMerchandiser || 'All Merchandisers'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openDropdown === 'merchandiser' ? 'transform rotate-180' : ''
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
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${filterMerchandiser === ''
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
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${filterMerchandiser === merchandiser
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
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${openDropdown === 'salesrep'
                    ? 'border-green-500 ring-2 ring-green-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <span className={filterSalesRep ? 'text-gray-800' : 'text-gray-400'}>
                    {filterSalesRep || 'All Sales Reps'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${openDropdown === 'salesrep' ? 'transform rotate-180' : ''
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
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${filterSalesRep === ''
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
                        className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${filterSalesRep === salesRep
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
          {(filterYear || filterMonth || dateFrom || dateTo || filterArea || filterMerchandiser || filterSalesRep || filterMarket) && (
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
                  setFilterMarket('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">#</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Customer Name</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Total Amount</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Avg Amount / Month</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Total Qty</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Avg Qty / Month</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Transactions</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center">Unique Products</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedCustomers.map((item, index) => (
                  <CustomerRow
                    key={item.customer}
                    item={item}
                    rowNumber={startIndex + index + 1}
                    onCustomerClick={setSelectedCustomer}
                  />
                ))}
                {paginatedCustomers.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Users className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No customers found matching your criteria</p>
                        <p className="text-sm">Try adjusting your filters or search query</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredCustomers.length > 0 && (
                <tfoot>
                  <tr className="bg-green-50/50 font-bold border-t-2 border-green-100">
                    <td className="py-4 px-4 text-center text-green-800" colSpan={2}>Grand Total ({filteredCustomers.length} Customers)</td>
                    <td className="py-4 px-4 text-center text-green-900">
                      {totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-center text-green-900">
                      {totals.totalAverageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-center text-green-900">
                      {totals.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-4 px-4 text-center text-green-900">
                      {totals.totalAverageQty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-center text-green-900">{totals.totalTransactions.toLocaleString()}</td>
                    <td className="py-4 px-4 text-center text-green-900">{totals.totalProductsCount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredCustomers.length)}</span> of <span className="font-medium">{filteredCustomers.length}</span> customers
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
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
                        className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${currentPage === pageNum
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-600 border border-gray-200 hover:border-green-500 hover:text-green-600'
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
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
