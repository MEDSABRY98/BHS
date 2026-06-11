'use client';

import React from 'react';
import { AreaStat } from './PaymentTTypesTab';

interface PaymentTAreaTabProps {
  areaStats: AreaStat[];
}

const PaymentTAreaTab: React.FC<PaymentTAreaTabProps> = ({ areaStats }) => {
  return (
    <div className="bg-white/90 backdrop-blur-md rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden animate-fadeIn pb-4">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-gray-600 uppercase tracking-wider">
              Area Name
            </th>
            <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-gray-600 uppercase tracking-wider">
              Total Collected
            </th>
            <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-gray-600 uppercase tracking-wider">
              Payment Count
            </th>
            <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-blue-700 uppercase tracking-wider">
              Avg Payment Amount
            </th>
            <th scope="col" className="px-6 py-4 text-center text-sm font-bold text-orange-700 uppercase tracking-wider">
              Avg Days Between Payments
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 text-base">
          {areaStats.map((area) => (
            <tr key={area.repName} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 text-center">
                {area.repName}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-600 text-center">
                {area.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-gray-700 text-center">
                {area.paymentCount.toLocaleString('en-US')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600 text-center">
                {area.avgPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 whitespace-nowrap font-medium text-orange-600 text-center">
                {area.avgCollectionDays.toFixed(1)} days
              </td>
            </tr>
          ))}
          {areaStats.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                No data available for the selected filters
              </td>
            </tr>
          )}
        </tbody>
        {areaStats.length > 0 && (
          <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-bold text-base">
            <tr>
              <td className="px-6 py-4 text-center text-gray-900">Total / Average</td>
              <td className="px-6 py-4 text-center text-emerald-700">
                {areaStats.reduce((acc, curr) => acc + curr.totalCollected, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 text-center text-gray-800">
                {areaStats.reduce((acc, curr) => acc + curr.paymentCount, 0).toLocaleString('en-US')}
              </td>
              <td className="px-6 py-4 text-center text-blue-700">
                {(areaStats.reduce((acc, curr) => acc + curr.totalCollected, 0) / (areaStats.reduce((acc, curr) => acc + curr.paymentCount, 0) || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 text-center text-orange-700">
                -
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

export default PaymentTAreaTab;
