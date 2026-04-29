import React from 'react';
import NoData from '../../../01-Unified/NoDataTab';
import { SharedTabProps } from '../Types';

export default function AgesTab(props: SharedTabProps) {
  const { agingData } = props;

  return (
    <div>
      {agingData.total <= 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', direction: 'ltr' }}>
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>AT DATE</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>1 - 30</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>31 - 60</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>61 - 90</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>91 - 120</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '14%' }}>OLDER</th>
                  <th className="px-4 py-3 text-center font-semibold bg-gray-200 border-b border-gray-300" style={{ width: '16%' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="px-4 py-4 text-center text-lg text-green-600 font-semibold">
                    {agingData.atDate.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center text-lg">
                    {agingData.oneToThirty.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center text-lg">
                    {agingData.thirtyOneToSixty.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center text-lg">
                    {agingData.sixtyOneToNinety.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center text-lg">
                    {agingData.ninetyOneToOneTwenty.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center text-lg text-red-600 font-semibold">
                    {agingData.older.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-4 text-center text-lg font-bold bg-gray-50">
                    {agingData.total.toLocaleString('en-US')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
