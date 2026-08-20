import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, ShoppingBag, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { SalesInvoice } from '@/lib/supabase';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import NoData from '@/app/Components/DataState/NoDataTab';

interface AllInvoicesTabProps {
  dailySalesData: any[];
  showCosts: boolean;
  formatDate: (dateString: string) => string;
}

export default function AllInvoicesTab({ dailySalesData, showCosts, formatDate }: AllInvoicesTabProps) {
  const [searchQuery1, setSearchQuery1] = useState('');
  const [searchQuery2, setSearchQuery2] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  
  const itemsPerPage = 50;

  // Apply search filter
  const searchedData = useMemo(() => {
    let result = dailySalesData;

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
  }, [dailySalesData, searchQuery1, searchQuery2, formatDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery1, searchQuery2]);

  const totalPages = Math.ceil(searchedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = searchedData.slice(startIndex, endIndex);

  const exportSingleInvoiceToExcel = async (invoice: any) => {
    const headers = showCosts
      ? ['Barcode', 'Product', 'Quantity', 'Cost', 'Price', 'Total']
      : ['Barcode', 'Product', 'Quantity', 'Price', 'Total'];

    const rows = invoice.items.map((item: SalesInvoice) => {
      const row: unknown[] = [
        item.barcode || '-',
        item.product || '-',
        item.qty || 0,
      ];
      if (showCosts) {
        row.push(item.productCost || 0);
      }
      row.push(item.productPrice || 0, item.amount || 0);
      return row;
    });

    const sheetName = String(invoice.invoiceNumber).replace(/[:\\/?*[\]]/g, '_').slice(0, 31);
    const numericColumns = showCosts
      ? ['Quantity', 'Cost', 'Price', 'Total']
      : ['Quantity', 'Price', 'Total'];
    await exportSalesExcelTable(headers, rows, `Invoice_${invoice.invoiceNumber}.xlsx`, {
      sheetName,
      numericColumns,
    });
  };

  return (
    <>
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

      {selectedInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
    </>
  );
}
