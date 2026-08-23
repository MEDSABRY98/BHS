'use client';

import { useMemo } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { FileSpreadsheet } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';

interface CategoriesTabProps {
  data: SalesInvoice[];
  customerName: string;
  searchQuery?: string;
}

export default function CategoriesTab({
  data,
  customerName,
  searchQuery = '',
}: CategoriesTabProps) {
  const categoriesData = useMemo(() => {
    const categoryMap = new Map<
      string,
      {
        category: string;
        amount: number;
        qty: number;
        invoiceNumbers: Set<string>;
      }
    >();

    data.forEach((item) => {
      const category = item.productTag || 'Uncategorized';

      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const matchesCategory = category.toLowerCase().includes(query);
        const matchesProduct = item.product.toLowerCase().includes(query);
        if (!matchesCategory && !matchesProduct) return;
      }

      const existing = categoryMap.get(category) || {
        category,
        amount: 0,
        qty: 0,
        invoiceNumbers: new Set<string>(),
      };

      existing.amount += item.amount;
      existing.qty += item.qty;

      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }

      categoryMap.set(category, existing);
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  }, [data, searchQuery]);

  const totals = useMemo(() => {
    return categoriesData.reduce(
      (acc, item) => {
        acc.amount += item.amount;
        acc.qty += item.qty;
        return acc;
      },
      { amount: 0, qty: 0 }
    );
  }, [categoriesData]);

  const exportToExcel = async () => {
    const headers = ['#', 'Category', 'Amount', '% of Total', 'Quantity', 'Transactions'];

    const rows = categoriesData.map((item, index) => {
      const salesShare = totals.amount > 0 ? (item.amount / totals.amount) * 100 : 0;
      return [
        index + 1,
        item.category,
        item.amount,
        Number(salesShare.toFixed(2)),
        item.qty,
        item.invoiceNumbers.size,
      ];
    });

    rows.push(['', 'GRAND TOTAL', totals.amount, 100, totals.qty, '']);

    const safeCustomer = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
    const filename = `customer_categories_${safeCustomer}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Categories',
      numericColumns: ['Amount', '% of Total', 'Quantity'],
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Categories Sales</h2>
        <button
          onClick={exportToExcel}
          className="h-10 w-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-sm group"
          title="Export Categories to Excel"
        >
          <FileSpreadsheet className="h-5 w-5 transition-transform group-hover:scale-110" />
        </button>
      </div>

      <div className="overflow-x-auto">
        {categoriesData.length === 0 ? (
          <NoData />
        ) : (
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[8%]">#</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[34%]">Category</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[16%]">Amount</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[12%]">% of Total</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[15%]">Quantity</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[15%]">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categoriesData.map((item, index) => {
                const salesShare = totals.amount > 0 ? (item.amount / totals.amount) * 100 : 0;
                return (
                  <tr key={item.category} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-4 px-4 text-center text-gray-400 font-medium">{index + 1}</td>
                    <td className="py-4 px-4 text-center text-gray-800 font-medium group-hover:text-green-600 transition-colors">
                      {item.category}
                    </td>
                    <td className="py-4 px-4 text-center text-gray-900 font-medium">
                      {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-4 text-center text-indigo-600 font-bold">
                      {salesShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </td>
                    <td className="py-4 px-4 text-center text-gray-700 font-medium">
                      {item.qty.toLocaleString('en-US')}
                    </td>
                    <td className="py-4 px-4 text-center text-gray-600 font-medium">
                      {item.invoiceNumbers.size}
                    </td>
                  </tr>
                );
              })}

            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                <td className="py-4 px-4"></td>
                <td className="py-4 px-4 text-center text-gray-900 font-bold text-lg"></td>
                <td className="py-4 px-4 text-center text-gray-900 font-bold text-lg">
                  {totals.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-4 text-center text-indigo-700 font-bold text-lg">100.00%</td>
                <td className="py-4 px-4 text-center text-gray-900 font-bold text-lg">
                  {totals.qty.toLocaleString('en-US')}
                </td>
                <td className="py-4 px-4"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
