'use client';

import { useState, useMemo, useEffect, memo } from 'react';
import { SalesInvoice } from '@/lib/Sheets/GoogleSheets';
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import NoData from '@/app/Components/NoDataTab';
import Loading from '@/app/Components/Loading';

interface SalesCategoriesTabProps {
  refreshTrigger?: number;
  filters: any;
  userId: string;
}

const CategoryRow = memo(({ item, rowNumber }: { item: { category: string; amount: number; qty: number; customers: number }; rowNumber: number }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 text-center">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{rowNumber}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-medium">{item.category}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">{item.customers}</td>
    </tr>
  );
});

CategoryRow.displayName = 'CategoryRow';

export default function SalesCategoriesTab({ filters, userId, refreshTrigger }: SalesCategoriesTabProps) {
  const [loading, setLoading] = useState(true);
  const [categoriesData, setCategoriesData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/Sales/Categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters, userId })
        });
        if (!response.ok) throw new Error('Failed to fetch categories data');
        const result = await response.json();
        setCategoriesData(result.categoriesData || []);
      } catch (err) {
        console.error('Error fetching Categories Data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [filters, userId, refreshTrigger]);

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    let filtered = [...categoriesData];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.category.toLowerCase().includes(query)
      );
    }

    // Sort by amount descending
    filtered.sort((a, b) => b.amount - a.amount);

    return filtered;
  }, [categoriesData, searchQuery]);

  // Calculate totals
  const totals = useMemo(() => {
    const allUniqueCustomers = new Set<string>();

    const totalsData = filteredCategories.reduce((acc, item) => {
      acc.totalAmount += item.amount;
      acc.totalQty += item.qty;
      if (item.customerIds) {
        item.customerIds.forEach((id: string) => allUniqueCustomers.add(id));
      }
      return acc;
    }, {
      totalAmount: 0,
      totalQty: 0
    });

    return {
      ...totalsData,
      totalCustomers: allUniqueCustomers.size
    };
  }, [filteredCategories]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const headers = ['#', 'Category', 'Amount', 'Qty', 'Customers'];

    const rows = filteredCategories.map((item, index) => [
      index + 1,
      item.category,
      item.amount.toFixed(2),
      item.qty.toFixed(0),
      item.customers,
    ]);

    if (filteredCategories.length > 0) {
      rows.push([
        '',
        'Total',
        totals.totalAmount.toFixed(2),
        totals.totalQty.toFixed(0),
        totals.totalCustomers,
      ]);
    }

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Categories');

    const filename = `sales_categories_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  if (loading) {
    return <Loading fullScreen={false} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-medium text-slate-800">Sales Product Category</h1>

        <div className="flex items-center gap-3 flex-1 max-w-2xl">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-gray-400 group-focus-within:text-green-600 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search by category name..."
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

      {/* Categories Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100 text-center">
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[5%]">#</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[35%]">Category</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[20%]">Amount</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[15%]">Qty</th>
                <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[25%]">Customers Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCategories.map((item, index) => (
                <CategoryRow
                  key={item.category}
                  item={item}
                  rowNumber={index + 1}
                />
              ))}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12">
                    <NoData />
                  </td>
                </tr>
              )}
            </tbody>
            {filteredCategories.length > 0 && (
              <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                <tr className="text-center">
                  <td className="py-4 px-4 text-sm text-gray-800" colSpan={2}>Grand Total</td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalCustomers.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

