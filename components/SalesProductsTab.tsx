'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, Package, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import SalesProductDetails from './SalesProductDetails';

interface SalesProductsTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const ProductRow = memo(({ item, rowNumber, onBarcodeClick }: { item: { barcode: string; product: string; amount: number; qty: number; transactions: number }; rowNumber: number; onBarcodeClick: (barcode: string) => void }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium text-center">{rowNumber}</td>
      <td 
        className="py-3 px-4 text-sm text-gray-800 font-medium text-center cursor-pointer hover:text-green-600 hover:underline"
        onClick={() => item.barcode && onBarcodeClick(item.barcode)}
      >
        {item.barcode || '-'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-medium text-center">{item.product}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">
        {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold text-center">{item.transactions}</td>
    </tr>
  );
});

ProductRow.displayName = 'ProductRow';

export default function SalesProductsTab({ data, loading }: SalesProductsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Group data by product ID
  const productsData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const productMap = new Map<string, { 
      barcode: string; 
      product: string;
      totalAmount: number; 
      totalQty: number;
      invoiceNumbers: Set<string>;
    }>();
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const key = item.productId || item.barcode || item.product;
      let existing = productMap.get(key);
      
      if (!existing) {
        existing = { 
          barcode: item.barcode || '',
          product: item.product,
          totalAmount: 0, 
          totalQty: 0,
          invoiceNumbers: new Set<string>()
        };
        productMap.set(key, existing);
      }
      
      existing.totalAmount += item.amount;
      existing.totalQty += item.qty;
      
      // Add invoice number for transaction count
      if (item.invoiceNumber) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }
    }

    // Pre-calculate array length
    const result = new Array(productMap.size);
    let index = 0;
    
    productMap.forEach(item => {
      result[index++] = {
        barcode: item.barcode,
        product: item.product,
        amount: item.totalAmount,
        qty: item.totalQty,
        transactions: item.invoiceNumbers.size
      };
    });
    
    return result;
  }, [data]);

  // Filter and sort products - optimized
  const filteredProducts = useMemo(() => {
    if (productsData.length === 0) return [];
    
    let filtered: typeof productsData;
    
    // Apply search filter using debounced query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = productsData.filter(item => 
        item.product.toLowerCase().includes(query) ||
        item.barcode.toLowerCase().includes(query)
      );
    } else {
      filtered = productsData;
    }
    
    // Sort by amount descending (in-place for better performance)
    filtered.sort((a, b) => b.amount - a.amount);
    
    return filtered;
  }, [productsData, debouncedSearchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Calculate totals (for all filtered products, not just current page) - optimized single pass
  const totals = useMemo(() => {
    if (filteredProducts.length === 0) {
      return {
        totalAmount: 0,
        totalQty: 0,
        totalTransactions: 0
      };
    }

    // Single reduce pass instead of 3 separate reduces
    const result = filteredProducts.reduce((acc, item) => {
      acc.totalAmount += item.amount;
      acc.totalQty += item.qty;
      acc.totalTransactions += item.transactions;
      return acc;
    }, {
      totalAmount: 0,
      totalQty: 0,
      totalTransactions: 0
    });

    return result;
  }, [filteredProducts]);

  // Reset to first page when filtered products change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const headers = ['#', 'Barcode', 'Product Name', 'Amount', 'Qty', 'Transactions'];

    // Use all filtered products (not just current page), same columns as table
    const rows = filteredProducts.map((item, index) => [
      index + 1,
      item.barcode || '-',
      item.product,
      item.amount.toFixed(2),
      item.qty.toFixed(0),
      item.transactions,
    ]);

    // Totals row (same logic as table footer)
    if (filteredProducts.length > 0) {
      rows.push([
        '',
        '',
        'Total',
        totals.totalAmount.toFixed(2),
        totals.totalQty.toFixed(0),
        totals.totalTransactions,
      ]);
    }

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Products');

    const filename = `sales_products_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading products data...</p>
        </div>
      </div>
    );
  }

  // If a barcode is selected, show its details
  if (selectedBarcode) {
    return (
      <SalesProductDetails
        barcode={selectedBarcode}
        data={data}
        onBack={() => setSelectedBarcode(null)}
      />
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
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
              placeholder="Search by product name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border-2 border-gray-200 focus:border-green-500 focus:outline-none shadow-sm text-base"
            />
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">#</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Barcode</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Product Name</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Qty</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((item, index) => (
                  <ProductRow 
                    key={`${item.barcode}-${item.product}-${startIndex + index}`}
                    item={item}
                    rowNumber={startIndex + index + 1}
                    onBarcodeClick={setSelectedBarcode}
                  />
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      {searchQuery ? 'No products found matching your search' : 'No data available'}
                    </td>
                  </tr>
                )}
                {filteredProducts.length > 0 && (
                  <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold">
                    <td className="py-3 px-4 text-sm text-gray-800 text-center" colSpan={3}>Total</td>
                    <td className="py-3 px-4 text-sm text-gray-800 text-center">
                      {totals.totalAmount.toLocaleString('en-US', { 
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
                      {totals.totalTransactions}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredProducts.length > ITEMS_PER_PAGE && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length} products
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

