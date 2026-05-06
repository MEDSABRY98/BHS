'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { ArrowLeft, DollarSign, Package, TrendingUp, BarChart3, Search, Calendar, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import NoData from '../01-Unified/NoDataTab';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';

interface SalesProductDetailsProps {
  barcode: string;
  data: SalesInvoice[];
  allData: SalesInvoice[]; // Geography filtered but not date filtered
  onBack: () => void;
  initialTab?: 'dashboard' | 'monthly' | 'products';
  filterYear?: string;
}

export default function SalesProductDetails({ barcode, data, allData, onBack, initialTab = 'dashboard', filterYear }: SalesProductDetailsProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'products'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [customerTypeView, setCustomerTypeView] = useState<'main' | 'sub'>('sub');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter data for this barcode with search and date filters
  const productData = useMemo(() => {
    let filtered = data.filter(item => item.barcode === barcode);

    // Date filter
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

    // Search filter
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product.toLowerCase().includes(query) ||
        item.customerName.toLowerCase().includes(query) ||
        item.merchandiser.toLowerCase().includes(query) ||
        item.salesRep.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [data, barcode, dateFrom, dateTo, debouncedSearchQuery]);

  // Get product name (use first occurrence)
  const productName = useMemo(() => {
    const firstItem = data.find(item => item.barcode === barcode);
    return firstItem?.product || barcode;
  }, [data, barcode]);

  // Monthly sales data
  const monthlySales = useMemo(() => {
    const monthMap = new Map<string, { month: string; monthKey: string; amount: number; qty: number; invoiceNumbers: Set<string> }>();

    productData.forEach(item => {
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
          invoiceNumbers: new Set<string>()
        };

        existing.amount += item.amount;
        existing.qty += item.qty;

        // Add invoice number for transaction count (only invoices starting with "SAL")
        if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
          existing.invoiceNumbers.add(item.invoiceNumber);
        }

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Sort by date descending (newest first)
    const sorted = Array.from(monthMap.values()).map(item => ({
      month: item.month,
      monthKey: item.monthKey,
      amount: item.amount,
      qty: item.qty,
      count: item.invoiceNumbers.size
    })).sort((a, b) => {
      return b.monthKey.localeCompare(a.monthKey);
    });

    // Fill in missing months from first sale month to current month
    if (sorted.length > 0) {
      // Find first month (oldest) and last month (newest)
      const firstMonthKey = sorted[sorted.length - 1].monthKey; // Oldest (last in descending order)
      const lastMonthKey = sorted[0].monthKey; // Newest (first in descending order)

      // Parse first month
      const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);

      // Get current date
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-based
      const currentMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

      // Use current month or last sale month, whichever is newer
      const endMonthKey = currentMonthKey > lastMonthKey ? currentMonthKey : lastMonthKey;
      const [endYear, endMonth] = endMonthKey.split('-').map(Number);

      // Create a map for quick lookup
      const monthDataMap = new Map(sorted.map(item => [item.monthKey, item]));

      // Generate all months from first to end
      const allMonths: Array<{
        month: string;
        monthKey: string;
        amount: number;
        qty: number;
        count: number;
        isZeroMonth: boolean;
      }> = [];

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      let year = firstYear;
      let month = firstMonth;

      while (year < endYear || (year === endYear && month <= endMonth)) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const monthLabel = `${monthNames[month - 1]} ${String(year).slice(-2)}`;

        const existingData = monthDataMap.get(monthKey);

        if (existingData) {
          allMonths.push({
            ...existingData,
            isZeroMonth: false
          });
        } else {
          // Zero month - no sales
          allMonths.push({
            month: monthLabel,
            monthKey,
            amount: 0,
            qty: 0,
            count: 0,
            isZeroMonth: true
          });
        }

        // Move to next month
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      // Sort by date descending (newest first)
      allMonths.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

      // Calculate amount change from previous month
      return allMonths.map((item, index) => {
        const previousAmount = index < allMonths.length - 1 ? allMonths[index + 1].amount : null;
        const amountChange = previousAmount !== null ? item.amount - previousAmount : null;

        return {
          ...item,
          amountChange
        };
      });
    }

    return [];
  }, [productData]);

  // Customers data - grouped by customerId or customerMainName, display customerName or customerMainName
  const customersData = useMemo(() => {
    const customerMap = new Map<string, {
      customerId: string;
      customer: string;
      amount: number;
      qty: number;
      invoiceNumbers: Set<string>;
      lastInvoiceDate: string | null;
    }>();

    productData.forEach(item => {
      const key = customerTypeView === 'main'
        ? (item.customerMainName || item.customerName)
        : (item.customerId || item.customerName);

      const displayName = customerTypeView === 'main'
        ? (item.customerMainName || item.customerName)
        : item.customerName;

      const existing = customerMap.get(key);

      if (!existing) {
        customerMap.set(key, {
          customerId: key,
          customer: displayName,
          amount: 0,
          qty: 0,
          invoiceNumbers: new Set<string>(),
          lastInvoiceDate: null
        });
      }

      const customer = customerMap.get(key)!;
      customer.amount += item.amount;
      customer.qty += item.qty;

      // Add invoice number if available (only invoices starting with "SAL")
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        customer.invoiceNumbers.add(item.invoiceNumber);
      }

      // Update last invoice date
      if (item.invoiceDate) {
        try {
          const itemDate = new Date(item.invoiceDate);
          if (!isNaN(itemDate.getTime())) {
            if (!customer.lastInvoiceDate) {
              customer.lastInvoiceDate = item.invoiceDate;
            } else {
              const existingDate = new Date(customer.lastInvoiceDate);
              if (itemDate > existingDate) {
                customer.lastInvoiceDate = item.invoiceDate;
              }
            }
          }
        } catch (e) {
          // Invalid date, skip
        }
      }
    });

    // Sort by amount descending and add invoice count
    return Array.from(customerMap.values()).map(customer => ({
      ...customer,
      invoiceCount: customer.invoiceNumbers.size
    })).sort((a, b) => b.amount - a.amount);
  }, [productData, customerTypeView]);

  // Dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalAmount = productData.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = productData.reduce((sum, item) => sum + item.qty, 0);
    // Count unique customers by customerId
    const uniqueCustomerIds = new Set(productData.map(item => item.customerId || item.customerName));
    const uniqueCustomers = uniqueCustomerIds.size;

    // Calculate months from first month to current month (not just active months)
    let totalMonths = 1;
    if (monthlySales.length > 0) {
      // Find earliest month from monthlySales
      const sortedMonths = [...monthlySales].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
      const firstMonthKey = sortedMonths[0].monthKey;
      const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);

      // Get current date
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-based for comparison

      // Calculate months from first month to current month (inclusive)
      const firstDate = new Date(firstYear, firstMonth - 1, 1);
      const lastDate = new Date(currentYear, currentMonth - 1, 1);

      // Calculate difference in months
      const yearsDiff = lastDate.getFullYear() - firstDate.getFullYear();
      const monthsDiff = lastDate.getMonth() - firstDate.getMonth();
      totalMonths = (yearsDiff * 12) + monthsDiff + 1; // +1 to include both start and end months
    }

    const avgMonthlyAmount = totalMonths > 0 ? totalAmount / totalMonths : 0;
    const avgMonthlyQty = totalMonths > 0 ? totalQty / totalMonths : 0;

    // Count only months where product actually had sales (not zero months)
    const activeMonths = monthlySales.filter(month => !month.isZeroMonth && month.count > 0).length;

    return {
      totalAmount,
      totalQty,
      uniqueCustomers,
      uniqueMonths: activeMonths, // Only months with actual sales
      totalMonths, // Total months from start to now
      avgMonthlyAmount,
      avgMonthlyQty
    };
  }, [productData, monthlySales]);

  // Get all product data from unfiltered source (for comparison)
  const productAllData = useMemo(() => {
    const source = allData.length > 0 ? allData : data;
    return source.filter(item => item.barcode === barcode);
  }, [allData, data, barcode]);

  // Chart data for monthly sales - Jan-Dec comparison
  const chartData = useMemo(() => {
    if (productAllData.length === 0) return [];

    const monthMap = new Map<string, { amount: number; qty: number }>();
    productAllData.forEach(item => {
      if (!item.invoiceDate) return;
      const date = new Date(item.invoiceDate);
      if (isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthMap.get(key) || { amount: 0, qty: 0 };
      existing.amount += item.amount;
      existing.qty += item.qty;
      monthMap.set(key, existing);
    });

    // Determine target year
    let targetYear: number;
    if (filterYear) {
      targetYear = parseInt(filterYear, 10);
    } else {
      const allKeys = Array.from(monthMap.keys()).sort();
      const latestKey = allKeys[allKeys.length - 1];
      targetYear = latestKey ? parseInt(latestKey.split('-')[0], 10) : new Date().getFullYear();
    }

    const prevYear = targetYear - 1;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;
    const result = [];

    for (let m = 1; m <= 12; m++) {
      const currKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      const prevKey = `${prevYear}-${String(m).padStart(2, '0')}`;

      const currData = monthMap.get(currKey) || { amount: 0, qty: 0 };
      const prevData = monthMap.get(prevKey) || { amount: 0, qty: 0 };

      const diffAmount = currData.amount - prevData.amount;
      const percentAmount = prevData.amount !== 0 ? (diffAmount / Math.abs(prevData.amount)) * 100 : (currData.amount !== 0 ? 100 : 0);

      const diffQty = currData.qty - prevData.qty;
      const percentQty = prevData.qty !== 0 ? (diffQty / Math.abs(prevData.qty)) * 100 : (currData.qty !== 0 ? 100 : 0);

      const isFuture = (targetYear > nowYear) || (targetYear === nowYear && m > nowMonth);

      result.push({
        month: monthNames[m - 1],
        currentAmount: currData.amount,
        prevAmount: prevData.amount,
        diffAmount,
        percentAmount,
        isPositiveAmount: diffAmount >= 0,
        currentQty: currData.qty,
        prevQty: prevData.qty,
        diffQty,
        percentQty,
        isPositiveQty: diffQty >= 0,
        isFuture,
        legendCurr: String(targetYear),
        legendPrev: String(prevYear)
      });
    }

    // Set baselines for indicators
    const maxAmount = Math.max(...result.map(r => Math.max(r.currentAmount, r.prevAmount)));
    const maxQty = Math.max(...result.map(r => Math.max(r.currentQty, r.prevQty)));
    
    result.forEach(r => {
      // @ts-ignore
      r.topBaselineAmount = maxAmount * 1.25;
      // @ts-ignore
      r.topBaselineQty = maxQty * 1.25;
    });

    return result;
  }, [productAllData, filterYear]);

  const exportCustomersToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const headers = ['#', 'Customer Name', 'Amount', 'Quantity', 'Purchase Count', 'Last Invoice Date'];

    const rows = customersData.map((item: any, index: number) => [
      index + 1,
      item.customer,
      item.amount.toFixed(2),
      item.qty.toFixed(0),
      item.invoiceCount || 0,
      item.lastInvoiceDate ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : '-',
    ]);

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Customers');

    const safeBarcode = (barcode || 'product').replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'product';
    const filename = `sales_product_customers_${safeBarcode}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Back to Products"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{productName}</h1>
            <p className="text-sm text-gray-600 mt-1">Barcode: {barcode}</p>
          </div>
        </div>

        {/* Search and Date Filter */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-[3]">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by customer, product, merchandiser, sales rep..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
          <div className="relative flex-1">
            <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
          <div className="relative flex-1">
            <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6 flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'dashboard'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'monthly'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            Sales by Month
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${activeTab === 'products'
              ? 'text-green-600 border-green-600'
              : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
          >
            Customers
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Total Sales Amount</h3>
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-xl font-black text-gray-800">
                  {dashboardMetrics.totalAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Total Quantity</h3>
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-xl font-black text-gray-800">
                  {dashboardMetrics.totalQty.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Avg Monthly Amount</h3>
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-xl font-black text-gray-800">
                  {dashboardMetrics.avgMonthlyAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Avg Monthly Quantity</h3>
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-xl font-black text-gray-800">
                  {dashboardMetrics.avgMonthlyQty.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Total Customers</h3>
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-xl font-black text-gray-800">{dashboardMetrics.uniqueCustomers}</p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Active Months</h3>
                  <BarChart3 className="w-5 h-5 text-teal-600" />
                </div>
                <p className="text-xl font-black text-gray-800">{dashboardMetrics.uniqueMonths}</p>
              </div>
            </div>

            {/* Monthly Sales Performance Comparison */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Performance Comparison</h2>
              {chartData.length > 0 ? (
                <div className="space-y-12">
                  {/* Amount Chart */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-700 mb-6 flex items-center gap-2 uppercase tracking-wider">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Sales Amount Comparison
                    </h3>
                    <div className="relative w-full" style={{ height: '550px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 80, right: 30, left: 40, bottom: 20 }}
                          barGap={8}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                          <XAxis 
                            dataKey="month" 
                            stroke="#475569" 
                            style={{ fontSize: '15px', fontWeight: 900 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis hide={true} domain={[0, 'auto']} />
                          <Tooltip 
                            content={(props: any) => {
                              const { active, payload, label } = props;
                              if (active && payload && payload.length > 0) {
                                const data = payload[0].payload;
                                const isPositive = data.isPositiveAmount;
                                return (
                                  <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 min-w-[180px]">
                                    <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{label}</p>
                                    <div className="space-y-2 text-sm">
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">{data.legendPrev}:</span>
                                        <span className="font-bold text-slate-700">
                                          {data.prevAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">{data.legendCurr}:</span>
                                        <span className="font-bold text-emerald-600">
                                          {data.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">Diff:</span>
                                        <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {isPositive ? '+' : '-'}{Math.abs(data.diffAmount).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">Growth:</span>
                                        <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {isPositive ? '+' : '-'}{data.percentAmount.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend verticalAlign="top" height={36} />

                          {/* Previous Year Bar */}
                          <Bar 
                            dataKey="prevAmount" 
                            name={chartData[0]?.legendPrev || "Last Year"} 
                            fill="#cbd5e1" 
                            radius={[4, 4, 0, 0]}
                            barSize={45}
                          >
                            <LabelList 
                              dataKey="prevAmount" 
                              position="top" 
                              formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                              style={{ fontSize: '13px', fontWeight: '900', fill: '#64748b' }}
                              offset={10}
                            />
                          </Bar>

                          {/* Current Year Bar */}
                          <Bar 
                            dataKey="currentAmount" 
                            name={chartData[0]?.legendCurr || "Current Year"} 
                            fill="#10b981" 
                            radius={[4, 4, 0, 0]}
                            barSize={45}
                          >
                            <LabelList 
                              dataKey="currentAmount" 
                              position="top" 
                              formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                              style={{ fontSize: '13px', fontWeight: '900', fill: '#059669' }}
                              offset={10}
                            />
                            
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-amount-${index}`} fill={entry.isPositiveAmount ? '#10b981' : '#f43f5e'} />
                            ))}
                          </Bar>

                          {/* Performance Labels */}
                          <Line 
                            type="monotone" 
                            dataKey="topBaselineAmount" 
                            stroke="none" 
                            dot={false} 
                            activeDot={false} 
                            legendType="none" 
                          >
                            <LabelList 
                              dataKey="diffAmount" 
                              content={(props: any) => {
                                const { x, index } = props;
                                const entry = chartData[index];
                                if (!entry) return null;
                                
                                const isPositive = entry.isPositiveAmount;
                                const isFuture = entry.isFuture && entry.currentAmount === 0;
                                const color = isFuture ? '#94a3b8' : (isPositive ? '#059669' : '#e11d48');
                                
                                const diffStr = isFuture ? '-' : ((isPositive ? '▲ +' : '▼ ') + Math.abs(entry.diffAmount).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }));
                                const percentStr = isFuture ? '' : (entry.percentAmount.toFixed(1) + '%');

                                return (
                                  <g style={{ pointerEvents: 'none' }}>
                                    <rect x={x - 45} y={10} width={90} height={55} rx={12} fill={isFuture ? '#f8fafc' : (isPositive ? '#f0fdf4' : '#fef2f2')} stroke={isFuture ? '#e2e8f0' : (isPositive ? '#bcf0da' : '#fecaca')} strokeWidth={1.5} className="shadow-sm" />
                                    <text x={x} y={isFuture ? 42 : 35} fill={color} textAnchor="middle" style={{ fontSize: isFuture ? '20px' : '14px', fontWeight: '900' }}>{diffStr}</text>
                                    {!isFuture && <text x={x} y={55} fill={color} textAnchor="middle" style={{ fontSize: '12px', fontWeight: '800', opacity: 0.8 }}>{percentStr}</text>}
                                  </g>
                                );
                              }} 
                            />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Quantity Chart */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md overflow-hidden">
                    <h3 className="text-sm font-semibold text-gray-700 mb-6 flex items-center gap-2 uppercase tracking-wider">
                      <Package className="w-4 h-4 text-blue-600" />
                      Sales Quantity Comparison
                    </h3>
                    <div className="relative w-full" style={{ height: '550px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 80, right: 30, left: 40, bottom: 20 }}
                          barGap={8}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                          <XAxis 
                            dataKey="month" 
                            stroke="#475569" 
                            style={{ fontSize: '15px', fontWeight: 900 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                          />
                          <YAxis hide={true} domain={[0, 'auto']} />
                          <Tooltip 
                            content={(props: any) => {
                              const { active, payload, label } = props;
                              if (active && payload && payload.length > 0) {
                                const data = payload[0].payload;
                                const isPositive = data.isPositiveQty;
                                return (
                                  <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 min-w-[180px]">
                                    <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{label}</p>
                                    <div className="space-y-2 text-sm">
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">{data.legendPrev}:</span>
                                        <span className="font-bold text-slate-700">
                                          {data.prevQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">{data.legendCurr}:</span>
                                        <span className="font-bold text-blue-600">
                                          {data.currentQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">Diff:</span>
                                        <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {isPositive ? '+' : '-'}{Math.abs(data.diffQty).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 font-medium w-20 inline-block">Growth:</span>
                                        <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                          {isPositive ? '+' : '-'}{data.percentQty.toFixed(1)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Legend verticalAlign="top" height={36} />

                          {/* Previous Year Bar */}
                          <Bar 
                            dataKey="prevQty" 
                            name={chartData[0]?.legendPrev || "Last Year"} 
                            fill="#cbd5e1" 
                            radius={[4, 4, 0, 0]}
                            barSize={45}
                          >
                            <LabelList 
                              dataKey="prevQty" 
                              position="top" 
                              formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                              style={{ fontSize: '13px', fontWeight: '900', fill: '#64748b' }}
                              offset={10}
                            />
                          </Bar>

                          {/* Current Year Bar */}
                          <Bar 
                            dataKey="currentQty" 
                            name={chartData[0]?.legendCurr || "Current Year"} 
                            fill="#3b82f6" 
                            radius={[4, 4, 0, 0]}
                            barSize={45}
                          >
                            <LabelList 
                              dataKey="currentQty" 
                              position="top" 
                              formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                              style={{ fontSize: '13px', fontWeight: '900', fill: '#2563eb' }}
                              offset={10}
                            />
                            
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-qty-${index}`} fill={entry.isPositiveQty ? '#3b82f6' : '#f43f5e'} />
                            ))}
                          </Bar>

                          {/* Performance Labels */}
                          <Line 
                            type="monotone" 
                            dataKey="topBaselineQty" 
                            stroke="none" 
                            dot={false} 
                            activeDot={false} 
                            legendType="none" 
                          >
                            <LabelList 
                              dataKey="diffQty" 
                              content={(props: any) => {
                                const { x, index } = props;
                                const entry = chartData[index];
                                if (!entry) return null;
                                
                                const isPositive = entry.isPositiveQty;
                                const isFuture = entry.isFuture && entry.currentQty === 0;
                                const color = isFuture ? '#94a3b8' : (isPositive ? '#059669' : '#e11d48');
                                
                                const diffStr = isFuture ? '-' : ((isPositive ? '▲ +' : '▼ ') + Math.abs(entry.diffQty).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }));
                                const percentStr = isFuture ? '' : (entry.percentQty.toFixed(1) + '%');

                                return (
                                  <g style={{ pointerEvents: 'none' }}>
                                    <rect x={x - 45} y={10} width={90} height={55} rx={12} fill={isFuture ? '#f8fafc' : (isPositive ? '#f0fdf4' : '#fef2f2')} stroke={isFuture ? '#e2e8f0' : (isPositive ? '#bcf0da' : '#fecaca')} strokeWidth={1.5} className="shadow-sm" />
                                    <text x={x} y={isFuture ? 42 : 35} fill={color} textAnchor="middle" style={{ fontSize: isFuture ? '20px' : '14px', fontWeight: '900' }}>{diffStr}</text>
                                    {!isFuture && <text x={x} y={55} fill={color} textAnchor="middle" style={{ fontSize: '12px', fontWeight: '800', opacity: 0.8 }}>{percentStr}</text>}
                                  </g>
                                );
                              }} 
                            />
                          </Line>
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <NoData />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Sales Tab */}
        {activeTab === 'monthly' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Sales by Month</h2>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-40">Month</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-40">Change</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-28">Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySales.map((item, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-100 hover:bg-gray-50 ${item.isZeroMonth ? 'bg-gray-50 opacity-60' : ''
                        }`}
                    >
                      <td className={`py-3 px-4 text-base font-medium text-center ${item.isZeroMonth ? 'text-gray-500 line-through' : 'text-gray-800'
                        }`}>
                        {item.month}
                      </td>
                      <td className={`py-3 px-4 text-base font-semibold text-center ${item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}>
                        {item.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-base font-semibold text-center">
                        {item.amountChange !== null ? (
                          <span className={item.amountChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {item.amountChange >= 0 ? '+' : ''}
                            {item.amountChange.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-base font-semibold text-center ${item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}>
                        {item.qty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className={`py-3 px-4 text-base font-semibold text-center ${item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                        }`}>
                        {item.count}
                      </td>
                    </tr>
                  ))}
                  {monthlySales.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-12">
                        <NoData />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-800">Customers Sales</h2>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button
                    onClick={() => setCustomerTypeView('main')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${customerTypeView === 'main'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Main Customers
                  </button>
                  <button
                    onClick={() => setCustomerTypeView('sub')}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${customerTypeView === 'sub'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Sub Customers
                  </button>
                </div>
              </div>
              <button
                onClick={exportCustomersToExcel}
                className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all shadow-md active:scale-95"
                title="Export to Excel"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-16">#</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-64">Customer Name</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-24">Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">P. Count</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-40">Last Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customersData.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-base text-gray-600 font-medium text-center">{index + 1}</td>
                      <td className="py-3 px-4 text-base text-gray-800 font-medium text-center w-64 truncate" title={item.customer}>{item.customer}</td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.qty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                        {item.invoiceCount || 0}
                      </td>
                      <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">
                        {item.lastInvoiceDate ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : '-'}
                      </td>
                    </tr>
                  ))}
                  {customersData.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-12">
                        <NoData />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
