'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { SalesInvoice } from '@/lib/googleSheets';
import { Search, FileDown, ChevronLeft, ChevronRight, Loader2, DollarSign, FileText, MoreVertical, ChevronDown } from 'lucide-react';
import { generateDownloadFormPDF } from '@/lib/PdfUtils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface SalesDownloadFormTabProps {
  data: SalesInvoice[];
  loading: boolean;
}

const ITEMS_PER_PAGE = 50;

// Helper to find the most frequent price
const calculateMode = (numbers: number[]): number => {
  if (!numbers || numbers.length === 0) return 0;
  const counts: Record<number, number> = {};
  let maxCount = 0;
  let mode = numbers[0];
  for (const n of numbers) {
    const val = parseFloat(n.toFixed(2)); // Normalize to 2 decimals
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount) {
      maxCount = counts[val];
      mode = val;
    }
  }
  return mode;
};

export default function SalesDownloadFormTab({ data, loading }: SalesDownloadFormTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });




  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get unique customers with their products and prices
  const customersData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const customerMap = new Map<string, Map<string, { barcode: string; product: string; prices: number[] }>>();

    data.forEach(item => {
      const custName = item.customerName || 'Unknown';
      if (!customerMap.has(custName)) {
        customerMap.set(custName, new Map());
      }

      const productsMap = customerMap.get(custName)!;
      const productKey = item.productId || item.barcode || item.product;

      // Extract price (Safe cast as generic since interface might vary)
      // Prioritize explicit price/unitPrice, else derived
      const itemAny = item as any;
      let price = itemAny.price || itemAny.unitPrice || 0;
      if (!price && itemAny.amount && itemAny.qty) {
        price = itemAny.amount / itemAny.qty;
      }

      const pNum = parseFloat(price);

      if (!productsMap.has(productKey)) {
        productsMap.set(productKey, {
          barcode: item.barcode || '-',
          product: item.product || '-',
          prices: []
        });
      }

      const prodEntry = productsMap.get(productKey)!;
      if (!isNaN(pNum) && pNum > 0) {
        prodEntry.prices.push(pNum);
      }
    });

    const result: Array<{ customer: string; products: Array<{ barcode: string; product: string; prices: number[] }> }> = [];

    customerMap.forEach((productsMap, customerName) => {
      const products = Array.from(productsMap.values());
      result.push({
        customer: customerName,
        products: products.sort((a, b) => a.product.localeCompare(b.product))
      });
    });

    return result.sort((a, b) => a.customer.localeCompare(b.customer));
  }, [data]);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return customersData;

    const query = debouncedSearchQuery.toLowerCase().trim();
    return customersData.filter(customer =>
      customer.customer.toLowerCase().includes(query)
    );
  }, [customersData, debouncedSearchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  const handleDownload = async (customerName: string, mode: 'order' | 'pricelist') => {
    const customer = customersData.find(c => c.customer === customerName);
    if (!customer) return;

    try {
      setIsGenerating(true);

      // Prepare data based on mode
      let productsToPrint = customer.products.map(p => ({
        barcode: p.barcode,
        product: p.product,
        price: mode === 'pricelist' ? calculateMode(p.prices) : undefined
      }));

      await generateDownloadFormPDF(customer.customer, productsToPrint, false, mode);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);

    }
  };

  const handleDownloadAllPDFs = async () => {
    if (filteredCustomers.length === 0) return;

    try {
      setIsGenerating(true);
      setGenerationProgress({ current: 0, total: filteredCustomers.length });

      const zip = new JSZip();

      for (let i = 0; i < filteredCustomers.length; i++) {
        const customer = filteredCustomers[i];
        setGenerationProgress({ current: i + 1, total: filteredCustomers.length });

        // Default to Order Form for ZIP
        const blob = await generateDownloadFormPDF(
          customer.customer,
          customer.products.map(p => ({ barcode: p.barcode, product: p.product })),
          true,
          'order'
        ) as Blob;

        const safeName = customer.customer.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
        zip.file(`${safeName}.pdf`, blob);

        // Small delay to keep UI responsive
        if (i % 5 === 0) await new Promise(resolve => setTimeout(resolve, 50));
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `Order_Forms_${new Date().toISOString().split('T')[0]}.zip`);

    } catch (error) {
      console.error('Error generating ZIP:', error);
      alert('Failed to generate ZIP. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress({ current: 0, total: 0 });
    }
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
    <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      <div className="w-full">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between bg-white rounded-xl shadow-lg p-6 border border-gray-200 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-md shrink-0">
              <FileDown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent whitespace-nowrap">
                Order Forms & Price Lists
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'} found
              </p>
            </div>
          </div>

          {/* Search Table Level */}
          <div className="relative max-w-md w-full flex-1 mx-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 border-2 border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-700 bg-gray-50/50 hover:bg-white transition-all shadow-sm"
            />
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={handleDownloadAllPDFs}
              disabled={isGenerating || filteredCustomers.length === 0}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-105 flex items-center gap-2 font-bold whitespace-nowrap"
              title="Download all filtered customers Order Forms as ZIP"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileDown className="w-5 h-5" />
              )}
              {isGenerating ? 'Generating ZIP...' : 'Download Order Forms (ZIP)'}
            </button>
            {isGenerating && generationProgress.total > 0 && (
              <p className="text-xs text-green-600 font-bold animate-pulse">
                Processing: {generationProgress.current} / {generationProgress.total}
              </p>
            )}
          </div>
        </div>

        {/* Customers List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="text-left py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider" style={{ width: '45%' }}>
                    Customer Name
                  </th>
                  <th className="text-center py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider" style={{ width: '15%' }}>
                    Products
                  </th>
                  <th className="text-center py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider" style={{ width: '20%' }}>
                    Order Form
                  </th>
                  <th className="text-center py-4 px-6 text-sm font-bold text-gray-700 uppercase tracking-wider" style={{ width: '20%' }}>
                    Price List
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-4 bg-gray-100 rounded-full">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium">
                          {debouncedSearchQuery ? 'No customers found' : 'No customers available'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((customer, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-green-50 hover:to-green-50/50 transition-colors duration-150 relative"
                    >
                      <td className="py-4 px-6 text-sm font-semibold text-gray-800 truncate" style={{ width: '45%' }}>
                        {customer.customer}
                      </td>
                      <td className="py-4 px-6 text-center" style={{ width: '15%' }}>
                        <span className="inline-flex items-center justify-center px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                          {customer.products.length}
                        </span>
                      </td>
                      {/* Order Form Button */}
                      <td className="py-4 px-6 text-center" style={{ width: '20%' }}>
                        <button
                          onClick={() => handleDownload(customer.customer, 'order')}
                          disabled={isGenerating}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-green-100 text-green-700 rounded-lg hover:bg-green-50 hover:border-green-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transform hover:scale-105 font-semibold text-xs uppercase tracking-wide"
                          title="Download Order Form"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Order Form</span>
                        </button>
                      </td>
                      {/* Price List Button */}
                      <td className="py-4 px-6 text-center" style={{ width: '20%' }}>
                        <button
                          onClick={() => handleDownload(customer.customer, 'pricelist')}
                          disabled={isGenerating}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-blue-100 text-blue-700 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transform hover:scale-105 font-semibold text-xs uppercase tracking-wide"
                          title="Download Price List"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Price List</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {filteredCustomers.length > ITEMS_PER_PAGE && (
          <div className="mt-6 bg-white rounded-xl shadow-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-gray-600 font-medium">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredCustomers.length)} of {filteredCustomers.length} customers
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-green-500 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
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
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${currentPage === pageNum
                          ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md'
                          : 'bg-white text-gray-700 hover:bg-green-50 hover:text-green-600 border-2 border-gray-200 hover:border-green-500'
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
                  className="px-4 py-2 bg-white border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-green-500 hover:text-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

