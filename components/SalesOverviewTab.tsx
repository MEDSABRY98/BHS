'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { TrendingUp, Package, Users, DollarSign, BarChart3, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SalesOverviewTabProps {
  data: SalesInvoice[];
  loading: boolean;
}


export default function SalesOverviewTab({ data, loading }: SalesOverviewTabProps) {
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

  const metrics = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        totalAmount: 0,
        totalQty: 0,
        totalCustomers: 0,
        totalProducts: 0,
        avgAmountPerSale: 0,
        avgQtyPerSale: 0,
        avgMonthlyAmount: 0,
        avgMonthlyQty: 0,
      };
    }

    const totalAmount = filteredData.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = filteredData.reduce((sum, item) => sum + item.qty, 0);
    const uniqueCustomers = new Set(filteredData.map(item => item.customerName)).size;
    const uniqueProducts = new Set(filteredData.map(item => item.product)).size;
    const avgAmountPerSale = totalAmount / filteredData.length;
    const avgQtyPerSale = totalQty / filteredData.length;

    // Calculate monthly averages
    const monthsSet = new Set<string>();
    const monthlyData = new Map<string, { amount: number; qty: number }>();
    
    filteredData.forEach(item => {
      if (item.invoiceDate) {
        try {
          const date = new Date(item.invoiceDate);
          if (!isNaN(date.getTime())) {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            monthsSet.add(monthKey);
            
            const existing = monthlyData.get(monthKey) || { amount: 0, qty: 0 };
            existing.amount += item.amount;
            existing.qty += item.qty;
            monthlyData.set(monthKey, existing);
          }
        } catch (e) {
          // Invalid date, skip
        }
      }
    });

    const totalMonths = monthsSet.size || 1;
    const totalMonthlyAmount = Array.from(monthlyData.values()).reduce((sum, m) => sum + m.amount, 0);
    const totalMonthlyQty = Array.from(monthlyData.values()).reduce((sum, m) => sum + m.qty, 0);
    const avgMonthlyAmount = totalMonthlyAmount / totalMonths;
    const avgMonthlyQty = totalMonthlyQty / totalMonths;

    return {
      totalAmount,
      totalQty,
      totalCustomers: uniqueCustomers,
      totalProducts: uniqueProducts,
      avgAmountPerSale,
      avgQtyPerSale,
      avgMonthlyAmount,
      avgMonthlyQty,
    };
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

  // Monthly sales data for charts - if filters are applied, show filtered data, otherwise show last 12 months
  const monthlySales = useMemo(() => {
    const monthMap = new Map<string, { month: string; monthKey: string; amount: number; qty: number }>();
    
    // Check if any filters are applied
    const hasFilters = filterYear.trim() || filterMonth.trim() || dateFrom || dateTo || filterArea || filterMerchandiser || filterSalesRep;
    
    // Process data to get monthly totals
    const dataToProcess = hasFilters ? filteredData : data;
    
    dataToProcess.forEach(item => {
      if (!item.invoiceDate) return;
      
      try {
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;

        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[month]} ${String(year).slice(-2)}`;

        const existing = monthMap.get(monthKey) || {
          month: monthLabel,
          monthKey,
          amount: 0,
          qty: 0,
        };

        existing.amount += item.amount;
        existing.qty += item.qty;

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Find the latest month in the data
    const allMonths = Array.from(monthMap.values());
    if (allMonths.length === 0) return [];
    
    const latestMonth = allMonths.reduce((latest, current) => {
      return current.monthKey > latest.monthKey ? current : latest;
    });

    // Calculate the last 12 months from the latest month
    const last12MonthsKeys = new Set<string>();
    const [latestYear, latestMonthNum] = latestMonth.monthKey.split('-').map(Number);
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(latestYear, latestMonthNum - 1 - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      last12MonthsKeys.add(monthKey);
    }

    // Create array with all last 12 months, filling missing months with zeros
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result: Array<{ month: string; monthKey: string; amount: number; qty: number }> = [];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(latestYear, latestMonthNum - 1 - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const monthLabel = `${monthNames[month - 1]} ${String(year).slice(-2)}`;
      
      const existing = monthMap.get(monthKey);
      result.push({
        month: monthLabel,
        monthKey,
        amount: existing?.amount || 0,
        qty: existing?.qty || 0,
      });
    }

    // If filters are applied, return filtered months only, otherwise return last 12 months
    if (hasFilters) {
      // Return all months from filtered data, sorted by date ascending (oldest to newest)
      return Array.from(monthMap.values()).sort((a, b) => {
        return a.monthKey.localeCompare(b.monthKey);
      });
    }
    
    return result;
  }, [data, filteredData, filterYear, filterMonth, dateFrom, dateTo]);

  // Chart data for monthly sales - show last 12 months only, reverse order for chart (oldest to newest for better visualization)
  const chartData = useMemo(() => {
    // monthlySales already contains exactly last 12 months
    const data = monthlySales.map((item, index) => {
      // Calculate difference from previous month for amount
      const previousAmount = index > 0 ? monthlySales[index - 1].amount : item.amount;
      const amountDiff = item.amount - previousAmount;
      
      // Calculate difference from previous month for quantity
      const previousQty = index > 0 ? monthlySales[index - 1].qty : item.qty;
      const qtyDiff = item.qty - previousQty;
      
      return {
        month: item.month,
        amount: item.amount,
        amountDiff: amountDiff,
        qty: item.qty,
        qtyDiff: qtyDiff,
        isNegativeAmount: item.amount < 0,
        isNegativeAmountDiff: amountDiff < 0,
        isNegativeQty: item.qty < 0,
        isNegativeQtyDiff: qtyDiff < 0,
        isMaxMonth: false,
      };
    });
    
    // Find max month by amount (highest positive amount, or least negative if all negative)
    if (data.length > 0) {
      const maxAmount = Math.max(...data.map(d => d.amount));
      data.forEach(item => {
        item.isMaxMonth = item.amount === maxAmount;
      });
    }
    
    return data;
  }, [monthlySales]);

  // Monthly sales table data - sorted from newest to oldest, showing ALL months
  const monthlyTableData = useMemo(() => {
    // Get all months from filtered data (not just last 12)
    const monthMap = new Map<string, { month: string; monthKey: string; amount: number; qty: number }>();
    
    filteredData.forEach(item => {
      if (!item.invoiceDate) return;
      
      try {
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;

        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthLabel = `${monthNames[month]} ${String(year).slice(-2)}`;

        const existing = monthMap.get(monthKey) || {
          month: monthLabel,
          monthKey,
          amount: 0,
          qty: 0,
        };

        existing.amount += item.amount;
        existing.qty += item.qty;

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Sort from newest to oldest (descending by monthKey)
    const sorted = Array.from(monthMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    
    return sorted.map((item, index) => {
      // Get previous month for comparison
      const previousMonth = index < sorted.length - 1 ? sorted[index + 1] : null;
      
      const amountDiff = previousMonth ? item.amount - previousMonth.amount : 0;
      const qtyDiff = previousMonth ? item.qty - previousMonth.qty : 0;
      
      return {
        month: item.month,
        monthKey: item.monthKey,
        amount: item.amount,
        amountDiff: amountDiff,
        qty: item.qty,
        qtyDiff: qtyDiff,
      };
    });
  }, [filteredData]);

  // Export monthly table to Excel
  const exportMonthlyTableToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = ['Month', 'Amount', 'Amount Change', 'Quantity', 'Quantity Change'];
    const rows = monthlyTableData.map(item => [
      item.month,
      item.amount,
      item.amountDiff !== 0 ? (item.amountDiff > 0 ? '+' : '') + item.amountDiff : '-',
      item.qty,
      item.qtyDiff !== 0 ? (item.qtyDiff > 0 ? '+' : '') + item.qtyDiff : '-',
    ]);

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Monthly Sales');

    const filename = `sales_monthly_table_${new Date().toISOString().split('T')[0]}.xlsx`;
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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Sales Overview</h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Sales Amount</p>
                <p className="text-2xl font-bold text-gray-800">
                  {metrics.totalAmount.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Monthly Amount</p>
                <p className="text-2xl font-bold text-gray-800">
                  {metrics.avgMonthlyAmount.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Quantity</p>
                <p className="text-2xl font-bold text-gray-800">
                  {metrics.totalQty.toLocaleString('en-US', { 
                    minimumFractionDigits: 0, 
                    maximumFractionDigits: 0 
                  })}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Monthly Quantity</p>
                <p className="text-2xl font-bold text-gray-800">
                  {metrics.avgMonthlyQty.toLocaleString('en-US', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-cyan-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Customers</p>
                <p className="text-2xl font-bold text-gray-800">{metrics.totalCustomers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Products</p>
                <p className="text-2xl font-bold text-gray-800">{metrics.totalProducts}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Sales Chart */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Trend</h2>
          {chartData.length > 0 ? (
            <div className="space-y-6">
              {/* Amount Chart */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Amount</h3>
                <div className="relative" style={{ height: '380px' }}>
                  {/* Top labels row with connecting lines */}
                  <div className="absolute top-0 left-0 right-0 h-12 z-10" style={{ paddingLeft: '40px', paddingRight: '30px' }}>
                    <div className="relative w-full h-full">
                      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                        {chartData.map((item, index) => {
                          const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                          return (
                            <line
                              key={index}
                              x1={`${xPercent}%`}
                              y1="30"
                              x2={`${xPercent}%`}
                              y2="12"
                              stroke="#d1d5db"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                          );
                        })}
                      </svg>
                      <div className="relative w-full" style={{ height: '30px' }}>
                        {chartData.map((item, index) => {
                          const value = item.amount;
                          const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                          const isNegative = value < 0;
                          return (
                            <div 
                              key={index} 
                              className="absolute text-base font-bold text-center"
                              style={{ 
                                left: `${xPercent}%`,
                                transform: 'translateX(-50%)',
                                top: 0,
                                color: isNegative ? '#ef4444' : '#374151'
                              }}
                            >
                              {value.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart 
                      data={chartData}
                      margin={{ top: 50, right: 30, left: 40, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        stroke="#6b7280"
                        style={{ fontSize: '16px', fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        style={{ fontSize: '11px' }}
                        tickFormatter={() => ''}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        hide={true}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          padding: '12px'
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const isNegative = value < 0;
                          const displayName = name === 'amountDiff' ? 'Difference' : 'Amount';
                          return [
                            <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                              {value.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </span>,
                            displayName
                          ];
                        }}
                        labelStyle={{ 
                          color: '#374151',
                          fontWeight: 600,
                          marginBottom: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        name="Amount"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4))' }}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isNegative = payload?.isNegativeAmount;
                          const isMaxMonth = payload?.isMaxMonth;
                          const radius = isMaxMonth ? 8 : (isNegative ? 6 : 4);
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={radius} 
                              fill={isNegative ? "#ef4444" : (isMaxMonth ? "#fbbf24" : "#10b981")}
                              stroke={isNegative ? "#dc2626" : (isMaxMonth ? "#f59e0b" : "#059669")}
                              strokeWidth={isMaxMonth ? 3 : (isNegative ? 2 : 0)}
                              style={{ 
                                filter: isMaxMonth 
                                  ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.9)) drop-shadow(0 2px 8px rgba(245, 158, 11, 0.6))' 
                                  : (isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))')
                              }}
                            />
                          );
                        }}
                        activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="amountDiff" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Difference from Previous Month"
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isNegative = payload?.isNegativeAmountDiff;
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill={isNegative ? "#ef4444" : "#10b981"}
                              stroke={isNegative ? "#dc2626" : "#059669"}
                              strokeWidth={isNegative ? 2 : 0}
                              style={{ 
                                filter: isNegative 
                                  ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' 
                                  : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))'
                              }}
                            />
                          );
                        }}
                        activeDot={{ r: 6, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quantity Chart */}
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Quantity</h3>
                <div className="relative" style={{ height: '380px' }}>
                  {/* Top labels row with connecting lines */}
                  <div className="absolute top-0 left-0 right-0 h-12 z-10" style={{ paddingLeft: '40px', paddingRight: '30px' }}>
                    <div className="relative w-full h-full">
                      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                        {chartData.map((item, index) => {
                          const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                          return (
                            <line
                              key={index}
                              x1={`${xPercent}%`}
                              y1="30"
                              x2={`${xPercent}%`}
                              y2="12"
                              stroke="#d1d5db"
                              strokeWidth="1"
                              strokeDasharray="2,2"
                            />
                          );
                        })}
                      </svg>
                      <div className="relative w-full" style={{ height: '30px' }}>
                        {chartData.map((item, index) => {
                          const value = item.qty;
                          const xPercent = chartData.length > 1 ? (index / (chartData.length - 1)) * 100 : 50;
                          const isNegative = value < 0;
                          return (
                            <div 
                              key={index} 
                              className="absolute text-base font-bold text-center"
                              style={{ 
                                left: `${xPercent}%`,
                                transform: 'translateX(-50%)',
                                top: 0,
                                color: isNegative ? '#ef4444' : '#374151'
                              }}
                            >
                              {value.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart 
                      data={chartData}
                      margin={{ top: 50, right: 30, left: 40, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        stroke="#6b7280"
                        style={{ fontSize: '16px', fontWeight: 700 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#9ca3af"
                        style={{ fontSize: '11px' }}
                        tickFormatter={() => ''}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        hide={true}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          border: 'none',
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          padding: '12px'
                        }}
                        formatter={(value: number, name: string, props: any) => {
                          const isNegative = value < 0;
                          const displayName = name === 'qtyDiff' ? 'Difference' : 'Quantity';
                          return [
                            <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                              {value.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                              })}
                            </span>,
                            displayName
                          ];
                        }}
                        labelStyle={{ 
                          color: '#374151',
                          fontWeight: 600,
                          marginBottom: '8px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="qty" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.4))' }}
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isNegative = payload?.isNegativeQty;
                          const isMaxMonth = payload?.isMaxMonth;
                          const radius = isMaxMonth ? 8 : (isNegative ? 6 : 4);
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={radius} 
                              fill={isNegative ? "#ef4444" : (isMaxMonth ? "#fbbf24" : "#3b82f6")}
                              stroke={isNegative ? "#dc2626" : (isMaxMonth ? "#f59e0b" : "#2563eb")}
                              strokeWidth={isMaxMonth ? 3 : (isNegative ? 2 : 0)}
                              style={{ 
                                filter: isMaxMonth 
                                  ? 'drop-shadow(0 0 10px rgba(251, 191, 36, 0.9)) drop-shadow(0 2px 8px rgba(245, 158, 11, 0.6))' 
                                  : (isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.5))')
                              }}
                            />
                          );
                        }}
                        activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="qtyDiff" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Difference from Previous Month"
                        dot={(props: any) => {
                          const { cx, cy, payload } = props;
                          const isNegative = payload?.isNegativeQtyDiff;
                          return (
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill={isNegative ? "#ef4444" : "#10b981"}
                              stroke={isNegative ? "#dc2626" : "#059669"}
                              strokeWidth={isNegative ? 2 : 0}
                              style={{ 
                                filter: isNegative 
                                  ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' 
                                  : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))'
                              }}
                            />
                          );
                        }}
                        activeDot={{ r: 6, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-96 text-gray-500">
              <p>No sales data available for chart</p>
            </div>
          )}
        </div>

        {/* Monthly Sales Table */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-gray-800">Monthly Sales</h2>
            <button
              onClick={exportMonthlyTableToExcel}
              className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
              title="Export to Excel"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Month</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Amount</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Amount Change</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Quantity</th>
                  <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Quantity Change</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTableData.map((item, index) => (
                  <tr key={item.monthKey} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-base font-semibold text-gray-800 text-center">{item.month}</td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.amount.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </td>
                    <td className={`py-3 px-4 text-base text-center font-semibold ${
                      item.amountDiff > 0 
                        ? 'text-green-600' 
                        : item.amountDiff < 0 
                        ? 'text-red-600' 
                        : 'text-gray-600'
                    }`}>
                      {item.amountDiff !== 0 ? (
                        <>
                          {item.amountDiff > 0 ? '+' : ''}
                          {item.amountDiff.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-base text-gray-800 text-center font-semibold">
                      {item.qty.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </td>
                    <td className={`py-3 px-4 text-base text-center font-semibold ${
                      item.qtyDiff > 0 
                        ? 'text-green-600' 
                        : item.qtyDiff < 0 
                        ? 'text-red-600' 
                        : 'text-gray-600'
                    }`}>
                      {item.qtyDiff !== 0 ? (
                        <>
                          {item.qtyDiff > 0 ? '+' : ''}
                          {item.qtyDiff.toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
                {monthlyTableData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No monthly sales data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
