import React, { useMemo } from 'react';
import NoData from '@/app/Components/DataState/NoDataTab';

interface AvgSalesByDayTabProps {
  avgSalesByDayData: any[];
}

export default function AvgSalesByDayTab({ avgSalesByDayData }: AvgSalesByDayTabProps) {
  // Get bounds for heat map in AVG Sales BY Day
  const avgSalesByDayBounds = useMemo(() => {
    if (avgSalesByDayData.length === 0) return null;

    const bounds = {
      avgAmount: { min: Infinity, max: -Infinity },
      avgQty: { min: Infinity, max: -Infinity },
      avgInvoices: { min: Infinity, max: -Infinity },
      avgCustomers: { min: Infinity, max: -Infinity },
      avgProducts: { min: Infinity, max: -Infinity },
    };

    avgSalesByDayData.forEach(item => {
      bounds.avgAmount.min = Math.min(bounds.avgAmount.min, item.avgAmount);
      bounds.avgAmount.max = Math.max(bounds.avgAmount.max, item.avgAmount);

      bounds.avgQty.min = Math.min(bounds.avgQty.min, item.avgQty);
      bounds.avgQty.max = Math.max(bounds.avgQty.max, item.avgQty);

      bounds.avgInvoices.min = Math.min(bounds.avgInvoices.min, item.avgInvoices);
      bounds.avgInvoices.max = Math.max(bounds.avgInvoices.max, item.avgInvoices);

      bounds.avgCustomers.min = Math.min(bounds.avgCustomers.min, item.avgCustomers);
      bounds.avgCustomers.max = Math.max(bounds.avgCustomers.max, item.avgCustomers);

      bounds.avgProducts.min = Math.min(bounds.avgProducts.min, item.avgProducts);
      bounds.avgProducts.max = Math.max(bounds.avgProducts.max, item.avgProducts);
    });

    return bounds;
  }, [avgSalesByDayData]);

  const getHeatMapStyle = (value: number, colName: keyof NonNullable<typeof avgSalesByDayBounds>) => {
    if (!avgSalesByDayBounds) return {};
    const { min, max } = avgSalesByDayBounds[colName];
    if (max === min) return {
      padding: '4px 12px',
      borderRadius: '9999px',
      display: 'inline-block'
    };

    // Calculate percentage and apply a power function to bias more towards green
    // Using 0.7 power makes higher values "greener" faster
    const percentage = (value - min) / (max - min);
    const biasedPercentage = Math.pow(percentage, 0.7);

    // Hue: 0 (red) to 140 (greenish-blue, biased to stay green longer)
    const hue = Math.min(125, biasedPercentage * 160);

    return {
      backgroundColor: `hsla(${hue}, 85%, 45%, 0.18)`,
      color: `hsl(${hue}, 90%, 20%)`,
      fontWeight: '800',
      padding: '4px 12px',
      borderRadius: '9999px',
      display: 'inline-block',
      minWidth: '80px',
      boxShadow: `0 1px 2px hsla(${hue}, 80%, 20%, 0.1)`
    };
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between p-6">
        <h2 className="text-xl font-bold text-gray-800">AVG Sales BY Day</h2>
      </div>
      {avgSalesByDayData.length === 0 ? (
        <NoData />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-40">Month/Year</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Amount</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Quantity</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Invoices</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Customers</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700 w-48">Avg Daily Products</th>
              </tr>
            </thead>
            <tbody>
              {avgSalesByDayData.map((item, index) => (
                <tr key={`${item.monthKey}-${index}`} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="text-center py-3 px-4 text-base font-semibold text-gray-800">
                    {item.monthYear}
                  </td>
                  <td className="text-center py-3 px-4">
                    <span style={getHeatMapStyle(item.avgAmount, 'avgAmount')}>
                      {item.avgAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span style={getHeatMapStyle(item.avgQty, 'avgQty')}>
                      {item.avgQty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span style={getHeatMapStyle(item.avgInvoices, 'avgInvoices')}>
                      {item.avgInvoices.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span style={getHeatMapStyle(item.avgCustomers, 'avgCustomers')}>
                      {item.avgCustomers.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="text-center py-3 px-4">
                    <span style={getHeatMapStyle(item.avgProducts, 'avgProducts')}>
                      {item.avgProducts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
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
