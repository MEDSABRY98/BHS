'use client';

import { useState, useMemo, useEffect, memo, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, ChevronLeft, ChevronRight, Download, X, FileSpreadsheet, Layers, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesCustomerDetails from './SalesCustomerDetails';
import NoData from './Unified/NoData';

interface SalesCustomersTabProps {
  data: SalesInvoice[];
  loading: boolean;
  onUploadMapping?: (mapping: Record<string, any>) => void;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const CustomerRow = memo(({ item, rowNumber, onCustomerClick }: { item: { customer: string; totalAmount: number; totalQty: number; averageAmount: number; averageQty: number; productsCount: number; transactions: number }; rowNumber: number; onCustomerClick: (customer: string) => void }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 group text-center">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{rowNumber}</td>
      <td
        className="py-3 px-4 text-sm text-gray-800 font-medium cursor-pointer hover:text-green-600 hover:underline min-w-[200px]"
        onClick={() => onCustomerClick(item.customer)}
      >
        {item.customer}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-bold">
        {item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.averageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">{item.productsCount}</td>
    </tr>
  );
});

CustomerRow.displayName = 'CustomerRow';

export default function SalesCustomersTab({ data, loading, onUploadMapping }: SalesCustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'main' | 'sub'>('main');
  const [sortField, setSortField] = useState<'customer' | 'totalAmount' | 'averageAmount' | 'totalQty' | 'productsCount'>('totalAmount');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Group data by customer - already using filtered data from props
  const customersData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const customerMap = new Map<string, {
      customerId: string;
      customer: string;
      totalAmount: number;
      totalQty: number;
      barcodes: Set<string>;
      months: Set<string>;
      invoiceNumbers: Set<string>;
    }>();

    for (let i = 0; i < data.length; i++) {
      const item = data[i];

      let key: string;
      let displayName: string;

      if (activeTab === 'main') {
        key = item.customerMainName || item.customerName || 'Unknown';
        displayName = item.customerMainName || item.customerName || 'Unknown';
      } else {
        key = item.customerId || item.customerName;
        displayName = item.customerName;
      }

      let existing = customerMap.get(key);

      if (!existing) {
        existing = {
          customerId: key,
          customer: displayName,
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

      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);
        const productKey = item.productId || item.barcode || item.product;
        existing.barcodes.add(productKey);
      }

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

    const result = new Array(customerMap.size);
    let index = 0;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    customerMap.forEach(item => {
      let totalMonths = 1;
      if (item.months.size > 0) {
        const sortedMonths = Array.from(item.months).sort();
        const firstMonthKey = sortedMonths[0];
        const [firstYear, firstMonth] = firstMonthKey.split('-').map(Number);
        const firstDate = new Date(firstYear, firstMonth - 1, 1);
        const lastDate = new Date(currentYear, currentMonth, 1);
        const yearsDiff = lastDate.getFullYear() - firstDate.getFullYear();
        const monthsDiff = lastDate.getMonth() - firstDate.getMonth();
        totalMonths = (yearsDiff * 12) + monthsDiff + 1;
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
  }, [data, activeTab]);

  const filteredCustomers = useMemo(() => {
    if (customersData.length === 0) return [];
    let filtered = [...customersData];

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => item.customer.toLowerCase().includes(query));
    }

    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [customersData, debouncedSearchQuery, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
  };

  const getSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 inline ml-1 opacity-20" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1 text-green-600" /> : <ArrowDown className="w-4 h-4 inline ml-1 text-green-600" />;
  };

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const totals = useMemo(() => {
    if (filteredCustomers.length === 0) return { totalAmount: 0, totalAverageAmount: 0, totalQty: 0, totalAverageQty: 0, totalProductsCount: 0, totalTransactions: 0 };
    return filteredCustomers.reduce((acc, item) => {
      acc.totalAmount += item.totalAmount;
      acc.totalAverageAmount += item.averageAmount;
      acc.totalQty += item.totalQty;
      acc.totalAverageQty += item.averageQty;
      acc.totalProductsCount += item.productsCount;
      acc.totalTransactions += item.transactions;
      return acc;
    }, { totalAmount: 0, totalAverageAmount: 0, totalQty: 0, totalAverageQty: 0, totalProductsCount: 0, totalTransactions: 0 });
  }, [filteredCustomers]);

  const exportToExcel = (mode: 'standard' | 'months') => {
    if (mode === 'months') {
      const customerMonthMap = new Map<string, Map<string, { amount: number; qty: number }>>();
      const customerInfoMap = new Map<string, { name: string, area: string, market: string }>();
      const allMonths = new Set<string>();

      data.forEach(item => {
        if (!item.invoiceDate) return;
        const date = new Date(item.invoiceDate);
        if (isNaN(date.getTime())) return;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        allMonths.add(monthKey);

        const customerId = activeTab === 'main' ? (item.customerMainName || item.customerName) : (item.customerId || item.customerName);
        if (!customerMonthMap.has(customerId)) {
          customerMonthMap.set(customerId, new Map());
          customerInfoMap.set(customerId, { name: activeTab === 'main' ? (item.customerMainName || item.customerName) : item.customerName, area: item.area || '', market: item.market || '' });
        }

        const cm = customerMonthMap.get(customerId)!;
        const mData = cm.get(monthKey) || { amount: 0, qty: 0 };
        mData.amount += item.amount;
        mData.qty += item.qty;
        cm.set(monthKey, mData);
      });

      const sortedMonths = Array.from(allMonths).sort();
      const workbook = XLSX.utils.book_new();

      const amountRows = Array.from(customerMonthMap.entries()).map(([cid, months]) => {
        const info = customerInfoMap.get(cid)!;
        const row: any[] = [info.name, info.area, info.market];
        let total = 0;
        sortedMonths.forEach(m => {
          const val = months.get(m)?.amount || 0;
          row.push(val.toFixed(2));
          total += val;
        });
        row.push(total.toFixed(2));
        return row;
      }).sort((a, b) => a[0].localeCompare(b[0]));

      const amountSheet = XLSX.utils.aoa_to_sheet([['Customer', 'Area', 'Market', ...sortedMonths.map(m => new Date(m).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })), 'Total'], ...amountRows]);
      XLSX.utils.book_append_sheet(workbook, amountSheet, 'Revenue Distribution');
      XLSX.writeFile(workbook, `customer_revenue_distribution_${new Date().toISOString().split('T')[0]}.xlsx`);
    } else {
      const headers = ['#', 'Customer Name', 'Amount', 'Amount Average', 'QTY', 'SKUs'];
      const rows = filteredCustomers.map((item, i) => [
        i + 1, item.customer, item.totalAmount.toFixed(2), item.averageAmount.toFixed(2),
        item.totalQty.toFixed(0), item.productsCount
      ]);
      rows.push(['', 'TOTALS', totals.totalAmount.toFixed(2), totals.totalAverageAmount.toFixed(2), totals.totalQty.toFixed(0), totals.totalProductsCount]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Customers Analysis');
      XLSX.writeFile(wb, `customers_analysis_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
    setShowExportModal(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium tracking-wide">Analyzing customer data...</p>
      </div>
    </div>
  );

  if (selectedCustomer) return (
    <SalesCustomerDetails customerName={selectedCustomer} customerType={activeTab} data={data} onBack={() => setSelectedCustomer(null)} />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium text-slate-800">Sales Customers</h1>
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-sm transition-all overflow-hidden">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'main' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="flex items-center gap-1.5">
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Main Customers</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sub')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'sub' ? 'bg-white text-green-700 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Sub Customers</span>
              </div>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'main' ? 'Main Customers' : 'Sub Customers'}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:border-green-500 outline-none transition-all shadow-sm text-sm font-medium"
            />
          </div>
          <button
            onClick={() => setShowExportModal(true)}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center w-12">#</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600" onClick={() => handleSort('customer')}>
                  Customer {getSortIcon('customer')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600" onClick={() => handleSort('totalAmount')}>
                  Amount {getSortIcon('totalAmount')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600" onClick={() => handleSort('averageAmount')}>
                  Amount Average {getSortIcon('averageAmount')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600" onClick={() => handleSort('totalQty')}>
                  QTY {getSortIcon('totalQty')}
                </th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center cursor-pointer hover:text-green-600" onClick={() => handleSort('productsCount')}>
                  SKUs {getSortIcon('productsCount')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedCustomers.map((item, idx) => (
                <CustomerRow key={item.customer} item={item} rowNumber={startIndex + idx + 1} onCustomerClick={setSelectedCustomer} />
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td className="py-12" colSpan={6}>
                    <NoData />
                  </td>
                </tr>
              )}
            </tbody>
            {filteredCustomers.length > 0 && (
              <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                <tr className="text-center">
                  <td colSpan={2} className="py-4 px-4 text-xs text-gray-500 uppercase tracking-widest">Totals</td>
                  <td className="py-4 px-4 text-sm text-gray-800">{totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-4 px-4 text-sm text-gray-800">{totals.totalAverageAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td className="py-4 px-4 text-sm text-gray-800">{totals.totalQty.toLocaleString()}</td>
                  <td className="py-4 px-4 text-sm text-gray-800">{totals.totalProductsCount.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination UI */}
        {filteredCustomers.length > ITEMS_PER_PAGE && (
          <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500 font-medium">Found {filteredCustomers.length} results</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"><ChevronLeft className="w-5 h-5" /></button>
              <div className="px-4 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm">Page {currentPage} / {totalPages}</div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-all"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Export Selection Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
          <div className="relative bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileSpreadsheet className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Export Report</h3>
            <p className="text-gray-500 text-center text-sm mb-8">Select the format you want to export the data in.</p>

            <div className="space-y-3">
              <button
                onClick={() => exportToExcel('standard')}
                className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 active:scale-95"
              >
                Snapshot Analysis
              </button>
              <button
                onClick={() => exportToExcel('months')}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 active:scale-95"
              >
                Monthly Distribution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
