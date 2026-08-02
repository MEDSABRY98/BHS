'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Box,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Search,
  X,
} from 'lucide-react';
import type { ProductBalanceRow } from '../Service/inventory_types';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';

interface Props {
  categoryName: string;
  products: ProductBalanceRow[];
  onBack: () => void;
}

export default function InventoryCategoryBalanceDetailsTab({
  categoryName,
  products,
  onBack,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const categoryProducts = useMemo(() => {
    return products
      .filter((item) => (item.category || 'Uncategorized') === categoryName)
      .sort((a, b) => a.productName.localeCompare(b.productName, undefined, { sensitivity: 'base' }));
  }, [products, categoryName]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return categoryProducts;
    const q = searchQuery.toLowerCase().trim();
    return categoryProducts.filter((item) => {
      return (
        item.productName.toLowerCase().includes(q) ||
        item.productId.toLowerCase().includes(q) ||
        item.barcode.toLowerCase().includes(q)
      );
    });
  }, [categoryProducts, searchQuery]);

  const totalEnding = useMemo(
    () => filteredProducts.reduce((sum, item) => sum + item.endingStock, 0),
    [filteredProducts],
  );

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const handleExportExcel = async () => {
    const headers = ['#', 'Barcode', 'Product Code', 'Product Name', 'Ending Balance'];
    const rows = filteredProducts.map((item, index) => [
      index + 1,
      item.barcode,
      item.productId,
      item.productName,
      item.endingStock,
    ]);

    const safeCategory = categoryName.replace(/[^\w\-]+/g, '_');
    await exportSalesExcelTable(
      headers,
      rows,
      `category_balance_${safeCategory}_${new Date().toISOString().split('T')[0]}.xlsx`,
      {
        sheetName: categoryName.slice(0, 31),
        numericColumns: ['Ending Balance'],
      },
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all shadow-xs flex items-center gap-2 text-xs font-bold"
              title="Back to Categories"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Box className="w-5 h-5 text-indigo-600" />
                {categoryName}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {categoryProducts.length.toLocaleString('en-US')} products
              </p>
            </div>
          </div>

          <button
            onClick={handleExportExcel}
            className="h-10 w-10 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-sm group shrink-0"
            title="Export to Excel"
          >
            <FileSpreadsheet className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>
        </div>

        <div className="relative flex items-center h-11 bg-slate-50/80 hover:bg-slate-100/60 focus-within:bg-white border border-slate-200/90 rounded-xl px-3.5 transition-all shadow-xs focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
          <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
          <input
            type="text"
            placeholder="Search barcode, code, or product name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-transparent text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Products</p>
          <p className="text-2xl font-black text-slate-800">{filteredProducts.length.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Category Ending Balance</p>
          <p className={`text-2xl font-black ${totalEnding < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
            {totalEnding.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {filteredProducts.length === 0 ? (
          <NoData />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse min-w-[680px] text-center">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                    <th className="py-3.5 px-2 w-[48px]">#</th>
                    <th className="py-3.5 px-3 w-[16%]">Barcode</th>
                    <th className="py-3.5 px-3 w-[14%]">Product Code</th>
                    <th className="py-3.5 px-3 w-[46%]">Product Name</th>
                    <th className="py-3.5 px-3 w-[18%] bg-indigo-50/50 text-indigo-900">Ending Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {paginatedProducts.map((item, index) => {
                    const globalIdx = (currentPage - 1) * itemsPerPage + index + 1;
                    return (
                      <tr key={item.productId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-2 text-slate-400 font-bold">{globalIdx}</td>
                        <td className="py-3.5 px-3 font-mono text-slate-600 text-[11px] truncate" title={item.barcode || '-'}>
                          {item.barcode || '-'}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-600 text-[11px] truncate" title={item.productId}>
                          {item.productId}
                        </td>
                        <td className="py-3.5 px-3 font-bold text-slate-800 truncate" title={item.productName}>
                          {item.productName}
                        </td>
                        <td className="py-3.5 px-3 font-black text-sm bg-indigo-50/30 text-indigo-900">
                          {item.endingStock.toLocaleString('en-US')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-black uppercase">
                    <td colSpan={4} className="py-3.5 px-3 text-right text-slate-500">Total</td>
                    <td className="py-3.5 px-3 text-sm bg-indigo-50/40 text-indigo-900">
                      {totalEnding.toLocaleString('en-US')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600">
                <div>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
