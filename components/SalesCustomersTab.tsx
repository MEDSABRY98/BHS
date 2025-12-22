'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Users, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesCustomerDetails from './SalesCustomerDetails';

interface SalesCustomersTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const CustomerRow = memo(({ item, rowNumber, onCustomerClick }: { item: { customer: string; totalAmount: number; totalQty: number; averageAmount: number; averageQty: number; productsCount: number; transactions: number }; rowNumber: number; onCustomerClick: (customer: string) => void }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{rowNumber}</td>
      <td 
        className="py-3 px-4 text-sm text-gray-800 font-medium text-center cursor-pointer hover:text-green-600 hover:underline"
        onClick={() => onCustomerClick(item.customer)}
      >
        {item.customer}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.averageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.averageQty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.productsCount}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
    </tr>
  );
});

CustomerRow.displayName = 'CustomerRow';

export default function SalesCustomersTab({ data, loading }: SalesCustomersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Group data by customer - optimized
  const customersData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const customerMap = new Map<string, { 
      customer: string;
      merchandiser: string;
      salesRep: string;
      totalAmount: number; 
      totalQty: number;
      barcodes: Set<string>;
      months: Set<string>;
      invoiceNumbers: Set<string>;
    }>();
    
    // Pre-compile date parsing to avoid repeated try-catch
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const key = item.customerName;
      let existing = customerMap.get(key);
      
      if (!existing) {
        existing = { 
          customer: key,
          merchandiser: item.merchandiser || '',
          salesRep: item.salesRep || '',
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
      existing.barcodes.add(item.barcode);
      
      // Add invoice number for transaction count
      if (item.invoiceNumber) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }
      
      // Optimized date parsing
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

    // Pre-calculate array length
    const result = new Array(customerMap.size);
    let index = 0;
    
    customerMap.forEach(item => {
      const totalMonths = item.months.size || 1;
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
  }, [data]);

  // Filter and sort customers - optimized
  const filteredCustomers = useMemo(() => {
    if (customersData.length === 0) return [];
    
    let filtered: typeof customersData;
    
    // Apply search filter using debounced query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = customersData.filter(item => 
        item.customer.toLowerCase().includes(query)
      );
    } else {
      filtered = customersData;
    }
    
    // Sort by amount descending (in-place for better performance)
    filtered.sort((a, b) => b.totalAmount - a.totalAmount);
    
    return filtered;
  }, [customersData, debouncedSearchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Calculate totals (for all filtered customers, not just current page) - optimized single pass
  const totals = useMemo(() => {
    if (filteredCustomers.length === 0) {
      return {
        totalAmount: 0,
        totalAverageAmount: 0,
        totalQty: 0,
        totalAverageQty: 0,
        totalProductsCount: 0
      };
    }

    // Single reduce pass instead of 5 separate reduces
    const result = filteredCustomers.reduce((acc, item) => {
      acc.totalAmount += item.totalAmount;
      acc.totalAverageAmount += item.averageAmount;
      acc.totalQty += item.totalQty;
      acc.totalAverageQty += item.averageQty;
      acc.totalProductsCount += item.productsCount;
      return acc;
    }, {
      totalAmount: 0,
      totalAverageAmount: 0,
      totalQty: 0,
      totalAverageQty: 0,
      totalProductsCount: 0
    });

    return result;
  }, [filteredCustomers]);

  // Reset to first page when filtered customers change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = [
      '#',
      'Customer Name',
      'Amount',
      'Average Amount',
      'Qty',
      'Average Qty',
      'Products Count',
      'Transactions',
    ];

    const rows = filteredCustomers.map((item, index) => [
      index + 1,
      item.customer,
      item.totalAmount.toFixed(2),
      item.averageAmount.toFixed(2),
      item.totalQty.toFixed(0),
      item.averageQty.toFixed(2),
      item.productsCount,
      item.transactions,
    ]);

    // Totals row (same as table footer)
    if (filteredCustomers.length > 0) {
      rows.push([
        '',
        'Total',
        totals.totalAmount.toFixed(2),
        totals.totalAverageAmount.toFixed(2),
        totals.totalQty.toFixed(0),
        totals.totalAverageQty.toFixed(2),
        totals.totalProductsCount,
        totals.totalTransactions,
      ]);
    }

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Customers');

    const filename = `sales_customers_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customers data...</p>
        </div>
      </div>
    );
  }

  // If a customer is selected, show their details
  if (selectedCustomer) {
    return (
      <SalesCustomerDetails
        customerName={selectedCustomer}
        data={data}
        onBack={() => setSelectedCustomer(null)}
      />
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Customers</h1>
          <button
            onClick={exportToExcel}
            className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors"
            title="Export to Excel"
          >
            <Download className="w-5 h-5" />
          </button>
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
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Customer Name</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Average Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Average Qty</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Products Count</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCustomers.map((item, index) => (
                  <CustomerRow 
                    key={`${item.customer}-${startIndex + index}`}
                    item={item}
                    rowNumber={startIndex + index + 1}
                    onCustomerClick={setSelectedCustomer}
                  />
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      {searchQuery ? 'No customers found matching your search' : 'No data available'}
                    </td>
                  </tr>
                )}
                {filteredCustomers.length > 0 && (
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                    <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={2}>Total</td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalAmount.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalAverageAmount.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalQty.toLocaleString('en-US', { 
                        minimumFractionDigits: 0, 
                        maximumFractionDigits: 0 
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalAverageQty.toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalProductsCount}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">{totals.totalTransactions}</td>
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
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          currentPage === pageNum
                            ? 'bg-green-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

