'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SalesInvoice } from '@/lib/Sheets/GoogleSheets';
import { Download, Calendar, MapPin, ShoppingBag, UserCircle, ChevronDown, ChevronLeft, ChevronRight, Search, X, Filter, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import NoData from '@/app/Components/NoDataTab';
import Loading from '@/app/Components/Loading';

interface SalesDailySalesTabProps {
  refreshTrigger?: number;
  filters: any;
  invoiceTypeFilter: string;
  userId: string;
  showCosts?: boolean;
}

export default function SalesDailySalesTab({ filters, invoiceTypeFilter, userId, showCosts = true, refreshTrigger }: SalesDailySalesTabProps) {
  const [loading, setLoading] = useState(true);
  const [dailySalesData, setDailySalesData] = useState<any[]>([]);
  const [salesByDayData, setSalesByDayData] = useState<any[]>([]);
  const [avgSalesByDayData, setAvgSalesByDayData] = useState<any[]>([]);

  const [searchQuery1, setSearchQuery1] = useState('');
  const [searchQuery2, setSearchQuery2] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSubTab, setActiveSubTab] = useState<'all-invoices' | 'sales-by-day' | 'avg-sales-by-day'>('all-invoices');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

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

  // Reset selected month when subtab changes
  useEffect(() => {
    setSelectedMonthKey(null);
  }, [activeSubTab]);

  // Group salesByDayData by Month & Year
  const groupedByMonth = useMemo(() => {
    const monthsMap = new Map<string, { monthKey: string; monthName: string; year: number; totalAmount: number; days: any[] }>();

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    salesByDayData.forEach(item => {
      if (!item.date) return;
      const [dayStr, monthStr, yearStr] = item.date.split('/');
      if (!dayStr || !monthStr || !yearStr) return;
      const monthIndex = parseInt(monthStr, 10) - 1;
      const year = parseInt(yearStr, 10);
      const monthKey = `${year}-${monthStr.padStart(2, '0')}`;
      const monthName = monthNames[monthIndex] || monthStr;

      const existing = monthsMap.get(monthKey) || {
        monthKey,
        monthName,
        year,
        totalAmount: 0,
        days: [] as any[]
      };

      existing.totalAmount += item.amount;
      existing.days.push(item);
      monthsMap.set(monthKey, existing);
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [salesByDayData]);

  // Max day amount for heatmap calibration in selected month
  const maxDayAmount = useMemo(() => {
    if (!selectedMonthKey) return 0;
    const monthData = groupedByMonth.find(m => m.monthKey === selectedMonthKey);
    if (!monthData) return 0;
    const amounts = monthData.days.map(d => Math.abs(d.amount));
    return amounts.length > 0 ? Math.max(...amounts) : 0;
  }, [selectedMonthKey, groupedByMonth]);

  // Calculate calendar days grid for selected month
  const calendarGridDays = useMemo(() => {
    if (!selectedMonthKey) return [];
    const [yearStr, monthStr] = selectedMonthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    const firstDay = new Date(year, month - 1, 1);
    const startOffset = firstDay.getDay(); // 0: Sun, 1: Mon, etc.

    const lastDay = new Date(year, month, 0);
    const totalDays = lastDay.getDate();

    const days = [];

    // Empty offset slots
    for (let i = 0; i < startOffset; i++) {
      days.push({ type: 'empty', dayNum: null, dateStr: '' });
    }

    // Actual calendar days
    for (let d = 1; d <= totalDays; d++) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(month).padStart(2, '0');
      const dateStr = `${dStr}/${mStr}/${year}`;
      
      const dayData = salesByDayData.find(item => item.date === dateStr);
      days.push({
        type: 'day',
        dayNum: d,
        dateStr,
        dayData
      });
    }

    return days;
  }, [selectedMonthKey, salesByDayData]);

  const itemsPerPage = 50;

  // Fetch data
  useEffect(() => {
    const fetchDailySales = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/DailySales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, invoiceTypeFilter, userId })
        });
        if (!response.ok) throw new Error('Failed to fetch daily sales data');
        const result = await response.json();
        setDailySalesData(result.dailySalesData || []);
        setSalesByDayData(result.salesByDayData || []);
        setAvgSalesByDayData(result.avgSalesByDayData || []);
      } catch (err) {
        console.error('Error fetching Daily Sales Data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDailySales();
  }, [filters, invoiceTypeFilter, userId, refreshTrigger]);

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

    // Apply first search query
    if (searchQuery1.trim()) {
      const query = searchQuery1.toLowerCase().trim();
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
        if (item.searchTerms && item.searchTerms.some((term: string) => term.includes(query))) return true;
        return false;
      });
    }

    // Apply second search query
    if (searchQuery2.trim()) {
      const query = searchQuery2.toLowerCase().trim();
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
        if (item.searchTerms && item.searchTerms.some((term: string) => term.includes(query))) return true;
        return false;
      });
    }

    return result;
  }, [dailySalesData, searchQuery1, searchQuery2]);

  // Reset to page 1 when filters change or sub-tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery1, searchQuery2, activeSubTab]);

  // Calculate pagination
  const totalPages = Math.ceil(searchedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = searchedData.slice(startIndex, endIndex);


  // Export to Excel - All Invoices
  const exportAllInvoicesToExcel = () => {
    const worksheetData = dailySalesData.map((item: any) => {
      const row: any = {
        'Invoice Date': formatDate(item.invoiceDate),
        'Invoice Number': item.invoiceNumber,
        'Customer Name': item.customerName,
        'Amount': item.amount,
        'Quantity': item.qty,
        'Products Count': item.productsCount,
      };
      if (showCosts) {
        row['Avg Cost'] = item.avgCost;
      }
      row['Avg Price'] = item.avgPrice;
      return row;
    });

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

  // Export Single Invoice to Excel
  const exportSingleInvoiceToExcel = (invoice: any) => {
    const header = [
      ['Customer Name:', invoice.customerName],
      ['Invoice Number:', invoice.invoiceNumber],
      ['Date:', formatDate(invoice.invoiceDate)],
      [],
      showCosts
        ? ['Barcode', 'Product', 'Quantity', 'Cost', 'Price', 'Total']
        : ['Barcode', 'Product', 'Quantity', 'Price', 'Total']
    ];

    const rows = invoice.items.map((item: SalesInvoice) => {
      const row = [
        item.barcode || '-',
        item.product || '-',
        item.qty || 0,
      ];
      if (showCosts) {
        row.push(item.productCost || 0);
      }
      row.push(
        item.productPrice || 0,
        item.amount || 0
      );
      return row;
    });

    const footer = [
      [],
      [...Array(showCosts ? 4 : 3).fill(''), 'Total Amount:', invoice.amount]
    ];

    const worksheetData = [...header, ...rows, ...footer];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    // Sanitize sheet name: remove forbidden characters : \ / ? * [ ]
    const sheetName = String(invoice.invoiceNumber).replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `Invoice_${invoice.invoiceNumber}.xlsx`);
  };

  if (loading) {
    return <Loading fullScreen={false} />;
  }

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
        <h1 className="text-2xl font-medium text-slate-800">Sales Daily Sales</h1>

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
            All Invoices
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

      {/* All Invoices Tab */}
      {activeSubTab === 'all-invoices' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          </div>

          {dailySalesData.length > 0 && (
            <div className="mb-6 flex flex-col md:flex-row items-center gap-4 max-w-3xl mx-auto w-full">
              <div className="flex-1 w-full flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 group focus-within:border-green-500 transition-all">
                <Search className="w-5 h-5 text-gray-400 group-focus-within:text-green-600" />
                <input
                  type="text"
                  placeholder="Search by (Invoice #, Customer, etc.)..."
                  value={searchQuery1}
                  onChange={(e) => setSearchQuery1(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-gray-700 placeholder-gray-400 font-medium"
                />
                {searchQuery1 && (
                  <button onClick={() => setSearchQuery1('')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex-1 w-full flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 group focus-within:border-blue-500 transition-all">
                <Search className="w-5 h-5 text-gray-400 group-focus-within:text-blue-600" />
                <input
                  type="text"
                  placeholder="Refine search (Customer, Amount, Date, etc.)..."
                  value={searchQuery2}
                  onChange={(e) => setSearchQuery2(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:outline-none text-gray-700 placeholder-gray-400 font-medium"
                />
                {searchQuery2 && (
                  <button onClick={() => setSearchQuery2('')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {searchedData.length === 0 ? (
            <NoData />
          ) : (
            <>

              <div className="overflow-x-auto">
                <table className="w-full table-fixed">
                  <thead className="bg-gray-50/50">
                    <tr className="border-b border-gray-100">
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-32">Invoice Date</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-40">Invoice Number</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-56">Customer Name</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-32">Amount</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-28">Quantity</th>
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-32">Products Count</th>
                      {showCosts && <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-28">Avg Cost</th>}
                      <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-28">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((item: any, index: number) => (
                      <tr key={`${item.invoiceNumber}-${startIndex + index}`} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/10'}`}>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {formatDate(item.invoiceDate) || '-'}
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-green-600">
                          <button
                            onClick={() => setSelectedInvoice(item)}
                            className="hover:underline font-bold"
                          >
                            {item.invoiceNumber}
                          </button>
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800 w-56 truncate" title={item.customerName || '-'}>{item.customerName || '-'}</td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                          {item.productsCount}
                        </td>
                        {showCosts && (
                          <td className="text-center py-3 px-4 text-sm font-semibold text-gray-800">
                            {item.avgCost % 1 === 0
                              ? item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                              : item.avgCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            }
                          </td>
                        )}
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
        <div className="space-y-6">
          {selectedMonthKey ? (
            /* Month Calendar View */
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 animate-in fade-in duration-300">
              {/* Calendar Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setSelectedMonthKey(null);
                    }}
                    className="flex items-center justify-center p-2 rounded-xl bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all border border-slate-100 cursor-pointer"
                    title="Back to Month List"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {groupedByMonth.find(m => m.monthKey === selectedMonthKey)?.monthName} {groupedByMonth.find(m => m.monthKey === selectedMonthKey)?.year}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold tracking-wide uppercase">Daily Sales Calendar</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pl-4 pr-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-black uppercase tracking-wider">Total Month Sales:</span>
                  <span className="text-lg font-black leading-none">
                    {groupedByMonth.find(m => m.monthKey === selectedMonthKey)?.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] font-black">AED</span>
                </div>
              </div>

              {/* Calendar Grid Days Header */}
              <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-xs font-black text-slate-400 uppercase tracking-widest py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div className="grid grid-cols-7 gap-2">
                {calendarGridDays.map((cell, idx) => {
                  if (cell.type === 'empty') {
                    return <div key={`empty-${idx}`} className="bg-slate-50/20 border border-transparent rounded-2xl h-20 sm:h-24 opacity-40" />;
                  }

                  const hasSales = cell.dayData && cell.dayData.amount !== 0;
                  
                  let boxClass = "bg-white border border-slate-100";
                  let textColor = "text-slate-800";
                  
                  if (hasSales) {
                    const amt = cell.dayData.amount;
                    if (amt < 0) {
                      boxClass = "bg-red-50/50 border-red-100";
                      textColor = "text-red-600";
                    } else {
                      const ratio = maxDayAmount > 0 ? amt / maxDayAmount : 0;
                      if (ratio < 0.25) {
                        boxClass = "bg-emerald-50/20 border-emerald-50";
                      } else if (ratio < 0.5) {
                        boxClass = "bg-emerald-50/60 border-emerald-100";
                      } else if (ratio < 0.75) {
                        boxClass = "bg-emerald-100/50 border-emerald-200";
                      } else {
                        boxClass = "bg-emerald-500/10 border-emerald-300";
                      }
                      textColor = "text-emerald-700";
                    }
                  }

                  return (
                    <div
                      key={cell.dateStr}
                      className={`flex flex-col justify-between p-3 rounded-2xl h-24 sm:h-28 text-left transition-all duration-200 shadow-sm ${boxClass}`}
                    >
                      <span className="text-[11px] font-black text-slate-400">{cell.dayNum}</span>
                      {cell.dayData ? (
                        <div className="flex flex-col items-start w-full">
                          <span className={`text-[13px] sm:text-base font-black tracking-tight leading-none truncate w-full ${textColor}`}>
                            {cell.dayData.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-[8px] text-slate-400 mt-1 font-bold truncate leading-none">
                            {cell.dayData.salInvoicesCount} Invs | {cell.dayData.qty} Pcs
                          </span>
                        </div>
                      ) : (
                        <span className="text-[8px] text-slate-300 italic">No Sales</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Months Grid View */
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Sales BY Month</h2>
                  <p className="text-xs text-slate-400 font-medium">Select a month card to view daily sales in a calendar layout.</p>
                </div>
              </div>

              {groupedByMonth.length === 0 ? (
                <NoData />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6 pt-0">
                  {groupedByMonth.map((monthData) => (
                    <button
                      key={monthData.monthKey}
                      onClick={() => {
                        setSelectedMonthKey(monthData.monthKey);
                      }}
                      className="group bg-white border border-slate-100 hover:border-[#D4AF37] hover:shadow-md rounded-2xl p-5 text-left transition-all duration-300 cursor-pointer flex flex-col justify-between h-36"
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-[#D4AF37]/10 group-hover:text-[#D4AF37] flex items-center justify-center transition-all duration-300">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase">{monthData.monthKey}</span>
                      </div>
                      
                      <div className="mt-4">
                        <h3 className="text-base font-black text-slate-800 group-hover:text-[#D4AF37] transition-colors">
                          {monthData.monthName} {monthData.year}
                        </h3>
                        <p className="text-lg font-black text-emerald-600 mt-1 leading-none">
                          {monthData.totalAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          <span className="text-[10px] ml-1 text-slate-400 font-bold uppercase">AED</span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
            <NoData />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-40">Month/Year</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Amount</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Quantity</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Invoices</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Customers</th>
                    <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Products</th>
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
      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-green-600" />
                  Invoice Details: {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-sm text-gray-500 font-medium">
                  {selectedInvoice.customerName} | {formatDate(selectedInvoice.invoiceDate)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportSingleInvoiceToExcel(selectedInvoice)}
                  className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors flex items-center justify-center border border-emerald-100 shadow-sm group"
                  title="Export Invoice to Excel"
                >
                  <FileSpreadsheet className="w-5 h-5 transition-transform group-hover:scale-110" />
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body - Items Table */}
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Barcode</th>
                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Qty</th>
                    {showCosts && <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Cost</th>}
                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Price</th>
                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedInvoice.items.map((item: SalesInvoice, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-[11px] text-gray-500">{item.barcode || '-'}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="font-bold text-gray-800">{item.product}</div>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-gray-700">{item.qty}</td>
                      {showCosts && (
                        <td className="py-3 px-4 text-center font-semibold text-gray-700">
                          {item.productCost?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      <td className="py-3 px-4 text-center font-semibold text-gray-700">
                        {item.productPrice?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-gray-900">
                        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer - Totals Breakdown */}
            <div className="px-8 py-6 bg-gray-50 border-t border-gray-200">
              <div className="flex flex-col items-end gap-2">
                <div className="flex justify-between w-full max-w-[240px] text-green-700 mt-1">
                  <span className="text-lg font-black uppercase tracking-wider">Total Amount:</span>
                  <span className="text-2xl font-black">
                    {selectedInvoice.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    <span className="text-xs ml-1 font-bold">AED</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


