'use client';

import { useMemo } from 'react';
import { SalesInvoice } from '@/lib/supabase';
import { Download, Building2 } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { exportSalesExcelTable } from '@/app/Sales/Utils/ExcelExport';

interface CitiesTabProps {
  productData: SalesInvoice[];
  productId: string;
}

export default function CitiesTab({ productData, productId }: CitiesTabProps) {
  const { citiesData, totalAmount } = useMemo(() => {
    const cityMap = new Map<string, {
      city: string;
      amount: number;
      qty: number;
      uniqueMonths: Set<string>;
    }>();

    let totalAmountCalc = 0;

    productData.forEach(item => {
      const city = item.area || 'Unknown';
      totalAmountCalc += item.amount;

      if (!cityMap.has(city)) {
        cityMap.set(city, {
          city,
          amount: 0,
          qty: 0,
          uniqueMonths: new Set<string>()
        });
      }

      const existing = cityMap.get(city)!;
      existing.amount += item.amount;
      existing.qty += item.qty;

      if (item.invoiceDate) {
        try {
          const date = new Date(item.invoiceDate);
          if (!isNaN(date.getTime())) {
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            existing.uniqueMonths.add(monthKey);
          }
        } catch (e) {
          // ignore
        }
      }
    });

    const mappedData = Array.from(cityMap.values()).map(cityItem => {
      const activeMonths = cityItem.uniqueMonths.size || 1;
      const avgAmount = cityItem.amount / activeMonths;
      const percentage = totalAmountCalc > 0 ? (cityItem.amount / totalAmountCalc) * 100 : 0;

      return {
        ...cityItem,
        avgAmount,
        percentage
      };
    }).sort((a, b) => b.amount - a.amount); // Sort by amount descending

    return { citiesData: mappedData, totalAmount: totalAmountCalc };
  }, [productData]);

  const exportCitiesToExcel = async () => {
    const headers = ['#', 'City', 'Amount', 'Avg Amount', 'Percentage', 'Quantity'];

    const rows = citiesData.map((item: any, index: number) => [
      index + 1,
      item.city,
      item.amount,
      item.avgAmount,
      `${item.percentage.toFixed(2)}%`,
      item.qty,
    ]);

    const safeId = (productId || 'product').replace(/[^a-zA-Z0-9\u0600-\u06FF \-_]/g, '').trim() || 'product';
    const filename = `sales_product_cities_${safeId}_${new Date().toISOString().split('T')[0]}.xlsx`;
    await exportSalesExcelTable(headers, rows, filename, {
      sheetName: 'Cities',
      numericColumns: ['Amount', 'Avg Amount', 'Quantity'],
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-gray-800">Cities Sales</h2>
        </div>
        <button
          onClick={exportCitiesToExcel}
          className="p-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all shadow-md active:scale-95"
          title="Export to Excel"
        >
          <Download className="w-5 h-5" />
        </button>
      </div>

      {citiesData.length === 0 ? (
        <NoData />
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider w-16">#</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider w-64">City Name</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider w-32">Amount</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider w-32">Avg Amount</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider w-32">Percentage</th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-gray-500 uppercase tracking-wider w-24">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {citiesData.map((item, index) => (
              <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 text-base text-gray-600 font-medium text-center">{index + 1}</td>
                <td className="py-3 px-4 text-base text-gray-800 font-medium text-center w-64 truncate" title={item.city}>{item.city}</td>
                <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                  {item.amount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
                <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                  {item.avgAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </td>
                <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>{item.percentage.toFixed(1)}%</span>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-full rounded-full" 
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-base text-gray-800 font-semibold text-center">
                  {item.qty.toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0
                  })}
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
