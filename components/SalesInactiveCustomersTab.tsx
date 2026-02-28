'use client';

import { useState, useMemo, useEffect, memo, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Users, ChevronLeft, ChevronRight, Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, AlertTriangle, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesCustomerDetails from './SalesCustomerDetails';

interface SalesInactiveCustomersTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const InactiveCustomerRow = memo(({ item, rowNumber, onCustomerClick, onExclude, isExcluding }: {
  item: {
    customerId: string;
    customer: string;
    lastPurchaseDate: Date | null;
    daysSinceLastPurchase: number;
    totalAmount: number;
    averageOrderValue: number;
    orderCount: number;
    status: string;
  };
  rowNumber: number;
  onCustomerClick: (customer: string) => void;
  onExclude: (customerId: string, customerName: string) => void;
  isExcluding?: boolean;
}) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{rowNumber}</td>
      <td
        className="py-3 px-4 text-sm text-gray-800 font-medium text-center cursor-pointer hover:text-green-600 hover:underline min-w-[200px]"
        onClick={() => onCustomerClick(item.customer)}
      >
        {item.customer}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }) : '-'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.daysSinceLastPurchase}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.averageOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.orderCount}</td>
      <td className="py-3 px-4 text-sm text-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExclude(item.customerId, item.customer);
          }}
          disabled={isExcluding}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-30"
          title="Exclude from list"
        >
          {isExcluding ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent animate-spin rounded-full" /> : <X className="w-4 h-4" />}
        </button>
      </td>
    </tr>
  );
});

InactiveCustomerRow.displayName = 'InactiveCustomerRow';

