'use client';

import { useState, useMemo, memo } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';
import { getCategoriesData } from '@/app/Sales/Service/sales_products_service';
import { useSalesDataContext } from '@/app/Sales/Context/SalesDataContext';
import { useSalesTabFetch } from '@/app/Sales/Hooks/useSalesTabFetch';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';

interface SalesCategoriesTabProps {
  userId: string;
}

const CategoryRow = memo(({ item, rowNumber, salesShare }: { item: { category: string; amount: number; avgMonthly: number; qty: number; customers: number; mainCustomers: number; productsCount: number }; rowNumber: number; salesShare: number }) => {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 text-center">
      <td className="py-3 px-4 text-sm text-gray-600 font-medium">{rowNumber}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-medium">{item.category}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">{item.productsCount || 0}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">{item.mainCustomers || 0}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">{item.customers}</td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {(item.avgMonthly || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="py-3 px-4 text-sm text-indigo-600 font-bold">
        {salesShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
      </td>
      <td className="py-3 px-4 text-sm text-gray-800 font-semibold">
        {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </td>
    </tr>
  );
});

CategoryRow.displayName = 'CategoryRow';

export default function SalesCategoriesTab({ userId }: SalesCategoriesTabProps) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const { dataVersion } = useSalesDataContext();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: categoriesData, isInitialLoading, error, reload, loading } = useSalesTabFetch({
    tabKey: 'categories',
    userId,
    filters,
    dataVersion,
    fetcher: () => getCategoriesData(userId, filters),
    initialData: [] as any[],
  });

  const categoryRows = categoriesData ?? [];

  const filteredCategories = useMemo(() => {
    let filtered = [...categoryRows];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.category.toLowerCase().includes(query)
      );
    }

    // Sort by amount descending
    filtered.sort((a, b) => b.amount - a.amount);

    return filtered;
  }, [categoryRows, searchQuery]);

  const totals = useMemo(() => {
    const allUniqueCustomers = new Set<string>();
    const allUniqueMainCustomers = new Set<string>();

    const totalsData = filteredCategories.reduce((acc, item) => {
      acc.totalAmount += item.amount;
      acc.totalAvgMonthly += (item.avgMonthly || 0);
      acc.totalQty += item.qty;
      acc.totalProducts += item.productsCount || 0;
      if (item.customerIds) {
        item.customerIds.forEach((id: string) => allUniqueCustomers.add(id));
      }
      if (item.mainCustomerIds) {
        item.mainCustomerIds.forEach((id: string) => allUniqueMainCustomers.add(id));
      }
      return acc;
    }, {
      totalAmount: 0,
      totalAvgMonthly: 0,
      totalQty: 0,
      totalProducts: 0
    });

    return {
      ...totalsData,
      totalCustomers: allUniqueCustomers.size,
      totalMainCustomers: allUniqueMainCustomers.size
    };
  }, [filteredCategories]);

  const exportToExcel = async () => {
    const headers = ['#', 'Category', 'Products Count', 'Main Customers', 'Sub Customers', 'Amount', 'Monthly Avg', '% of Total', 'Qty'];

    const rows = filteredCategories.map((item, index) => {
      const salesShare = totals.totalAmount > 0 ? (item.amount / totals.totalAmount) * 100 : 0;
      return [
        index + 1,
        item.category,
        item.productsCount || 0,
        item.mainCustomers || 0,
        item.customers,
        item.amount,
        item.avgMonthly || 0,
        Number(salesShare.toFixed(2)),
        item.qty,
      ];
    });

    if (filteredCategories.length > 0) {
      rows.push(['', 'Total', totals.totalProducts, totals.totalMainCustomers, totals.totalCustomers, totals.totalAmount, totals.totalAvgMonthly, 100, totals.totalQty]);
    }

    const filename = `sales_categories_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Categories',
      numericColumns: ['Amount', '% of Total', 'Qty'],
    });
  };

  if (isInitialLoading) {
    return <SalesTabLoader />;
  }

  if (error) {
    return (
      <TabFetchError
        message={error}
        onRetry={() => void reload()}
        isRetrying={loading}
        className="min-h-[360px]"
      />
    );
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
      {filteredCategories.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-center">
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[5%]">#</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[25%]">Category</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[10%]">Products</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[10%]">Main Customers</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[10%]">Sub Customers</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[15%]">Amount</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[15%]">Monthly Avg</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[10%]">% of Total</th>
                  <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider w-[15%]">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCategories.map((item, index) => (
                  <CategoryRow
                    key={item.category}
                    item={item}
                    rowNumber={index + 1}
                    salesShare={totals.totalAmount > 0 ? (item.amount / totals.totalAmount) * 100 : 0}
                  />
                ))}
              </tbody>
              <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                <tr className="text-center">
                  <td className="py-4 px-4 text-sm text-gray-800" colSpan={2}>Grand Total</td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalProducts.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalMainCustomers.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalCustomers.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalAvgMonthly.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-sm text-indigo-600">100.00%</td>
                  <td className="py-4 px-4 text-sm text-gray-800">
                    {totals.totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

