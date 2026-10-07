'use client';

import NoData from '@/app/Components/DataState/NoDataTab';
import type { MonthlySalesRow } from '../Types';

interface MonthlyTabProps {
  monthlySales: MonthlySalesRow[];
}

export default function MonthlyTab({ monthlySales }: MonthlyTabProps) {
  const totalAmount = monthlySales.reduce((sum, item) => sum + item.amount, 0);
  const totalQty = monthlySales.reduce((sum, item) => sum + item.qty, 0);
  const totalCount = monthlySales.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Sales by Month</h2>
      {monthlySales.length === 0 ? (
        <NoData />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Month</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Amount</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Change</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Quantity</th>
                <th className="text-center py-3 px-4 text-base font-semibold text-gray-700">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {monthlySales.map((item, index) => (
                <tr
                  key={index}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${item.isZeroMonth ? 'bg-gray-50 opacity-60' : ''}`}
                >
                  <td
                    className={`py-3 px-4 text-base font-medium text-center ${
                      item.isZeroMonth ? 'text-gray-500 line-through' : 'text-gray-800'
                    }`}
                  >
                    {item.month}
                  </td>
                  <td
                    className={`py-3 px-4 text-base font-semibold text-center ${
                      item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                    }`}
                  >
                    {item.amount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-3 px-4 text-base font-semibold text-center">
                    {item.amountChange !== null && item.amountChange !== undefined ? (
                      <span className={item.amountChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {item.amountChange >= 0 ? '+' : ''}
                        {item.amountChange.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td
                    className={`py-3 px-4 text-base font-semibold text-center ${
                      item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                    }`}
                  >
                    {item.qty.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td
                    className={`py-3 px-4 text-base font-semibold text-center ${
                      item.isZeroMonth ? 'text-gray-400 line-through' : 'text-gray-800'
                    }`}
                  >
                    {item.count}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                <td className="py-4 px-4 text-base text-gray-800 font-bold text-center">
                  
                </td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-4 px-4"></td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalQty.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td className="py-4 px-4 text-base text-gray-900 font-bold text-center">
                  {totalCount.toLocaleString('en-US')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
