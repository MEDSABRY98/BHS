'use client';

import React from 'react';
import NoData from '@/app/Components/NoDataTab';
import { AreaStat } from './PaymentTTypesTab';

interface PaymentTAreaTabProps {
  areaStats: AreaStat[];
}

const PaymentTAreaTab: React.FC<PaymentTAreaTabProps> = ({ areaStats }) => {
  if (areaStats.length === 0) {
    return <NoData title="NO DATA FOR SELECTED FILTERS" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Area Name</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Total Collected</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Payment Count</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Avg Payment Amount</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Avg Days Between</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {areaStats.map((area) => (
            <tr key={area.repName} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-center font-medium text-gray-900">{area.repName}</td>
              <td className="px-4 py-3 text-center font-medium text-gray-900">
                {area.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-center text-gray-700">{area.paymentCount.toLocaleString('en-US')}</td>
              <td className="px-4 py-3 text-center text-gray-700">
                {area.avgPaymentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-center text-gray-700">{area.avgCollectionDays.toFixed(1)} days</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t border-gray-200 font-semibold">
          <tr>
            <td className="px-4 py-3 text-center text-gray-900">Total / Average</td>
            <td className="px-4 py-3 text-center text-gray-900">
              {areaStats.reduce((acc, curr) => acc + curr.totalCollected, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-center text-gray-800">
              {areaStats.reduce((acc, curr) => acc + curr.paymentCount, 0).toLocaleString('en-US')}
            </td>
            <td className="px-4 py-3 text-center text-gray-800">
              {(areaStats.reduce((acc, curr) => acc + curr.totalCollected, 0) / (areaStats.reduce((acc, curr) => acc + curr.paymentCount, 0) || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td className="px-4 py-3 text-center text-gray-500">-</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default PaymentTAreaTab;
