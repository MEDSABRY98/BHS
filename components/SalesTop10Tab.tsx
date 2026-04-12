'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Package, Users, ArrowUp, ArrowDown, Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, Filter, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface SalesTop10TabProps {
  data: SalesInvoice[];
  loading: boolean;
}

type SortDirection = 'asc' | 'desc';

export default function SalesTop10Tab({ data, loading }: SalesTop10TabProps) {
  const [topCount, setTopCount] = useState<number>(10);

  // Sorting states for products
  const [productSortBy, setProductSortBy] = useState<'amount' | 'qty'>('amount');
  const [productSortDirection, setProductSortDirection] = useState<SortDirection>('desc');

  // Sorting states for customers
  const [customerSortBy, setCustomerSortBy] = useState<'amount' | 'qty'>('amount');
  const [customerSortDirection, setCustomerSortDirection] = useState<SortDirection>('desc');

  // Products data - grouped by PRODUCT ID
  const productsData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const productMap = new Map<string, {
      productId: string;
      barcodes: Set<string>;
      products: string[];
      totalAmount: number;
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();

    data.forEach(item => {
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
  }, [data]);

  // Customers data - grouped by customerId, display customerName
  const customersData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const customerMap = new Map<string, {
      customerId: string;
      customerName: string;
      totalAmount: number;
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();

    data.forEach(item => {
      const key = item.customerId || item.customerName; // Fallback to customerName if customerId is missing
      const existing = customerMap.get(key) || {
        customerId: key,
        customerName: item.customerName,
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
      customer: item.customerName, // Display customerName
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
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-medium text-slate-800">Sales TOP10</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
              title="Export to Excel"
            >
              <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
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
  );
}