export default function SalesInactiveCustomersTab({ data, loading }: SalesInactiveCustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [filterDays, setFilterDays] = useState('');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterMarket, setFilterMarket] = useState('');
  const [filterMerchandiser, setFilterMerchandiser] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'area' | 'market' | 'merchandiser' | 'salesrep' | 'status' | null>(null);
  const [excludedCustomerIds, setExcludedCustomerIds] = useState<Set<string>>(new Set());
  const [excludedCustomersData, setExcludedCustomersData] = useState<Array<{ customerId: string, customerName: string }>>([]);
  const [sortField, setSortField] = useState<'customer' | 'lastPurchaseDate' | 'daysSinceLastPurchase' | 'totalAmount' | 'averageOrderValue' | 'orderCount'>('daysSinceLastPurchase');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [excludingId, setExcludingId] = useState<string | null>(null);
  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [customerToExclude, setCustomerToExclude] = useState<{ id: string, name: string } | null>(null);

  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const marketDropdownRef = useRef<HTMLDivElement>(null);
  const merchandiserDropdownRef = useRef<HTMLDivElement>(null);
  const salesRepDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(target)) {
        setOpenDropdown(prev => prev === 'area' ? null : prev);
      }
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(target)) {
        setOpenDropdown(prev => prev === 'market' ? null : prev);
      }
      if (merchandiserDropdownRef.current && !merchandiserDropdownRef.current.contains(target)) {
        setOpenDropdown(prev => prev === 'merchandiser' ? null : prev);
      }
      if (salesRepDropdownRef.current && !salesRepDropdownRef.current.contains(target)) {
        setOpenDropdown(prev => prev === 'salesrep' ? null : prev);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setOpenDropdown(prev => prev === 'status' ? null : prev);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(target)) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch excluded customer IDs from exceptions sheet
  useEffect(() => {
    const fetchExceptions = async () => {
      try {
        const response = await fetch('/api/inactive-customer-exceptions');
        if (response.ok) {
          const result = await response.json();
          const excludedIds = new Set<string>();
          result.data.forEach((item: { customerId: string, customerName: string }) => {
            if (item.customerId) {
              excludedIds.add(item.customerId.trim());
            }
          });
          setExcludedCustomerIds(excludedIds);
          setExcludedCustomersData(result.data);
        }
      } catch (error) {
        console.error('Error fetching inactive customer exceptions:', error);
      }
    };
    fetchExceptions();
  }, []);

  const sortedExcludedCustomersData = useMemo(() => {
    return [...excludedCustomersData].sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [excludedCustomersData]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter data based on static filters (Area, Merchandiser, SalesRep, Market)
  const filteredData = useMemo(() => {
    let filtered = [...data];

    if (filterArea) {
      filtered = filtered.filter(item => item.area === filterArea);
    }
    if (filterMerchandiser) {
      filtered = filtered.filter(item => item.merchandiser === filterMerchandiser);
    }
    if (filterSalesRep) {
      filtered = filtered.filter(item => item.salesRep === filterSalesRep);
    }
    if (filterMarket) {
      filtered = filtered.filter(item => item.market === filterMarket);
    }

    return filtered;
  }, [data, filterArea, filterMarket, filterMerchandiser, filterSalesRep]);

  // Group data by customer and calculate inactive customer metrics
  const inactiveCustomersData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];

    const customerMap = new Map<string, {
      customerId: string;
      customer: string;
      lastPurchaseDate: Date | null;
      totalAmount: number;
      invoiceNumbers: Set<string>;
      invoiceDates: Date[];
    }>();

    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Process all invoices to get customer data
    for (let i = 0; i < filteredData.length; i++) {
      const item = filteredData[i];
      const key = item.customerId || item.customerName;
      let existing = customerMap.get(key);

      if (!existing) {
        existing = {
          customerId: key,
          customer: item.customerName,
          lastPurchaseDate: null,
          totalAmount: 0,
          invoiceNumbers: new Set<string>(),
          invoiceDates: []
        };
        customerMap.set(key, existing);
      }

      // Only count invoices starting with "SAL"
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.totalAmount += item.amount;
        existing.invoiceNumbers.add(item.invoiceNumber);

        if (item.invoiceDate) {
          const date = new Date(item.invoiceDate);
          if (!isNaN(date.getTime())) {
            existing.invoiceDates.push(date);
            // Update last purchase date
            if (!existing.lastPurchaseDate || date > existing.lastPurchaseDate) {
              existing.lastPurchaseDate = date;
            }
          }
        }
      }
    }

    // Convert to array and calculate metrics
    const result: Array<{
      customerId: string;
      customer: string;
      lastPurchaseDate: Date | null;
      daysSinceLastPurchase: number;
      totalAmount: number;
      averageOrderValue: number;
      orderCount: number;
      status: string;
    }> = [];

    customerMap.forEach(item => {
      if (!item.lastPurchaseDate) return; // Skip customers with no valid purchase date

      // Skip customers in exceptions list
      if (excludedCustomerIds.has(item.customerId)) return;

      // Calculate days since last purchase
      const daysSince = Math.floor((currentDate.getTime() - item.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24));

      // Only include customers with 10+ days since last purchase
      if (daysSince < 10) return;

      // Calculate average order value
      const orderCount = item.invoiceNumbers.size;
      const averageOrderValue = orderCount > 0 ? item.totalAmount / orderCount : 0;

      // Determine status
      let status = '';
      if (daysSince >= 10 && daysSince < 30) {
        status = 'At Risk';
      } else if (daysSince >= 30 && daysSince < 60) {
        status = 'Inactive';
      } else if (daysSince >= 60) {
        status = 'Lost';
      }

      result.push({
        customerId: item.customerId,
        customer: item.customer,
        lastPurchaseDate: item.lastPurchaseDate,
        daysSinceLastPurchase: daysSince,
        totalAmount: item.totalAmount,
        averageOrderValue,
        orderCount,
        status
      });
    });

    // Sort by days since last purchase (descending - most inactive first)
    result.sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);

    return result;
  }, [filteredData, excludedCustomerIds]);

  // Get unique values for dropdown filters
  const uniqueAreas = useMemo(() => {
    const areas = new Set<string>();
    data.forEach(item => { if (item.area && item.area.trim()) areas.add(item.area.trim()); });
    return Array.from(areas).sort();
  }, [data]);

  const uniqueMarkets = useMemo(() => {
    const markets = new Set<string>();
    data.forEach(item => { if (item.market && item.market.trim()) markets.add(item.market.trim()); });
    return Array.from(markets).sort();
  }, [data]);

  const uniqueMerchandisers = useMemo(() => {
    const merchandisers = new Set<string>();
    data.forEach(item => { if (item.merchandiser && item.merchandiser.trim()) merchandisers.add(item.merchandiser.trim()); });
    return Array.from(merchandisers).sort();
  }, [data]);

  const uniqueSalesReps = useMemo(() => {
    const salesReps = new Set<string>();
    data.forEach(item => { if (item.salesRep && item.salesRep.trim()) salesReps.add(item.salesRep.trim()); });
    return Array.from(salesReps).sort();
  }, [data]);

  // Filter and sort customers
  const filteredCustomers = useMemo(() => {
    if (inactiveCustomersData.length === 0) return [];

    let filtered: typeof inactiveCustomersData;

    // Apply search filter using debounced query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = inactiveCustomersData.filter(item =>
        item.customer.toLowerCase().includes(query)
      );
    } else {
      filtered = inactiveCustomersData;
    }

    // Filter by days
    if (filterDays) {
      const days = parseInt(filterDays);
      if (!isNaN(days) && days >= 0) {
        filtered = filtered.filter(item => item.daysSinceLastPurchase >= days);
      }
    }

    // Filter by minimum amount
    if (filterMinAmount) {
      const minAmount = parseFloat(filterMinAmount);
      if (!isNaN(minAmount) && minAmount >= 0) {
        filtered = filtered.filter(item => item.totalAmount >= minAmount);
      }
    }

    // Filter by status
    if (filterStatus) {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'lastPurchaseDate') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [inactiveCustomersData, debouncedSearchQuery, filterDays, filterMinAmount, filterStatus, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 inline ml-1 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1 text-green-600" /> : <ArrowDown className="w-4 h-4 inline ml-1 text-green-600" />;
  };

  const handleExcludeCustomer = async (customerId: string, customerName: string) => {
    setCustomerToExclude({ id: customerId, name: customerName });
  };

  const confirmExcludeCustomer = async () => {
    if (!customerToExclude) return;
    const { id: customerId, name: customerName } = customerToExclude;
    setCustomerToExclude(null);

    setExcludingId(customerId);
    try {
      const response = await fetch('/api/inactive-customer-exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, customerName }),
      });

      if (response.ok) {
        setExcludedCustomerIds(prev => {
          const next = new Set(prev);
          next.add(customerId);
          return next;
        });
        setExcludedCustomersData(prev => [...prev, { customerId, customerName }]);
      } else {
        alert('Failed to exclude customer');
      }
    } catch (error) {
      console.error('Error excluding customer:', error);
      alert('Error excluding customer');
    } finally {
      setExcludingId(null);
    }
  };

  const handleRestoreCustomer = async (customerId: string) => {
    setRestoringId(customerId);
    try {
      const response = await fetch(`/api/inactive-customer-exceptions?customerId=${encodeURIComponent(customerId)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setExcludedCustomerIds(prev => {
          const next = new Set(prev);
          next.delete(customerId);
          return next;
        });
        setExcludedCustomersData(prev => prev.filter(c => c.customerId !== customerId));
      } else {
        alert('Failed to restore customer');
      }
    } catch (error) {
      console.error('Error restoring customer:', error);
      alert('Error restoring customer');
    } finally {
      setRestoringId(null);
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Calculate totals
  const totals = useMemo(() => {
    if (filteredCustomers.length === 0) return { totalAmount: 0, totalAverageOrderValue: 0, totalOrderCount: 0 };
    const result = filteredCustomers.reduce((acc, item) => {
      acc.totalAmount += item.totalAmount;
      acc.totalAverageOrderValue += item.averageOrderValue;
      acc.totalOrderCount += item.orderCount;
      return acc;
    }, { totalAmount: 0, totalAverageOrderValue: 0, totalOrderCount: 0 });
    return result;
  }, [filteredCustomers]);

  const hasActiveFilters = filterDays || filterMinAmount || filterStatus || filterArea || filterMarket || filterMerchandiser || filterSalesRep;

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const headers = ['#', 'Customer Name', 'Status', 'Last Purchase Date', 'Days Since Last Purchase', 'Total Amount', 'Average Order Value', 'Order Count'];
    const rows = filteredCustomers.map((item, index) => [
      index + 1, item.customer, item.status,
      item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toLocaleDateString() : '-',
      item.daysSinceLastPurchase, item.totalAmount.toFixed(2), item.averageOrderValue.toFixed(2), item.orderCount,
    ]);
    if (filteredCustomers.length > 0) {
      rows.push(['', 'Total', '', '', '', totals.totalAmount.toFixed(2), (totals.totalAverageOrderValue / filteredCustomers.length).toFixed(2), totals.totalOrderCount]);
    }
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inactive Customers');
    XLSX.writeFile(workbook, `sales_inactive_customers_${new Date().toISOString().split('T')[0]}.xlsx`);
    setShowExportMenu(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-bold">Loading analysis...</p>
      </div>
    </div>
  );

  if (selectedCustomer) return (
    <SalesCustomerDetails customerName={selectedCustomer} data={data} onBack={() => setSelectedCustomer(null)} initialTab="dashboard" />
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Inactive Customers</h1>
            <button
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border outline-none ${hasActiveFilters
                ? 'bg-red-50 border-red-200 text-red-600 font-bold'
                : 'bg-white border-gray-200 text-gray-600 hover:border-green-500 font-semibold'
                }`}
            >
              <Filter className={`w-5 h-5 ${hasActiveFilters ? 'animate-pulse' : ''}`} />
              <span>Filters</span>
            </button>
            <button
              onClick={() => setShowExcludedModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 font-bold hover:bg-orange-100 transition-all outline-none"
              title="View Hidden Customers"
            >
              <Users className="w-5 h-5" />
              <span>Hidden ({excludedCustomerIds.size})</span>
            </button>
            <button
              onClick={exportToExcel}
              className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 hover:scale-110 active:scale-95 transition-all shadow-md"
              title="Export to Excel"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters Modal - Matching Customers Tab Design */}
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsFilterModalOpen(false)} />
            <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-white/20 animate-in fade-in zoom-in duration-300 overflow-hidden">
              {/* Modal Header */}
              <div className="px-10 py-8 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-2xl shadow-inner">
                    <Filter className="w-7 h-7 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">Inactive Customers Filters</h2>
                  </div>
                </div>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-3 hover:bg-gray-200 rounded-full transition-colors group">
                  <X className="w-7 h-7 text-gray-400 group-hover:text-gray-700 transition-colors" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-10 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="space-y-12 pb-20">
                  {/* 01. Inactivity Criteria */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-green-500" /> 01. Inactivity Metrics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/50 p-8 rounded-[32px] border border-slate-100 shadow-sm">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Days Since Last Purchase</label>
                        <input
                          value={filterDays}
                          onChange={e => setFilterDays(e.target.value)}
                          type="number"
                          placeholder="Min. days (e.g. 30)"
                          className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Total Amount Greater Than</label>
                        <input
                          value={filterMinAmount}
                          onChange={e => setFilterMinAmount(e.target.value)}
                          type="number"
                          placeholder="Min. value"
                          className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold shadow-sm focus:ring-4 focus:ring-green-500/5 focus:border-green-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 02. Segmentation & Status */}
                  <div className="space-y-6">
                    <h3 className="text-sm font-black text-slate-400 font-mono uppercase tracking-[0.2em] flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-green-500" /> 02. Segmentation & Status
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 bg-green-50/30 p-10 rounded-[32px] border border-green-100/50 shadow-sm text-slate-700">
                      {/* Status */}
                      <div className="relative" ref={statusDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Customer Status</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterStatus ? 'text-slate-900' : 'text-slate-400'}>{filterStatus || 'Select Status'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'status' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'status' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <button onClick={() => { setFilterStatus(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Status</button>
                            {['At Risk', 'Inactive', 'Lost'].map(s => <button key={s} onClick={() => { setFilterStatus(s); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors">{s}</button>)}
                          </div>
                        )}
                      </div>

                      {/* Area */}
                      <div className="relative" ref={areaDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Territory / Area</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'area' ? null : 'area')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterArea ? 'text-slate-900' : 'text-slate-400'}>{filterArea || 'Select Area'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'area' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'area' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                              <button onClick={() => { setFilterArea(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Area</button>
                              {uniqueAreas.map(a => <button key={a} onClick={() => { setFilterArea(a); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors uppercase">{a}</button>)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Sales Rep */}
                      <div className="relative" ref={salesRepDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Account Executive</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'salesrep' ? null : 'salesrep')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterSalesRep ? 'text-slate-900' : 'text-slate-400'}>{filterSalesRep || 'Select Rep'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'salesrep' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'salesrep' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                              <button onClick={() => { setFilterSalesRep(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Rep</button>
                              {uniqueSalesReps.map(r => <button key={r} onClick={() => { setFilterSalesRep(r); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors uppercase">{r}</button>)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Market */}
                      <div className="relative" ref={marketDropdownRef}>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2.5 block">Market Category</label>
                        <button onClick={() => setOpenDropdown(openDropdown === 'market' ? null : 'market')} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-[20px] flex items-center justify-between font-bold text-slate-700 shadow-sm hover:border-green-500 hover:shadow-lg transition-all group outline-none">
                          <span className={filterMarket ? 'text-slate-900' : 'text-slate-400'}>{filterMarket || 'Select Market'}</span>
                          <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${openDropdown === 'market' ? 'rotate-180' : ''}`} />
                        </button>
                        {openDropdown === 'market' && (
                          <div className="absolute z-[110] w-full mt-3 bg-white border border-slate-200 rounded-[20px] shadow-2xl overflow-hidden p-2">
                            <div className="max-h-60 overflow-y-auto [&::-webkit-scrollbar]:hidden">
                              <button onClick={() => { setFilterMarket(''); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-green-50 text-green-700 rounded-xl font-black text-xs uppercase tracking-widest mb-1 transition-colors">Clear Market</button>
                              {uniqueMarkets.map(m => <button key={m} onClick={() => { setFilterMarket(m); setOpenDropdown(null); }} className="w-full text-left px-5 py-3.5 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm border-t border-slate-50 transition-colors uppercase">{m}</button>)}
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
                    setFilterDays(''); setFilterMinAmount(''); setFilterStatus('');
                    setFilterArea(''); setFilterMarket(''); setFilterMerchandiser(''); setFilterSalesRep('');
                  }}
                  className="px-6 py-4 text-[11px] font-black text-slate-400 hover:text-red-500 uppercase tracking-[0.2em] transition-all hover:bg-red-50 rounded-2xl"
                >
                  Reset Analysis Criteria
                </button>
                <button onClick={() => setIsFilterModalOpen(false)} className="px-12 py-4 bg-green-600 text-white font-black text-sm uppercase tracking-[0.2em] rounded-[20px] shadow-xl shadow-green-100 hover:bg-green-700 hover:scale-105 active:scale-95 transition-all outline-none">
                  Apply & Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-100 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm shadow-gray-200/50"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md p-6 overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center w-12">#</th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 transition-colors" onClick={() => handleSort('customer')}>
                    <div className="flex items-center justify-center gap-1">Customer {getSortIcon('customer')}</div>
                  </th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 transition-colors" onClick={() => handleSort('lastPurchaseDate')}>
                    <div className="flex items-center justify-center gap-1">Last Purchase {getSortIcon('lastPurchaseDate')}</div>
                  </th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 transition-colors" onClick={() => handleSort('daysSinceLastPurchase')}>
                    <div className="flex items-center justify-center gap-1">Days Inactive {getSortIcon('daysSinceLastPurchase')}</div>
                  </th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 transition-colors" onClick={() => handleSort('totalAmount')}>
                    <div className="flex items-center justify-center gap-1">Total Value {getSortIcon('totalAmount')}</div>
                  </th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 transition-colors" onClick={() => handleSort('averageOrderValue')}>
                    <div className="flex items-center justify-center gap-1">Avg. Ticket {getSortIcon('averageOrderValue')}</div>
                  </th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center cursor-pointer hover:text-green-600 transition-colors" onClick={() => handleSort('orderCount')}>
                    <div className="flex items-center justify-center gap-1">Orders {getSortIcon('orderCount')}</div>
                  </th>
                  <th className="py-4 px-4 text-sm font-bold text-gray-600 uppercase tracking-wider text-center w-10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedCustomers.map((item, idx) => (
                  <InactiveCustomerRow
                    key={item.customer}
                    item={item}
                    rowNumber={startIndex + idx + 1}
                    onCustomerClick={setSelectedCustomer}
                    onExclude={handleExcludeCustomer}
                    isExcluding={excludingId === item.customerId}
                  />
                ))}
                {filteredCustomers.length === 0 && (
                  <tr><td colSpan={8} className="py-12 text-center text-gray-500 font-bold">No results matching your filters</td></tr>
                )}
                {filteredCustomers.length > 0 && (
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td colSpan={4} className="py-4 px-4 text-right text-gray-600 uppercase tracking-widest text-xs pr-10">Analysis Totals</td>
                    <td className="py-4 px-4 text-center text-gray-800">{totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="py-4 px-4 text-center text-gray-800">
                      {(totals.totalAverageOrderValue / filteredCustomers.length).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-center text-gray-800">{totals.totalOrderCount}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredCustomers.length > ITEMS_PER_PAGE && (
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-6">
              <span className="text-sm text-gray-500 font-medium">Found {filteredCustomers.length} results</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all outline-none active:scale-90"><ChevronLeft className="w-5 h-5" /></button>
                <div className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm">Page {currentPage} / {totalPages}</div>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all outline-none active:scale-90"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Customers Modal */}
      {showExcludedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowExcludedModal(false)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-white/20 animate-in fade-in zoom-in duration-300 overflow-hidden">
            <div className="px-8 py-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-xl">
                  <Users className="w-6 h-6 text-orange-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Hidden Inactive Customers</h2>
              </div>
              <button onClick={() => setShowExcludedModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400 hover:text-gray-700" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {sortedExcludedCustomersData.length === 0 ? (
                <div className="py-20 text-center text-gray-500 font-bold">No customers are currently hidden</div>
              ) : (
                <div className="space-y-3">
                  {sortedExcludedCustomersData.map((cust) => (
                    <div key={cust.customerId} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-orange-200 transition-all group">
                      <div>
                        <div className="font-bold text-gray-800">{cust.customerName}</div>
                        <div className="text-xs text-gray-400 font-mono">{cust.customerId}</div>
                      </div>
                      <button
                        onClick={() => handleRestoreCustomer(cust.customerId)}
                        disabled={restoringId === cust.customerId}
                        className="px-4 py-2 bg-white border border-orange-200 text-orange-600 rounded-xl text-sm font-bold hover:bg-orange-600 hover:text-white transition-all disabled:opacity-30 flex items-center gap-2 shadow-sm"
                      >
                        {restoringId === cust.customerId ? <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent animate-spin rounded-full" /> : <ArrowUp className="w-4 h-4" />}
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400 font-medium">Restoring a customer will make them reappear in the inactive analysis list.</p>
            </div>
          </div>
        </div>
      )}

      {/* Exclude Confirmation Modal */}
      {customerToExclude && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setCustomerToExclude(null)} />
          <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-md flex flex-col border border-white/20 animate-in fade-in zoom-in duration-300 overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner animate-bounce-subtle">
                <EyeOff className="w-10 h-10 text-orange-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-800 mb-4 tracking-tight">Hide Customer?</h2>
              <p className="text-gray-500 font-medium leading-relaxed">
                Are you sure you want to hide <span className="text-orange-600 font-bold">"{customerToExclude.name}"</span> from the inactive customers list?
              </p>
            </div>

            <div className="px-8 pb-8 flex gap-4">
              <button
                onClick={() => setCustomerToExclude(null)}
                className="flex-1 py-4 bg-gray-100 text-gray-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all outline-none"
              >
                Go Back
              </button>
              <button
                onClick={confirmExcludeCustomer}
                className="flex-1 py-4 bg-orange-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-200 hover:bg-orange-700 hover:scale-105 active:scale-95 transition-all outline-none"
              >
                Hide Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
