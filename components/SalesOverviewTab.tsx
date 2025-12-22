'use client';

import { useState, useMemo } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { TrendingUp, Package, Users, DollarSign, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';

interface SalesOverviewTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

type SortField = 'amount' | 'qty' | null;
type SortDirection = 'asc' | 'desc';

export default function SalesOverviewTab({ data, loading }: SalesOverviewTabProps) {
  const [topCount, setTopCount] = useState<number>(10);
  
  // Sorting states for products
  const [productSortBy, setProductSortBy] = useState<'amount' | 'qty'>('amount');
  const [productSortDirection, setProductSortDirection] = useState<SortDirection>('desc');
  
  // Sorting states for customers
  const [customerSortBy, setCustomerSortBy] = useState<'amount' | 'qty'>('amount');
  const [customerSortDirection, setCustomerSortDirection] = useState<SortDirection>('desc');

  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
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

    const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
    const totalQty = data.reduce((sum, item) => sum + item.qty, 0);
    const uniqueCustomers = new Set(data.map(item => item.customerName)).size;
    const uniqueProducts = new Set(data.map(item => item.product)).size;
    const avgAmountPerSale = totalAmount / data.length;
    const avgQtyPerSale = totalQty / data.length;

    // Calculate monthly averages
    const monthsSet = new Set<string>();
    const monthlyData = new Map<string, { amount: number; qty: number }>();
    
    data.forEach(item => {
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
  }, [data]);

  // Products data - grouped by BARCODE
  const productsData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const barcodeMap = new Map<string, { 
      barcode: string; 
      products: string[]; 
      totalAmount: number; 
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();
    
    data.forEach(item => {
      const key = item.barcode;
      const existing = barcodeMap.get(key) || { 
        barcode: key, 
        products: [], 
        totalAmount: 0, 
        totalQty: 0,
        invoiceNumbers: new Set<string>()
      };
      
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
      
      barcodeMap.set(key, existing);
    });

    return Array.from(barcodeMap.values()).map(item => ({
      barcode: item.barcode,
      products: item.products,
      totalAmount: item.totalAmount,
      totalQty: item.totalQty,
      transactions: item.invoiceNumbers.size
    }));
  }, [data]);

  // Customers data
  const customersData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const customerMap = new Map<string, { 
      customer: string; 
      totalAmount: number; 
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();
    
    data.forEach(item => {
      const key = item.customerName;
      const existing = customerMap.get(key) || { 
        customer: key, 
        totalAmount: 0, 
        totalQty: 0,
        invoiceNumbers: new Set<string>()
      };
      existing.totalAmount += item.amount;
      existing.totalQty += item.qty;
      
      // Add invoice number for transaction count
      if (item.invoiceNumber) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }
      
      customerMap.set(key, existing);
    });

    return Array.from(customerMap.values()).map(item => ({
      customer: item.customer,
      totalAmount: item.totalAmount,
      totalQty: item.totalQty,
      transactions: item.invoiceNumbers.size
    }));
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Sales Overview</h1>
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

        {/* Top Count Input */}
        <div className="mb-6 flex items-center justify-end">
          <div className="flex items-center gap-3">
            <label htmlFor="topCount" className="text-sm font-medium text-gray-700">
              Show Top:
            </label>
            <input
              id="topCount"
              type="number"
              min="1"
              max="100"
              value={topCount}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value > 0 && value <= 100) {
                  setTopCount(value);
                }
              }}
              className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center font-medium"
            />
          </div>
        </div>

        {/* Customers Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Top Customers</h2>
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
