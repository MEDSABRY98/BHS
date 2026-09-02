'use client';

import { useState, useMemo } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { Download } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';

interface CustomersTabProps {
  productData: SalesInvoice[];
  productId: string;
}

export default function CustomersTab({ productData, productId }: CustomersTabProps) {
  const [customerTypeView, setCustomerTypeView] = useState<'main' | 'sub'>('sub');

  // Customers data - grouped by customerId or customerMainName, display customerName or customerMainName
  const customersData = useMemo(() => {
    const customerMap = new Map<string, {
      customerId: string;
      customer: string;
      amount: number;
      qty: number;
      invoiceNumbers: Set<string>;
      lastInvoiceDate: string | null;
    }>();

    productData.forEach(item => {
      const key = customerTypeView === 'main'
        ? (item.customerMainName || item.customerName)
        : (item.customerId || item.customerName);

      const displayName = customerTypeView === 'main'
        ? (item.customerMainName || item.customerName)
        : item.customerName;

      const existing = customerMap.get(key);

      if (!existing) {
        customerMap.set(key, {
          customerId: key,
          customer: displayName,
          amount: 0,
          qty: 0,
          invoiceNumbers: new Set<string>(),
          lastInvoiceDate: null
        });
      }

      const customer = customerMap.get(key)!;
      customer.amount += item.amount;
      customer.qty += item.qty;

      // Add invoice number if available (only invoices starting with "SAL")
      if (item.invoiceNumber && item.invoiceNumber.trim().toUpperCase().startsWith('SAL')) {
        customer.invoiceNumbers.add(item.invoiceNumber);
      }

      // Update last invoice date
      if (item.invoiceDate) {
        try {
          const itemDate = new Date(item.invoiceDate);
          if (!isNaN(itemDate.getTime())) {
            if (!customer.lastInvoiceDate) {
              customer.lastInvoiceDate = item.invoiceDate;
            } else {
              const existingDate = new Date(customer.lastInvoiceDate);
              if (itemDate > existingDate) {
                customer.lastInvoiceDate = item.invoiceDate;
              }
            }
          }
        } catch (e) {
          // Invalid date, skip
        }
      }
    });

    // Sort by amount descending and add invoice count
    return Array.from(customerMap.values()).map(customer => ({
      ...customer,
      invoiceCount: customer.invoiceNumbers.size
    })).sort((a, b) => b.amount - a.amount);
  }, [productData, customerTypeView]);

  const exportCustomersToExcel = async () => {
    const headers = ['#', 'Customer Name', 'Amount', 'Quantity', 'Purchase Count', 'Last Invoice Date'];

    const rows = customersData.map((item: any, index: number) => [
      index + 1,
      item.customer,
      item.amount,
      item.qty,
      item.invoiceCount || 0,
      item.lastInvoiceDate ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }) : '-',
    ]);

    const safeId = (productId || 'product').replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'product';
    const filename = `sales_product_customers_${safeId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Customers',
      numericColumns: ['Amount', 'Quantity'],
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800">Customers Sales</h2>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setCustomerTypeView('main')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${customerTypeView === 'main'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Main Customers
            </button>
            <button
              onClick={() => setCustomerTypeView('sub')}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${customerTypeView === 'sub'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Sub Customers
            </button>
          </div>
        </div>
        <button
          onClick={exportCustomersToExcel}
          className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all shadow-md active:scale-95"
          title="Export to Excel"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>
      {customersData.length === 0 ? (
        <NoData />
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-16">#</th>
              <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-64">Customer Name</th>
              <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Amount</th>
              <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-24">Quantity</th>
              <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-32">Purchase Count</th>
              <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-40">Last Date</th>
            </tr>
          </thead>
          <tbody>
            {customersData.map((item, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-base text-gray-600 font-medium text-center">{index + 1}</td>
                <td className="py-3 px-4 text-base text-gray-800 font-medium text-center w-64 truncate" title={item.customer}>{item.customer}</td>
                <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                  {item.amount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
                <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                  {item.qty.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
                </td>
                <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                  {item.invoiceCount || 0}
                </td>
                <td className="py-3 px-4 text-base text-gray-800 font-medium text-center">
                  {item.lastInvoiceDate ? new Date(item.lastInvoiceDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  }) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
