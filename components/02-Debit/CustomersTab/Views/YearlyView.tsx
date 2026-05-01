import React from 'react';
import { CustomerAnalysis } from '@/types';

interface YearlyViewProps {
  yearlyPivotData: {
    sortedYears: string[];
    rows: any[];
  };
  selectedCustomersForDownload: Set<string>;
  setSelectedCustomersForDownload: (selection: Set<string>) => void;
  toggleCustomerSelection: (name: string) => void;
  setSelectedCustomer: (name: string) => void;
  yearlySorting: { id: string; desc: boolean };
  handleYearlySort: (id: string) => void;
}

const YearlyView: React.FC<YearlyViewProps> = ({
  yearlyPivotData,
  selectedCustomersForDownload,
  setSelectedCustomersForDownload,
  toggleCustomerSelection,
  setSelectedCustomer,
  yearlySorting,
  handleYearlySort,
}) => {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border-collapse table-auto">
          <thead className="bg-[#0f172a]">
            <tr>
              <th className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-slate-700 w-20">#</th>
              <th
                className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-slate-700 min-w-[350px] cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => handleYearlySort('name')}
              >
                <div className="flex items-center justify-center gap-3">
                  <input
                    type="checkbox"
                    checked={yearlyPivotData.rows.length > 0 && yearlyPivotData.rows.every(r => selectedCustomersForDownload.has(r.customerName))}
                    onChange={(e) => {
                      e.stopPropagation();
                      const allChecked = yearlyPivotData.rows.every(r => selectedCustomersForDownload.has(r.customerName));
                      const newSelection = new Set(selectedCustomersForDownload);
                      yearlyPivotData.rows.forEach(r => {
                        if (allChecked) newSelection.delete(r.customerName);
                        else newSelection.add(r.customerName);
                      });
                      setSelectedCustomersForDownload(newSelection);
                    }}
                    className="w-4 h-4 text-white bg-slate-700 border-slate-500 rounded focus:ring-blue-500 cursor-pointer"
                    title="Select All"
                  />
                  <span>Customer Name {yearlySorting.id === 'name' && (yearlySorting.desc ? '↓' : '↑')}</span>
                </div>
              </th>
              <th
                className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-slate-700 w-48 cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => handleYearlySort('city')}
              >
                City {yearlySorting.id === 'city' && (yearlySorting.desc ? '↓' : '↑')}
              </th>
              <th
                className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-slate-700 w-48 cursor-pointer hover:bg-slate-800 transition-colors"
                onClick={() => handleYearlySort('netDebt')}
              >
                Net Debt {yearlySorting.id === 'netDebt' && (yearlySorting.desc ? '↓' : '↑')}
              </th>
              {yearlyPivotData.sortedYears.map(year => (
                <th
                  key={year}
                  className="px-6 py-4 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-slate-700 w-40 cursor-pointer hover:bg-slate-800 transition-colors"
                  onClick={() => handleYearlySort(year)}
                >
                  {year} {yearlySorting.id === year && (yearlySorting.desc ? '↓' : '↑')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {yearlyPivotData.rows.length === 0 ? (
              <tr>
                <td colSpan={yearlyPivotData.sortedYears.length + 4} className="py-20 text-center text-gray-500 font-medium italic">
                  No customer data found for yearly view.
                </td>
              </tr>
            ) : (
              yearlyPivotData.rows.map((row, index) => (
                <tr key={row.customerName} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-center text-sm font-medium text-slate-500 border-r border-gray-100">{index + 1}</td>
                  <td className="px-6 py-4 border-r border-gray-100 font-bold text-slate-900 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCustomersForDownload.has(row.customerName)}
                        onChange={() => toggleCustomerSelection(row.customerName)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <button onClick={() => setSelectedCustomer(row.customerName)} className="hover:text-blue-600 transition-colors truncate">
                        {row.customerName}
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center text-sm font-medium text-slate-600 border-r border-gray-100">{row.region}</td>
                  <td className={`px-6 py-4 text-center text-lg font-black border-r border-gray-100 ${row.totalNetDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {row.totalNetDebt.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  {yearlyPivotData.sortedYears.map(year => {
                    const amount = row.yearlyAmounts[year] || 0;
                    return (
                      <td key={year} className={`px-6 py-4 text-center text-base font-bold border-r border-gray-100 ${amount > 0 ? 'text-red-500' : amount < 0 ? 'text-green-500' : 'text-gray-200'}`}>
                        {amount !== 0 ? amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          <tfoot className="bg-slate-100 font-black border-t-4 border-slate-300">
            <tr>
              <td colSpan={3} className="px-8 py-6 text-center text-lg font-black text-blue-600">
                {yearlyPivotData.rows.length}
              </td>
              <td className="px-6 py-6 text-center text-lg text-slate-900 bg-slate-200/50">
                {yearlyPivotData.rows.reduce((sum, r) => sum + r.totalNetDebt, 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </td>
              {yearlyPivotData.sortedYears.map(year => (
                <td key={year} className="px-6 py-6 text-center text-lg text-slate-900">
                  {yearlyPivotData.rows.reduce((sum, r) => sum + (r.yearlyAmounts[year] || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default YearlyView;
