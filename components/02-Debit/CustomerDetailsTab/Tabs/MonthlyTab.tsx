import React from 'react';
import NoData from '../../../01-Unified/NoDataTab';
import { SharedTabProps } from '../Types';

export default function MonthlyTab(props: SharedTabProps) {
  const { monthlyDebt } = props;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '25%' }}>Month</th>
              <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '25%' }}>Debit (Sales)</th>
              <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '25%' }}>Credit (Paid)</th>
              <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '25%' }}>Discounts (BIL)</th>
            </tr>
          </thead>
          <tbody>
            {monthlyDebt.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12">
                  <NoData />
                </td>
              </tr>
            ) : (
              monthlyDebt.map((row, index) => (
                <tr key={`${row.year}-${row.month}`} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-center text-lg font-medium">
                    {row.month} {row.year}
                  </td>
                  <td className="px-4 py-3 text-center text-lg text-blue-600">
                    {row.debit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg text-green-600">
                    {row.credit.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3 text-center text-lg text-yellow-600 font-bold">
                    {row.discounts.toLocaleString('en-US')}
                  </td>
                </tr>
              ))
            )}
            {monthlyDebt.length > 0 && (
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-center text-lg">Total</td>
                <td className="px-4 py-3 text-center text-lg">
                  {monthlyDebt.reduce((sum, r) => sum + r.debit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg">
                  {monthlyDebt.reduce((sum, r) => sum + r.credit, 0).toLocaleString('en-US')}
                </td>
                <td className="px-4 py-3 text-center text-lg text-yellow-700">
                  {monthlyDebt.reduce((sum, r) => sum + r.discounts, 0).toLocaleString('en-US')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
