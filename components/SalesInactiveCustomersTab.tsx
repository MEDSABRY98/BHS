'use client';

import { useState, useMemo, useEffect, memo, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Users, ChevronLeft, ChevronRight, Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesCustomerDetails from './SalesCustomerDetails';

interface SalesInactiveCustomersTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const InactiveCustomerRow = memo(({ item, rowNumber, onCustomerClick }: { 
  item: { 
    customer: string; 
    lastPurchaseDate: Date | null;
    daysSinceLastPurchase: number;
    totalAmount: number; 
    averageOrderValue: number;
    orderCount: number;
    status: string;
  }; 
  rowNumber: number; 
  onCustomerClick: (customer: string) => void 
}) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
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
  const [filterMerchandiser, setFilterMerchandiser] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  const [openDropdown, setOpenDropdown] = useState<'area' | 'merchandiser' | 'salesrep' | 'status' | null>(null);
  const [excludedCustomerIds, setExcludedCustomerIds] = useState<Set<string>>(new Set());
  
  const areaDropdownRef = useRef<HTMLDivElement>(null);
  const merchandiserDropdownRef = useRef<HTMLDivElement>(null);
  const salesRepDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

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
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(prev => prev === 'status' ? null : prev);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch excluded customer IDs from exceptions sheet
  useEffect(() => {
    const fetchExceptions = async () => {
      try {
        const response = await fetch('/api/inactive-customer-exceptions');
        if (response.ok) {
          const result = await response.json();
          const excludedIds = new Set<string>();
          result.data.forEach((item: { customerId: string }) => {
            if (item.customerId) {
              excludedIds.add(item.customerId.trim());
            }
          });
          setExcludedCustomerIds(excludedIds);
        }
      } catch (error) {
        console.error('Error fetching inactive customer exceptions:', error);
      }
    };
    fetchExceptions();
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

    // Filter by area
    if (filterArea) {
      filtered = filtered.filter(item => item.area === filterArea);
    }

    // Filter by merchandiser
    if (filterMerchandiser) {
      filtered = filtered.filter(item => item.merchandiser === filterMerchandiser);
    }

    // Filter by sales rep
    if (filterSalesRep) {
      filtered = filtered.filter(item => item.salesRep === filterSalesRep);
    }

    return filtered;
  }, [data, filterArea, filterMerchandiser, filterSalesRep]);

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
    
    return filtered;
  }, [inactiveCustomersData, debouncedSearchQuery, filterDays, filterMinAmount, filterStatus]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Calculate totals
  const totals = useMemo(() => {
    if (filteredCustomers.length === 0) {
      return {
        totalAmount: 0,
        totalAverageOrderValue: 0,
        totalOrderCount: 0
      };
    }

    const result = filteredCustomers.reduce((acc, item) => {
      acc.totalAmount += item.totalAmount;
      acc.totalAverageOrderValue += item.averageOrderValue;
      acc.totalOrderCount += item.orderCount;
      return acc;
    }, {
      totalAmount: 0,
      totalAverageOrderValue: 0,
      totalOrderCount: 0
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
      'Status',
      'Last Purchase Date',
      'Days Since Last Purchase',
      'Total Amount',
      'Average Order Value',
      'Order Count',
    ];

    const rows = filteredCustomers.map((item, index) => [
      index + 1,
      item.customer,
      item.status,
      item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : '-',
      item.daysSinceLastPurchase,
      item.totalAmount.toFixed(2),
      item.averageOrderValue.toFixed(2),
      item.orderCount,
    ]);

    // Totals row
    if (filteredCustomers.length > 0) {
      rows.push([
        '',
        'Total',
        '',
        '',
        '',
        totals.totalAmount.toFixed(2),
        (totals.totalAverageOrderValue / filteredCustomers.length).toFixed(2),
        totals.totalOrderCount,
      ]);
    }

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inactive Customers');

    const filename = `sales_inactive_customers_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
    setShowExportMenu(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading inactive customers data...</p>
        </div>
      </div>
    );
  }

  if (selectedCustomer) {
    return (
      <SalesCustomerDetails
        customerName={selectedCustomer}
        data={data}
        onBack={() => setSelectedCustomer(null)}
        initialTab="dashboard"
      />
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Inactive Customers</h1>
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="Export to Excel"
            >
              <Download className="w-5 h-5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button
                  onClick={exportToExcel}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Export to Excel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Filters</h2>
          
          {/* Input Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            {/* Days Filter */}
            <div>
              <label htmlFor="filterDays" className="block text-sm font-medium text-gray-700 mb-1">
                Days Since Last Purchase
              </label>
              <input
                id="filterDays"
                type="number"
                placeholder="e.g., 30"
                value={filterDays}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                    setFilterDays(value);
                  }
                }}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                min="0"
              />
            </div>

            {/* Min Amount Filter */}
            <div>
              <label htmlFor="filterMinAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount Greater Than
              </label>
              <input
                id="filterMinAmount"
                type="number"
                placeholder="e.g., 1000"
                value={filterMinAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(Number(value)) && Number(value) >= 0)) {
                    setFilterMinAmount(value);
                  }
                }}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Dropdown Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Status Filter */}
            <div className="relative" ref={statusDropdownRef}>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <UserCircle className="w-4 h-4 text-green-600" />
                Status
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  className={`w-full px-4 py-2.5 pr-10 border-2 rounded-xl bg-white text-gray-800 font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md flex items-center justify-between ${
                    openDropdown === 'status'
                      ? 'border-green-500 ring-2 ring-green-500/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className={filterStatus ? 'text-gray-800' : 'text-gray-400'}>
                    {filterStatus || 'All Statuses'}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                      openDropdown === 'status' ? 'transform rotate-180' : ''
                    }`}
                  />
                </button>
                {openDropdown === 'status' && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-auto">
                    <div
                      onClick={() => {
                        setFilterStatus('');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                        filterStatus === ''
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      All Statuses
                    </div>
                    <div
                      onClick={() => {
                        setFilterStatus('At Risk');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${
                        filterStatus === 'At Risk'
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      At Risk (10-30 days)
                    </div>
                    <div
                      onClick={() => {
                        setFilterStatus('Inactive');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${
                        filterStatus === 'Inactive'
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Inactive (30-60 days)
                    </div>
                    <div
                      onClick={() => {
                        setFilterStatus('Lost');
                        setOpenDropdown(null);
                      }}
                      className={`px-4 py-3 cursor-pointer transition-colors duration-150 border-t border-gray-100 ${
                        filterStatus === 'Lost'
                          ? 'bg-green-50 text-green-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Lost (60+ days)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Area Filter */}
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
          {(filterDays || filterMinAmount || filterStatus || filterArea || filterMerchandiser || filterSalesRep) && (
            <div className="mt-3">
              <button
                onClick={() => {
                  setFilterDays('');
                  setFilterMinAmount('');
                  setFilterStatus('');
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
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 w-12">#</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 min-w-[200px]">Customer Name</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Last Purchase Date</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Days Since Last Purchase</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Total Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Average Order Value</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Order Count</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((item, index) => (
                  <InactiveCustomerRow
                    key={`${item.customer}-${startIndex + index}`}
                    item={item}
                    rowNumber={startIndex + index + 1}
                    onCustomerClick={setSelectedCustomer}
                  />
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      {searchQuery ? 'No customers found matching your search' : 'No data available'}
                    </td>
                  </tr>
                )}
                {filteredCustomers.length > 0 && (
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                    <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={4}>Total</td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalAmount.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {filteredCustomers.length > 0 
                        ? (totals.totalAverageOrderValue / filteredCustomers.length).toLocaleString('en-US', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })
                        : '0.00'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">{totals.totalOrderCount}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredCustomers.length > ITEMS_PER_PAGE && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} customers
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-700 px-3">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

