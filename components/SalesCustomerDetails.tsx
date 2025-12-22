'use client';

import { useState, useMemo, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { ArrowLeft, DollarSign, Package, TrendingUp, BarChart3, Search, Calendar } from 'lucide-react';
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

interface SalesCustomerDetailsProps {
  customerName: string;
  data: SalesInvoice[];
  onBack: () => void;
  initialTab?: 'dashboard' | 'monthly' | 'products';
}

export default function SalesCustomerDetails({ customerName, data, onBack, initialTab = 'dashboard' }: SalesCustomerDetailsProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'monthly' | 'products'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter data for this customer with search and date filters
  const customerData = useMemo(() => {
    let filtered = data.filter(item => item.customerName === customerName);
    
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
        item.barcode.toLowerCase().includes(query) ||
        item.merchandiser.toLowerCase().includes(query) ||
        item.salesRep.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [data, customerName, dateFrom, dateTo, debouncedSearchQuery]);

  // Monthly sales data
  const monthlySales = useMemo(() => {
    const monthMap = new Map<string, { month: string; amount: number; qty: number; invoiceNumbers: Set<string> }>();

    customerData.forEach(item => {
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
        
        // Add invoice number for transaction count
        if (item.invoiceNumber) {
          existing.invoiceNumbers.add(item.invoiceNumber);
        }

        monthMap.set(monthKey, existing);
      } catch (e) {
        // Skip invalid dates
      }
    });

    // Sort by date descending (newest first)
    return Array.from(monthMap.values()).map(item => ({
      month: item.month,
      monthKey: item.monthKey,
      amount: item.amount,
      qty: item.qty,
      count: item.invoiceNumbers.size
    })).sort((a, b) => {
      return b.monthKey.localeCompare(a.monthKey);
    });
  }, [customerData]);

  // Products data
  const productsData = useMemo(() => {
    const productMap = new Map<string, { barcode: string; product: string; amount: number; qty: number }>();
    const barcodeCount = new Map<string, number>();

    customerData.forEach(item => {
      const key = item.barcode || item.product;
      const existing = productMap.get(key) || {
        barcode: item.barcode,
        product: item.product,
        amount: 0,
        qty: 0
      };

      existing.amount += item.amount;
      existing.qty += item.qty;

      productMap.set(key, existing);

      // Count barcode occurrences
      if (item.barcode) {
        barcodeCount.set(item.barcode, (barcodeCount.get(item.barcode) || 0) + 1);
      }
    });

    // Sort by amount descending and mark duplicates
    const result = Array.from(productMap.values()).sort((a, b) => b.amount - a.amount);
    
    // Mark duplicates
    return result.map(item => ({
      ...item,
      isDuplicate: item.barcode ? (barcodeCount.get(item.barcode) || 0) > 1 : false
    }));
  }, [customerData]);

  // Dashboard metrics
  const dashboardMetrics = useMemo(() => {
    const totalAmount = customerData.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = customerData.reduce((sum, item) => sum + item.qty, 0);
    const uniqueProducts = new Set(customerData.map(item => item.barcode || item.product)).size;
    const uniqueMonths = monthlySales.length;
    const avgMonthlyAmount = uniqueMonths > 0 ? totalAmount / uniqueMonths : 0;
    const avgMonthlyQty = uniqueMonths > 0 ? totalQty / uniqueMonths : 0;

    return {
      totalAmount,
      totalQty,
      uniqueProducts,
      uniqueMonths,
      avgMonthlyAmount,
      avgMonthlyQty
    };
  }, [customerData, monthlySales]);

  // Chart data for monthly sales - show last 12 months only, reverse order for chart (oldest to newest for better visualization)
  const chartData = useMemo(() => {
    // Get last 12 months
    const last12Months = monthlySales.slice(0, 12);
    const data = last12Months.map(item => ({
      month: item.month,
      amount: item.amount,
      qty: item.qty,
      isNegativeAmount: item.amount < 0,
      isNegativeQty: item.qty < 0,
    }));
    // Reverse to show oldest to newest (left to right)
    return [...data].reverse();
  }, [monthlySales]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Back to Customers"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-800">{customerName}</h1>
        </div>

        {/* Search and Date Filter */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-[3]">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by product, barcode, merchandiser, sales rep..."
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
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${
              activeTab === 'dashboard'
                ? 'text-green-600 border-green-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${
              activeTab === 'monthly'
                ? 'text-green-600 border-green-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Sales by Month
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex-1 py-3 font-semibold transition-colors border-b-2 text-center ${
              activeTab === 'products'
                ? 'text-green-600 border-green-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            Products
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Sales Amount</h3>
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.totalAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Quantity</h3>
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.totalQty.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Avg Monthly Amount</h3>
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.avgMonthlyAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Avg Monthly Quantity</h3>
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {dashboardMetrics.avgMonthlyQty.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Total Products</h3>
                  <Package className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{dashboardMetrics.uniqueProducts}</p>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Active Months</h3>
                  <BarChart3 className="w-6 h-6 text-teal-600" />
                </div>
                <p className="text-2xl font-bold text-gray-800">{dashboardMetrics.uniqueMonths}</p>
              </div>
            </div>

            {/* Monthly Sales Chart */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Trend</h2>
              {chartData.length > 0 ? (
                <div className="space-y-6">
                  {/* Amount Chart */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Amount</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart 
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
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
                            return [
                              <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                                {value.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>,
                              'Amount'
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
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.4))' }}
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            const isNegative = payload?.isNegativeAmount;
                            return (
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r={isNegative ? 6 : 4} 
                                fill={isNegative ? "#ef4444" : "#10b981"}
                                stroke={isNegative ? "#dc2626" : "#059669"}
                                strokeWidth={isNegative ? 2 : 0}
                                style={{ filter: isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(16, 185, 129, 0.5))' }}
                              />
                            );
                          }}
                          activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Quantity Chart */}
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Sales Quantity</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart 
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
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
                            return [
                              <span key="value" style={{ color: isNegative ? '#ef4444' : '#374151' }}>
                                {value.toLocaleString('en-US', {
                                  minimumFractionDigits: 0,
                                  maximumFractionDigits: 0
                                })}
                              </span>,
                              'Quantity'
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
                            return (
                              <circle 
                                cx={cx} 
                                cy={cy} 
                                r={isNegative ? 6 : 4} 
                                fill={isNegative ? "#ef4444" : "#3b82f6"}
                                stroke={isNegative ? "#dc2626" : "#2563eb"}
                                strokeWidth={isNegative ? 2 : 0}
                                style={{ filter: isNegative ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))' : 'drop-shadow(0 2px 4px rgba(59, 130, 246, 0.5))' }}
                              />
                            );
                          }}
                          activeDot={{ r: 7, fill: '#374151', style: { filter: 'drop-shadow(0 2px 6px rgba(55, 65, 81, 0.5))' } }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  <p>No sales data available for chart</p>
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
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Month</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlySales.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">{item.month}</td>
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
                      <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">{item.count}</td>
                    </tr>
                  ))}
                  {monthlySales.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        No monthly data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Products Sales</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Barcode</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Product</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {productsData.map((item, index) => (
                    <tr 
                      key={index} 
                      className={`border-b border-gray-100 hover:bg-gray-50 ${
                        item.isDuplicate ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{index + 1}</td>
                      <td className={`py-3 px-4 text-sm font-medium text-center ${
                        item.isDuplicate ? 'text-red-600 font-bold' : 'text-gray-800'
                      }`}>
                        {item.barcode || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center">{item.product}</td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                        {item.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
                        {item.qty.toLocaleString('en-US', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0
                        })}
                      </td>
                    </tr>
                  ))}
                  {productsData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No products data available
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

