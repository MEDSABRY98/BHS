'use client';

import { useMemo } from 'react';
import { SalesInvoice } from '@/lib/supabase';;
import { Download } from 'lucide-react';
import NoData from '@/app/Components/NoDataTab';
import * as XLSX from 'xlsx';

interface SalesCustomerCategoriesTabProps {
  data: SalesInvoice[];
  customerName: string;
  searchQuery?: string;
}

export default function SalesCustomerCategoriesTab({
  data,
  customerName,
  searchQuery = ''
}: SalesCustomerCategoriesTabProps) {
  // Aggregate data by productTag
  const categoriesData = useMemo(() => {
    const categoryMap = new Map<string, {
      category: string;
      amount: number;
      qty: number;
      invoiceNumbers: Set<string>;
    }>();

    data.forEach(item => {
      const category = item.productTag || 'Uncategorized';

      // Apply search filter if provided
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
        invoiceNumbers: new Set<string>()
      };

      existing.amount += item.amount;
      existing.qty += item.qty;

      // Count unique invoices (only sales)
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        existing.invoiceNumbers.add(item.invoiceNumber);
      }

      categoryMap.set(category, existing);
    });

    return Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);
  }, [data, searchQuery]);

  // Totals for the footer
  const totals = useMemo(() => {
    return categoriesData.reduce((acc, item) => {
      acc.amount += item.amount;
      acc.qty += item.qty;
      return acc;
    }, { amount: 0, qty: 0 });
  }, [categoriesData]);

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    const headers = ['#', 'Category', 'Amount', 'Quantity', 'Transactions'];

    const rows = categoriesData.map((item, index) => [
      index + 1,
      item.category,
      item.amount.toFixed(2),
      item.qty.toFixed(0),
      item.invoiceNumbers.size
    ]);

    // Add totals row
    rows.push([
      '',
      'GRAND TOTAL',
      totals.amount.toFixed(2),
      totals.qty.toFixed(0),
      ''
    ]);

    const sheetData = [headers, ...rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Categories');

    const safeCustomer = customerName.replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'customer';
    const filename = `customer_categories_${safeCustomer}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Categories Sales</h2>
        <button
          onClick={exportToExcel}
          className="p-2 rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors shadow-md active:scale-95"
          title="Export Categories to Excel"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        {categoriesData.length === 0 ? (
          <NoData />
        ) : (
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[10%]">#</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[40%]">Category</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[16%]">Amount</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[17%]">Quantity</th>
                <th className="py-4 px-4 text-center text-sm font-bold text-gray-500 uppercase tracking-wider w-[17%]">Transactions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categoriesData.map((item, index) => (
                <tr key={item.category} className="hover:bg-gray-50 transition-colors group">
                  <td className="py-4 px-4 text-center text-gray-400 font-medium">{index + 1}</td>
                  <td className="py-4 px-4 text-center text-gray-800 font-medium group-hover:text-green-600 transition-colors">
                    {item.category}
                  </td>
                  <td className="py-4 px-4 text-center text-gray-900 font-medium">
                    {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-center text-gray-700 font-medium">
                    {item.qty.toLocaleString('en-US')}
                  </td>
                  <td className="py-4 px-4 text-center text-gray-600 font-medium">
                    {item.invoiceNumbers.size}
                  </td>
                </tr>
              ))}

              <tr className="bg-gray-50/50 border-t-2 border-gray-100">
                <td className="py-5 px-4"></td>
                <td className="py-5 px-4 text-center text-gray-900 font-black text-lg">GRAND TOTAL</td>
                <td className="py-5 px-4 text-center text-green-700 font-black text-lg">
                  {totals.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-5 px-4 text-center text-gray-900 font-black text-lg">
                  {totals.qty.toLocaleString('en-US')}
                </td>
                <td className="py-5 px-4"></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
