'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import NoData from './01-Unified/NoDataTab';
import SalesProductDetails from './SalesProductDetails';

interface SalesProductsTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const ProductRow = memo(({ item, rowNumber, onBarcodeClick }: { item: { barcode: string; product: string; amount: number; qty: number; transactions: number }; rowNumber: number; onBarcodeClick: (barcode: string) => void }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 text-center">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{rowNumber}</td>
      <td
        className="py-3 px-4 text-sm text-gray-800 font-medium cursor-pointer hover:text-green-600 hover:underline"
        onClick={() => item.barcode && onBarcodeClick(item.barcode)}
      >
        {item.barcode || '-'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-medium">{item.product}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">{item.transactions}</td>
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

  // Aggregate products data from transactions
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

      // Add invoice number for transaction count (only invoices starting with "SAL")
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }
    }

    const result = Array.from(productMap.values()).map(item => ({
      barcode: item.barcode,
      product: item.product,
      amount: item.totalAmount,
      qty: item.totalQty,
      transactions: item.invoiceNumbers.size
    }));

    return result;
  }, [data]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...productsData];

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product.toLowerCase().includes(query) ||
        item.barcode.toLowerCase().includes(query)
      );
    }

    // Sort by amount descending
    filtered.sort((a, b) => b.amount - a.amount);

    return filtered;
  }, [productsData, debouncedSearchQuery]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredProducts.reduce((acc, item) => {
      acc.totalAmount += item.amount;
      acc.totalQty += item.qty;
      acc.totalTransactions += item.transactions;
      return acc;
    }, {
      totalAmount: 0,
      totalQty: 0,
      totalTransactions: 0
    });
  }, [filteredProducts]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const headers = ['#', 'Barcode', 'Product Name', 'Amount', 'Qty', 'Transactions'];

    const rows = filteredProducts.map((item, index) => [
      index + 1,
      item.barcode || '-',
      item.product,
      item.amount.toFixed(2),
      item.qty.toFixed(0),
      item.transactions,
    ]);

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
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading products data...</p>
        </div>
      </div>
    );
  }

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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-medium text-slate-800">Sales Products</h1>

        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search products by name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-medium text-gray-700"
            />
          </div>

          <button
            onClick={exportToExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-center">
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Barcode</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product Name</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedProducts.map((item, index) => (
                <ProductRow
                  key={`${item.barcode}-${item.product}`}
                  item={item}
                  rowNumber={startIndex + index + 1}
                  onBarcodeClick={setSelectedBarcode}
                />
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12">
                    <NoData />
                  </td>
                </tr>
              )}
            </tbody>
            {filteredProducts.length > 0 && (
              <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                <tr className="text-center">
                  <td className="py-4 px-4 text-sm text-gray-800" colSpan={3}>Grand Total</td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalTransactions.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredProducts.length > ITEMS_PER_PAGE && (
          <div className="px-6 py-4 bg-gray-50/30 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500 font-medium">
              Showing <span className="text-gray-900">{startIndex + 1}</span> to <span className="text-gray-900">{Math.min(endIndex, filteredProducts.length)}</span> of <span className="text-gray-900">{filteredProducts.length}</span> products
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="hidden sm:flex items-center gap-1.5">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[40px] h-10 px-3 rounded-lg text-sm font-bold transition-all ${currentPage === pageNum
                        ? 'bg-green-600 text-white shadow-md shadow-green-100'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-green-500 hover:text-green-600'
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
                className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
