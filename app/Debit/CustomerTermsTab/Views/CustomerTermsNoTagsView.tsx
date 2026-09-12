import React from 'react';
import { AlertCircle, Edit2 } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';

interface CustomerTermsNoTagsViewProps {
  filteredCustomers: any[];
  customOverdueDays: number;
  setCustomOverdueDays: (days: number) => void;
  totalDebt: number;
  totalExceeded: number;
  setSelectedCustomerForAging: (customer: any) => void;
  openEditModal: (customer: any) => void;
}

export default function CustomerTermsNoTagsView({
  filteredCustomers,
  customOverdueDays,
  setCustomOverdueDays,
  totalDebt,
  totalExceeded,
  setSelectedCustomerForAging,
  openEditModal
}: CustomerTermsNoTagsViewProps) {
  if (filteredCustomers.length === 0) {
    return <NoData title="NO CUSTOMERS FOUND" />;
  }

  return (
    <div className="w-full">
      <table className="w-full text-center border-collapse" style={{ minWidth: '1200px', direction: 'ltr' }}>
        <thead className="bg-slate-900 text-white sticky top-0 z-30 shadow-md">
          <tr className="text-center">
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">#</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">Customer Name</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">City</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">Payment Term</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">Exc Days</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">Net Debt</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1">
              &gt; <input 
                type="number" 
                className="w-14 text-center bg-slate-800 text-white rounded border border-slate-700 px-1 py-0.5 text-sm focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                value={customOverdueDays} 
                onChange={(e) => setCustomOverdueDays(Number(e.target.value) || 0)} 
              />
            </th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">Credit Limit</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">Exceeded Amt</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">% Exc</th>
            <th className="py-4.5 px-4 text-xs font-black uppercase tracking-wider">
              <AlertCircle className="w-4 h-4 mx-auto" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-150">
          {filteredCustomers.map((c, index) => (
            <tr key={index} className="group hover:bg-gray-50/50 transition-all text-center">
              <td className="py-3 px-4 text-center text-xs font-black text-gray-400">{index + 1}</td>
              <td className="py-3 px-4 text-left">
                <div className="flex flex-col items-start gap-1">
                  <button 
                    onClick={() => setSelectedCustomerForAging(c)}
                    className={`font-black text-sm block truncate max-w-xs cursor-pointer transition-colors hover:underline ${c.accountStatus === 'ON_HOLD' ? 'text-gray-400 line-through' : 'text-black'}`}
                    title={c.customerName}
                  >
                    {c.customerName}
                  </button>
                  {c.accountStatus === 'ON_HOLD' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-black uppercase tracking-wider">
                      On Hold
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black uppercase tracking-wider">
                  {c.city}
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-black">
                  {c.paymentTerm} days
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                {c.exceededDays > 0 ? (
                  <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg font-black text-sm">
                    +{c.exceededDays} d
                  </span>
                ) : (
                  <span className="text-xs text-emerald-600 font-bold">OK</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                <span className="text-sm font-black text-black whitespace-nowrap">
                  {c.netDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                <span className={`text-sm font-black whitespace-nowrap ${c.severeDebt > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {c.severeDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                </span>
              </td>
              <td className="py-3 px-4 text-center">
                {c.creditLimit > 0 ? (
                  <span className="text-sm font-black text-gray-500 whitespace-nowrap">
                    {c.creditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                  </span>
                ) : (
                  <span className="text-xs text-gray-300 font-bold">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {c.exceededAmount > 0.01 ? (
                  <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg font-black text-xs whitespace-nowrap">
                    +{c.exceededAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
                  </span>
                ) : (
                  <span className="text-xs text-emerald-600 font-bold whitespace-nowrap">OK</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {c.exceededAmount > 0.01 ? (
                  <span className="inline-block px-2.5 py-1 bg-red-100 text-red-700 text-xs font-black rounded-lg">
                    {c.exceededPercentage.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-xs text-gray-300 font-bold">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                <button 
                  onClick={() => openEditModal(c)}
                  className="p-2 bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-all"
                  title="Edit Terms"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          
          {/* Total Footer Row */}
          <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-center">
            <td className="py-3 px-4">-</td>
            <td className="py-3 px-4 text-sm font-black text-black">Total</td>
            <td className="py-3 px-4">-</td>
            <td className="py-3 px-4 text-sm font-black text-indigo-600">
              {Math.round(filteredCustomers.reduce((sum, c) => sum + c.paymentTerm, 0) / (filteredCustomers.length || 1))} days avg
            </td>
            <td className="py-3 px-4 text-sm font-black text-red-600">
              {Math.round(filteredCustomers.reduce((sum, c) => sum + c.exceededDays, 0) / (filteredCustomers.length || 1))} days avg
            </td>
            <td className="py-3 px-4 text-sm font-black text-black">
              {totalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
            </td>
            <td className="py-3 px-4 text-sm font-black text-red-600">
              {filteredCustomers.reduce((sum, c) => sum + c.severeDebt, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
            </td>
            <td className="py-3 px-4 text-sm font-black text-gray-500">
              {filteredCustomers.reduce((sum, c) => sum + c.creditLimit, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
            </td>
            <td className="py-3 px-4 text-sm font-black text-red-600">
              {totalExceeded > 0.01 ? `+${totalExceeded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED` : '—'}
            </td>
            <td className="py-5 px-4">
              {totalExceeded > 0.01 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-600 text-white text-xs font-black rounded-lg">
                  Warning
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-xs font-black rounded-lg">
                  OK
                </span>
              )}
            </td>
            <td className="py-5 px-4">-</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
