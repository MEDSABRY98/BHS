'use client';
import { isSalesInvoiceNo } from '@/app/Sales/Utils/InvoiceNumber';

import { useMemo } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { Download } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportSalesExcelTable } from '@/app/Sales/Export/ExcelExport';

interface CategoryProductsTabProps {
  categoryData: SalesInvoice[];
  category: string;
}

export default function CategoryProductsTab({ categoryData, category }: CategoryProductsTabProps) {
  const productsData = useMemo(() => {
    const map = new Map<string, {
      key: string;
      barcode: string;
      product: string;
      unit: string;
      amount: number;
      qty: number;
      customers: Set<string>;
      invoiceNumbers: Set<string>;
      lastInvoiceDate: string | null;
    }>();

    categoryData.forEach(item => {
      const key = item.productId || item.barcode || item.product;
      if (!key) return;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          barcode: item.barcode || '-',
          product: item.product || key,
          unit: (item as any).unit || '-',
          amount: 0,
          qty: 0,
          customers: new Set<string>(),
          invoiceNumbers: new Set<string>(),
          lastInvoiceDate: null,
        };
        map.set(key, row);
      }
      row.amount += Number(item.amount) || 0;
      row.qty += Number(item.qty) || 0;
      const customerKey = item.customerId || item.customerName;
      if (customerKey) row.customers.add(customerKey);
      if (item.invoiceNumber && isSalesInvoiceNo(item.invoiceNumber)) {
        row.invoiceNumbers.add(item.invoiceNumber);
      }
      if (item.invoiceDate) {
        const d = new Date(item.invoiceDate);
        if (!isNaN(d.getTime()) && (!row.lastInvoiceDate || d > new Date(row.lastInvoiceDate))) {
          row.lastInvoiceDate = item.invoiceDate;
        }
      }
    });

    const rows = Array.from(map.values()).sort((a, b) => b.amount - a.amount);
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    return rows.map(r => ({
      ...r,
      customersCount: r.customers.size,
      invoiceCount: r.invoiceNumbers.size,
      share: total > 0 ? (r.amount / total) * 100 : 0,
    }));
  }, [categoryData]);

  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

  const exportToExcel = async () => {
    const headers = ['#', 'Barcode', 'Product', 'Unit', 'Amount', '% of Category', 'Quantity', 'Customers', 'Purchase Count', 'Last Invoice Date'];
    const rows = productsData.map((item, index) => [
      index + 1,
      item.barcode,
      item.product,
      item.unit,
      item.amount,
      Number(item.share.toFixed(2)),
      item.qty,
      item.customersCount,
      item.invoiceCount,
      fmtDate(item.lastInvoiceDate),
    ]);
    const safeId = (category || 'category').replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'category';
    const filename = `sales_category_products_${safeId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Products',
      numericColumns: ['Amount', '% of Category', 'Quantity'],
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <h2 className="text-xl font-bold text-gray-800">Category Products</h2>
        <button
          onClick={exportToExcel}
          className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all shadow-md active:scale-95"
          title="Export to Excel"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
      {productsData.length === 0 ? (
        <NoData />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-16">#</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-36">Barcode</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-64">Product</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Amount</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-28">% of Category</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-24">Quantity</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-24">Customers</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Purchase Count</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-36">Last Date</th>
              </tr>
            </thead>
            <tbody>
              {productsData.map((item, index) => (
                <tr key={item.key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 text-base text-gray-600 font-medium text-center">{index + 1}</td>
                  <td className="py-3 px-4 text-base text-gray-800 font-medium text-center truncate" title={item.barcode}>{item.barcode}</td>
                  <td className="py-3 px-4 text-base text-gray-800 font-medium text-center truncate" title={item.product}>{item.product}</td>
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                    {item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-base text-indigo-600 font-bold text-center">
                    {item.share.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </td>
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                    {item.qty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">{item.customersCount}</td>
                  <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">{item.invoiceCount}</td>
                  <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">{fmtDate(item.lastInvoiceDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
