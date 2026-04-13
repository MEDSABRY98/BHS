'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, ChevronLeft, ChevronRight, Search, X, Filter, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import NoData from './Unified/NoData';

interface SalesDailySalesTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

export default function SalesDailySalesTab({ data, loading }: SalesDailySalesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSubTab, setActiveSubTab] = useState<'all-invoices' | 'sales-by-day' | 'avg-sales-by-day'>('all-invoices');
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<'all' | 'sales' | 'returns'>('all');
  const itemsPerPage = 50;

  // Format date as DD/MM/YYYY
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      return '';
    }
  };

  // Group invoices by invoiceNumber
  const dailySalesData = useMemo(() => {
    const invoiceMap = new Map<string, {
      invoiceDate: string;
      invoiceNumber: string;
      customerName: string;
      amount: number;
      qty: number;
      products: Set<string>;
      totalCost: number;
      totalPrice: number;
      costCount: number;
      priceCount: number;
    }>();

    data.forEach(item => {
      if (!item.invoiceNumber) return;

      const existing = invoiceMap.get(item.invoiceNumber) || {
        invoiceDate: item.invoiceDate || '',
        invoiceNumber: item.invoiceNumber,
        customerName: item.customerName || '',
        amount: 0,
        qty: 0,
        products: new Set<string>(),
        totalCost: 0,
        totalPrice: 0,
        costCount: 0,
        priceCount: 0
      };

      existing.amount += item.amount || 0;
      existing.qty += item.qty || 0;

      // Add product to set
      const productKey = item.productId || item.barcode || item.product;
      if (productKey) {
        existing.products.add(productKey);
      }

      // Add cost and price
      if (item.productCost) {
        existing.totalCost += item.productCost;
        existing.costCount += 1;
      }
      if (item.productPrice) {
        existing.totalPrice += item.productPrice;
        existing.priceCount += 1;
      }

      invoiceMap.set(item.invoiceNumber, existing);
    });

    // Convert to array and calculate averages
    const allInvoices = Array.from(invoiceMap.values()).map(invoice => {
      const avgCost = invoice.costCount > 0 ? invoice.totalCost / invoice.costCount : 0;
      const avgPrice = invoice.priceCount > 0 ? invoice.totalPrice / invoice.priceCount : 0;

      return {
        invoiceDate: invoice.invoiceDate,
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        amount: invoice.amount,
        qty: invoice.qty,
        productsCount: invoice.products.size,
        avgCost,
        avgPrice
      };
    }).sort((a, b) => {
      const dateA = new Date(a.invoiceDate).getTime();
      const dateB = new Date(b.invoiceDate).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return b.invoiceNumber.localeCompare(a.invoiceNumber);
    });

    // Apply type filter
    if (invoiceTypeFilter === 'all') return allInvoices;
    return allInvoices.filter(inv => {
      const num = inv.invoiceNumber.trim().toUpperCase();
      if (invoiceTypeFilter === 'sales') return num.startsWith('SAL');
      if (invoiceTypeFilter === 'returns') return num.startsWith('RSAL');
      return true;
    });
  }, [data, invoiceTypeFilter]);

  // Calculate statistics for All Invoices tab
  const allInvoicesStats = useMemo(() => {
    const salesInvoices = dailySalesData.filter((inv: any) => inv.invoiceNumber.toUpperCase().startsWith('SAL'));
    const returnInvoices = dailySalesData.filter((inv: any) => inv.invoiceNumber.toUpperCase().startsWith('RSAL'));

    const totalSales = salesInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);
    const totalReturns = returnInvoices.reduce((sum: number, inv: any) => sum + Math.abs(inv.amount), 0);

    const netSales = dailySalesData.reduce((sum: number, inv: any) => sum + inv.amount, 0);

    return {
      netSales,
      totalSales,
      totalReturns,
      salesCount: salesInvoices.length,
      returnsCount: returnInvoices.length
    };
  }, [dailySalesData]);

  // Sales by Day - group by date
  const salesByDayData = useMemo(() => {
    const dateMap = new Map<string, {
      date: string;
      amount: number;
      qty: number;
      invoiceNumbers: Set<string>;
      products: Set<string>;
      customers: Set<string>;
      salInvoiceNumbers: Set<string>; // Only invoices starting with SAL
      salProducts: Set<string>; // Only products from SAL invoices
      salCustomers: Set<string>; // Only customers from SAL invoices
    }>();

    data.forEach(item => {
      if (!item.invoiceDate) return;

      const dateKey = formatDate(item.invoiceDate);
      if (!dateKey) return;

      const existing = dateMap.get(dateKey) || {
        date: dateKey,
        amount: 0,
        qty: 0,
        invoiceNumbers: new Set<string>(),
        products: new Set<string>(),
        customers: new Set<string>(),
        salInvoiceNumbers: new Set<string>(),
        salProducts: new Set<string>(),
        salCustomers: new Set<string>()
      };

      existing.amount += item.amount || 0;
      existing.qty += item.qty || 0;

      if (item.invoiceNumber) {
        existing.invoiceNumbers.add(item.invoiceNumber);

        // Only count SAL invoices for specific metrics
        if (item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
          existing.salInvoiceNumbers.add(item.invoiceNumber);

          const productKey = item.productId || item.barcode || item.product;
          if (productKey) {
            existing.salProducts.add(productKey);
          }

          const customerKey = item.customerId || item.customerName;
          if (customerKey) {
            existing.salCustomers.add(customerKey);
          }
        }
      }

      const productKey = item.productId || item.barcode || item.product;
      if (productKey) {
        existing.products.add(productKey);
      }

      // Add customer (use customerId if available, otherwise customerName)
      const customerKey = item.customerId || item.customerName;
      if (customerKey) {
        existing.customers.add(customerKey);
      }

      dateMap.set(dateKey, existing);
    });

    return Array.from(dateMap.values()).map(item => ({
      date: item.date,
      amount: item.amount,
      qty: item.qty,
      invoicesCount: item.invoiceNumbers.size,
      productsCount: item.products.size,
      customersCount: item.customers.size,
      salInvoicesCount: item.salInvoiceNumbers.size,
      salProductsCount: item.salProducts.size,
      salCustomersCount: item.salCustomers.size
    })).sort((a, b) => {
      // Sort by date descending (newest first)
      const dateA = new Date(a.date.split('/').reverse().join('-')).getTime();
      const dateB = new Date(b.date.split('/').reverse().join('-')).getTime();
      return dateB - dateA;
    });
  }, [data]);

  // AVG Sales BY Day - group by month and calculate daily averages
  const avgSalesByDayData = useMemo(() => {
    const monthMap = new Map<string, {
      monthKey: string;
      monthYear: string;
      totalAmount: number;
      totalQty: number;
      totalInvoices: number;
      totalCustomers: number;
      totalProducts: number;
      daysCount: number;
    }>();

    // Use salesByDayData to calculate monthly averages
    salesByDayData.forEach(item => {
      if (!item.date) return;

      // Parse date from DD/MM/YYYY format
      const [day, month, year] = item.date.split('/');
      if (!day || !month || !year) return;

      const monthKey = `${year}-${month.padStart(2, '0')}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[parseInt(month) - 1] || month;
      const monthYear = `${monthName.toUpperCase()} ${year}`;

      const existing = monthMap.get(monthKey) || {
        monthKey,
        monthYear,
        totalAmount: 0,
        totalQty: 0,
        totalInvoices: 0,
        totalCustomers: 0,
        totalProducts: 0,
        daysCount: 0
      };

      existing.totalAmount += item.amount;
      existing.totalQty += item.qty;
      existing.totalInvoices += item.salInvoicesCount; // Only SAL invoices
      existing.totalCustomers += item.salCustomersCount; // Only SAL customers
      existing.totalProducts += item.salProductsCount; // Only SAL products
      existing.daysCount += 1;

      monthMap.set(monthKey, existing);
    });

    return Array.from(monthMap.values()).map(item => ({
      monthKey: item.monthKey,
      monthYear: item.monthYear,
      avgAmount: item.daysCount > 0 ? item.totalAmount / item.daysCount : 0,
      avgQty: item.daysCount > 0 ? item.totalQty / item.daysCount : 0,
      avgInvoices: item.daysCount > 0 ? item.totalInvoices / item.daysCount : 0,
      avgCustomers: item.daysCount > 0 ? item.totalCustomers / item.daysCount : 0,
      avgProducts: item.daysCount > 0 ? item.totalProducts / item.daysCount : 0
    })).sort((a, b) => {
      // Sort by month key descending (newest first)
      return b.monthKey.localeCompare(a.monthKey);
    });
  }, [salesByDayData]);

  // Get bounds for heat map in AVG Sales BY Day
  const avgSalesByDayBounds = useMemo(() => {
    if (avgSalesByDayData.length === 0) return null;

    const bounds = {
      avgAmount: { min: Infinity, max: -Infinity },
      avgQty: { min: Infinity, max: -Infinity },
      avgInvoices: { min: Infinity, max: -Infinity },
      avgCustomers: { min: Infinity, max: -Infinity },
      avgProducts: { min: Infinity, max: -Infinity },
    };

    avgSalesByDayData.forEach(item => {
      bounds.avgAmount.min = Math.min(bounds.avgAmount.min, item.avgAmount);
      bounds.avgAmount.max = Math.max(bounds.avgAmount.max, item.avgAmount);

      bounds.avgQty.min = Math.min(bounds.avgQty.min, item.avgQty);
      bounds.avgQty.max = Math.max(bounds.avgQty.max, item.avgQty);

      bounds.avgInvoices.min = Math.min(bounds.avgInvoices.min, item.avgInvoices);
      bounds.avgInvoices.max = Math.max(bounds.avgInvoices.max, item.avgInvoices);

      bounds.avgCustomers.min = Math.min(bounds.avgCustomers.min, item.avgCustomers);
      bounds.avgCustomers.max = Math.max(bounds.avgCustomers.max, item.avgCustomers);

      bounds.avgProducts.min = Math.min(bounds.avgProducts.min, item.avgProducts);
      bounds.avgProducts.max = Math.max(bounds.avgProducts.max, item.avgProducts);
    });

    return bounds;
  }, [avgSalesByDayData]);

  const getHeatMapStyle = (value: number, colName: keyof NonNullable<typeof avgSalesByDayBounds>) => {
    if (!avgSalesByDayBounds) return {};
    const { min, max } = avgSalesByDayBounds[colName];
    if (max === min) return {
      padding: '4px 12px',
      borderRadius: '9999px',
      display: 'inline-block'
    };

    // Calculate percentage and apply a power function to bias more towards green
    // Using 0.7 power makes higher values "greener" faster
    const percentage = (value - min) / (max - min);
    const biasedPercentage = Math.pow(percentage, 0.7);

    // Hue: 0 (red) to 140 (greenish-blue, biased to stay green longer)
    const hue = Math.min(125, biasedPercentage * 160);

    return {
      backgroundColor: `hsla(${hue}, 85%, 45%, 0.18)`,
      color: `hsl(${hue}, 90%, 20%)`,
      fontWeight: '800',
      padding: '4px 12px',
      borderRadius: '9999px',
      display: 'inline-block',
      minWidth: '80px',
      boxShadow: `0 1px 2px hsla(${hue}, 80%, 20%, 0.1)`
    };
  };

  // Apply search filter to dailySalesData
  const searchedData = useMemo(() => {
    let result = dailySalesData;

    // Apply main search query from filters
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((item: any) => {
        const invoiceDateStr = item.invoiceDate ? formatDate(item.invoiceDate).toLowerCase() : '';
        if (invoiceDateStr.includes(query)) return true;
        if (item.invoiceNumber.toLowerCase().includes(query)) return true;
        if (item.customerName.toLowerCase().includes(query)) return true;
        if (item.amount.toString().includes(query)) return true;
        if (item.qty.toString().includes(query)) return true;
        if (item.productsCount.toString().includes(query)) return true;
        if (item.avgCost.toString().includes(query)) return true;
        if (item.avgPrice.toString().includes(query)) return true;
        return false;
      });
    }

    // Apply table quick search
    if (tableSearchQuery.trim()) {
      const query = tableSearchQuery.toLowerCase().trim();
      result = result.filter((item: any) => {
        const invoiceDateStr = item.invoiceDate ? formatDate(item.invoiceDate).toLowerCase() : '';
        if (invoiceDateStr.includes(query)) return true;
        if (item.invoiceNumber.toLowerCase().includes(query)) return true;
        if (item.customerName.toLowerCase().includes(query)) return true;
        if (item.amount.toString().includes(query)) return true;
        if (item.qty.toString().includes(query)) return true;
        if (item.productsCount.toString().includes(query)) return true;
        if (item.avgCost.toString().includes(query)) return true;
        if (item.avgPrice.toString().includes(query)) return true;
        return false;
      });
    }

    return result;
  }, [dailySalesData, searchQuery, tableSearchQuery]);

  // Reset to page 1 when filters change or sub-tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tableSearchQuery, activeSubTab]);

  // Calculate pagination
  const totalPages = Math.ceil(searchedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = searchedData.slice(startIndex, endIndex);


  // Export to Excel - All Invoices
  const exportAllInvoicesToExcel = () => {
    const worksheetData = dailySalesData.map((item: any) => ({
      'Invoice Date': formatDate(item.invoiceDate),
      'Invoice Number': item.invoiceNumber,
      'Customer Name': item.customerName,
      'Amount': item.amount,
      'Quantity': item.qty,
      'Products Count': item.productsCount,
      'Avg Cost': item.avgCost,
      'Avg Price': item.avgPrice
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Invoices');
    XLSX.writeFile(workbook, 'All_Invoices.xlsx');
  };

  // Export to Excel - Sales BY Day
  const exportSalesByDayToExcel = () => {
    const worksheetData = salesByDayData.map(item => ({
      'Date': item.date,
      'Amount': item.amount,
      'Quantity': item.qty,
      'Invoices Count': item.salInvoicesCount,
      'Customers Count': item.salCustomersCount,
      'Products Count': item.salProductsCount
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales BY Day');
    XLSX.writeFile(workbook, 'Sales_BY_Day.xlsx');
  };

  // Export to Excel - AVG Sales BY Day
  const exportAvgSalesByDayToExcel = () => {
    const worksheetData = avgSalesByDayData.map(item => ({
      'Month/Year': item.monthYear,
      'Avg Daily Amount': item.avgAmount,
      'Avg Daily Quantity': item.avgQty,
      'Avg Daily Invoices': item.avgInvoices,
      'Avg Daily Customers': item.avgCustomers,
      'Avg Daily Products': item.avgProducts
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'AVG Sales BY Day');
    XLSX.writeFile(workbook, 'AVG_Sales_BY_Day.xlsx');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading daily sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <h1 className="text-2xl font-medium text-slate-800">Sales Daily Sales</h1>

        {/* Centered Search Box */}
        <div className="flex-1 md:absolute md:left-1/2 md:-translate-x-1/2 w-full md:max-w-md group z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-sm shadow-sm"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (activeSubTab === 'all-invoices') exportAllInvoicesToExcel();
              else if (activeSubTab === 'sales-by-day') exportSalesByDayToExcel();
              else exportAvgSalesByDayToExcel();
            }}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveSubTab('all-invoices')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${activeSubTab === 'all-invoices'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            All Invoices /LPO
          </button>
          <button
            onClick={() => setActiveSubTab('sales-by-day')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${activeSubTab === 'sales-by-day'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Sales BY Day
          </button>
          <button
            onClick={() => setActiveSubTab('avg-sales-by-day')}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${activeSubTab === 'avg-sales-by-day'
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            AVG Sales BY Day
          </button>
        </div>
      </div>


      {/* Statistics Cards - Distributed Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Net Sales Card */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl px-5 py-3 shadow-lg text-white flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-green-100 text-xs uppercase font-bold tracking-wider">Net Sales</span>
            <span className="text-3xl font-black tracking-tight leading-none my-0.5">
              {allInvoicesStats.netSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-green-50 opacity-90 font-medium">AED (Sales - Returns)</span>
          </div>
        </div>

        {/* Sales Invoices Count Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl px-5 py-3 shadow-lg text-white flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-blue-100 text-xs uppercase font-bold tracking-wider">Sales Invoices</span>
            <span className="text-3xl font-black tracking-tight leading-none my-0.5">
              {allInvoicesStats.salesCount.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-blue-50 opacity-90 font-medium">Count</span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <div className="text-right">
              <span className="block text-[10px] text-blue-100 opacity-80 uppercase font-bold">Total Val</span>
              <span className="block text-2xl font-bold leading-none">
                {allInvoicesStats.totalSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-blue-100 opacity-90">AED</span>
            </div>
          </div>
        </div>

        {/* Returns Invoices Count Card */}
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl px-5 py-3 shadow-lg text-white flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-red-100 text-xs uppercase font-bold tracking-wider">Return Invoices</span>
            <span className="text-3xl font-black tracking-tight leading-none my-0.5">
              {allInvoicesStats.returnsCount.toLocaleString('en-US')}
            </span>
            <span className="text-[10px] text-red-50 opacity-90 font-medium">Count</span>
          </div>
          <div className="flex flex-col items-end justify-center">
            <div className="text-right">
              <span className="block text-[10px] text-red-100 opacity-80 uppercase font-bold">Total Val</span>
              <span className="block text-2xl font-bold leading-none">
                {allInvoicesStats.totalReturns.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-red-100 opacity-90">AED</span>
            </div>
          </div>
        </div>
      </div>

      {/* All Invoices /LPO Tab */}
      {activeSubTab === 'all-invoices' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-gray-800">All Invoices /LPO</h2>
            </div>

          </div>

          {dailySalesData.length > 0 && (
            <div className="mb-4 flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Quick search in table (Invoice #, Customer, Amount, etc.)..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none focus:outline-none text-gray-700 placeholder-gray-400"
              />
              {tableSearchQuery && (
                <button
                  onClick={() => setTableSearchQuery('')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {searchedData.length === 0 ? (
            <div className="py-12">
              <NoData />
            </div>
          ) : (
            <>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/50">
                    <tr className="border-b border-gray-100">
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Invoice Date</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Invoice Number</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Customer Name</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Amount</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Quantity</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Products Count</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Avg Cost</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item: any, index: number) => (
                      <tr key={`${item.invoiceNumber}-${startIndex + index}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/10'}`}>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {formatDate(item.invoiceDate) || '-'}
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">{item.invoiceNumber}</td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">{item.customerName || '-'}</td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.productsCount}
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.avgCost % 1 === 0
                            ? item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            : item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          }
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.avgPrice % 1 === 0
                            ? item.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                            : item.avgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-sm text-gray-500 font-medium">
                    Showing {startIndex + 1} to {Math.min(endIndex, searchedData.length)} of {searchedData.length} invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm">Page {currentPage} of {totalPages}</div>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Sales BY Day Tab */}
      {activeSubTab === 'sales-by-day' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-6">
            <h2 className="text-xl font-bold text-gray-800">Sales BY Day</h2>
          </div>
          {salesByDayData.length === 0 ? (
            <div className="py-12">
              <NoData />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/50">
                  <tr className="border-b border-gray-100">
                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Date</th>
                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Amount</th>
                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Quantity</th>
                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Invoices</th>
                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Customers</th>
                    <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Products</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {salesByDayData.map((item, index) => (
                    <tr key={`${item.date}-${index}`} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/10'}`}>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">{item.date}</td>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                        {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">{item.salInvoicesCount}</td>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">{item.salCustomersCount}</td>
                      <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">{item.salProductsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* AVG Sales BY Day Tab */}
      {activeSubTab === 'avg-sales-by-day' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-6">
            <h2 className="text-xl font-bold text-gray-800">AVG Sales BY Day</h2>
          </div>
          {avgSalesByDayData.length === 0 ? (
            <div className="py-12">
              <NoData />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Month/Year</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Avg Daily Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Avg Daily Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Avg Daily Invoices</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Avg Daily Customers</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Avg Daily Products</th>
                  </tr>
                </thead>
                <tbody>
                  {avgSalesByDayData.map((item, index) => (
                    <tr key={`${item.monthKey}-${index}`} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                      <td className="text-center py-3 px-4 text-base font-semibold text-gray-800">
                        {item.monthYear}
                      </td>
                      <td className="text-center py-3 px-4">
                        <span style={getHeatMapStyle(item.avgAmount, 'avgAmount')}>
                          {item.avgAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span style={getHeatMapStyle(item.avgQty, 'avgQty')}>
                          {item.avgQty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span style={getHeatMapStyle(item.avgInvoices, 'avgInvoices')}>
                          {item.avgInvoices.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span style={getHeatMapStyle(item.avgCustomers, 'avgCustomers')}>
                          {item.avgCustomers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span style={getHeatMapStyle(item.avgProducts, 'avgProducts')}>
                          {item.avgProducts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

