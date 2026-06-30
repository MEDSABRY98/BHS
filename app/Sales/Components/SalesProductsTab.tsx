'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Search, ChevronLeft, ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { exportSalesExcelTable } from '@/app/Sales/Export/SalesExcelExport';
import NoData from '@/app/Components/NoDataTab';
import SalesProductDetails from './SalesProductDetails';
import SalesTabLoader from './SalesTabLoader';

interface SalesProductsTabProps {
  refreshTrigger?: number;
  userId: string;
}

const ITEMS_PER_PAGE = 50;

// Memoized row component for better performance
const ProductRow = memo(({ item, rowNumber, onProductClick }: { item: { productId: string; barcode: string; product: string; amount: number; qty: number; transactions: number }; rowNumber: number; onProductClick: (id: string) => void }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 text-center">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{rowNumber}</td>
      <td
        className="py-3 px-4 text-sm text-gray-800 font-medium cursor-pointer hover:text-green-600 hover:underline"
        onClick={() => onProductClick(item.productId || item.barcode || item.product)}
      >
        {item.barcode || '-'}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-medium w-64 truncate" title={item.product}>{item.product}</td>
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

export default function SalesProductsTab({ userId, refreshTrigger }: SalesProductsTabProps) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const [loading, setLoading] = useState(true);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setCurrentPage(1); // Reset to first page when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch data
  useEffect(() => {
    const fetchProducts = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/Products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, userId })
        });
        if (!response.ok) throw new Error('Failed to fetch products data');
        const result = await response.json();
        setProductsData(result.productsData || []);
      } catch (err) {
        console.error('Error fetching Products Data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [filters, userId, refreshTrigger]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = [...productsData];

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.product.toLowerCase().includes(query) ||
        item.barcode.toLowerCase().includes(query) ||
        item.productId.toLowerCase().includes(query) ||
        Array.from(item.allNames as string[]).some(name => name.includes(query)) ||
        Array.from(item.allBarcodes as string[]).some(bc => bc.includes(query))
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

  const exportToExcel = async () => {
    const headers = ['#', 'Barcode', 'Product Name', 'Amount', 'Qty', 'Transactions'];

    const rows = filteredProducts.map((item, index) => [
      index + 1,
      item.barcode || '-',
      item.product,
      item.amount,
      item.qty,
      item.transactions,
    ]);

    if (filteredProducts.length > 0) {
      rows.push(['', '', 'Total', totals.totalAmount, totals.totalQty, totals.totalTransactions]);
    }

    const filename = `sales_products_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Products',
      numericColumns: ['Amount', 'Qty'],
    });
  };

  if (loading) {
    return <SalesTabLoader />;
  }

  if (selectedProductId) {
    return (
      <SalesProductDetails
        productId={selectedProductId}
        userId={userId}
        onBack={() => setSelectedProductId(null)}
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
      {filteredProducts.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-center">
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">#</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Barcode</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-64">Product Name</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Amount</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Qty</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Transactions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedProducts.map((item, index) => (
                  <ProductRow
                    key={`${item.productId}-${item.product}`}
                    item={item}
                    rowNumber={startIndex + index + 1}
                    onProductClick={setSelectedProductId}
                  />
                ))}
              </tbody>
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
      )}
    </div>
  );
}

