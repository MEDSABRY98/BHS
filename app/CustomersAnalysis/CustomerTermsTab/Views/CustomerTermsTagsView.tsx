import React, { useMemo } from 'react';
import { AlertCircle, Edit2, Tag } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';

interface CustomerTermsTagsViewProps {
  filteredCustomers: any[];
  customOverdueDays: number;
  setCustomOverdueDays: (days: number) => void;
  setSelectedCustomerForAging: (customer: any) => void;
  openEditModal: (customer: any) => void;
}

export default function CustomerTermsTagsView({
  filteredCustomers,
  customOverdueDays,
  setCustomOverdueDays,
  setSelectedCustomerForAging,
  openEditModal
}: CustomerTermsTagsViewProps) {
  
  const groupedTags = useMemo(() => {
    const taggedCustomers = filteredCustomers.filter(c => c.customerTags && c.customerTags.size > 0);
    const groups: Record<string, typeof taggedCustomers> = {};

    taggedCustomers.forEach(c => {
      const tags = Array.from(c.customerTags || []);
      tags.forEach((tag: any) => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(c);
      });
    });

    const sortedTags = Object.keys(groups).sort();
    
    return sortedTags.map(tag => {
      const rows = groups[tag];
      rows.sort((a, b) => {
        if (a.city !== b.city) return a.city.localeCompare(b.city);
        if (a.customerName !== b.customerName) return a.customerName.localeCompare(b.customerName);
        return b.netDebt - a.netDebt;
      });
      return { tag, rows };
    });
  }, [filteredCustomers]);

  if (groupedTags.length === 0) {
    return <NoData title="NO TAGGED CUSTOMERS FOUND" />;
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
        <tbody className="divide-y divide-gray-150 bg-white">
          {groupedTags.map(({ tag, rows }) => {
            const tagTotalDebt = rows.reduce((sum, r) => sum + r.netDebt, 0);
            const tagTotalSevereDebt = rows.reduce((sum, r) => sum + r.severeDebt, 0);
            const tagTotalCreditLimit = rows.reduce((sum, r) => sum + r.creditLimit, 0);
            const tagTotalExceededAmt = rows.reduce((sum, r) => sum + r.exceededAmount, 0);
            const tagAvgPaymentTerm = Math.round(rows.reduce((sum, r) => sum + r.paymentTerm, 0) / (rows.length || 1));
            const tagAvgExceededDays = Math.round(rows.reduce((sum, r) => sum + r.exceededDays, 0) / (rows.length || 1));
            
            return (
              <React.Fragment key={tag}>
                {/* Tag Header Row */}
                <tr className="bg-slate-200 text-slate-800">
                  <td colSpan={3} className="py-2.5 px-4 text-left border-y border-slate-300">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-slate-500" />
                      <div className="flex flex-col">
                        <span className="font-black text-sm">{tag}</span>
                        <span className="text-[10px] font-bold text-slate-500">{rows.length} Customers</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-sm font-black border-y border-slate-300 text-indigo-700">{tagAvgPaymentTerm}d</td>
                  <td className="py-2.5 px-4 text-sm font-black border-y border-slate-300 text-red-600">{tagAvgExceededDays}d</td>
                  <td className="py-2.5 px-4 text-sm font-black border-y border-slate-300">{tagTotalDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</td>
                  <td className="py-2.5 px-4 text-sm font-black border-y border-slate-300 text-red-600">{tagTotalSevereDebt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</td>
                  <td className="py-2.5 px-4 text-sm font-black border-y border-slate-300 text-slate-600">{tagTotalCreditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</td>
                  <td className="py-2.5 px-4 text-sm font-black border-y border-slate-300 text-red-600">
                    {tagTotalExceededAmt > 0.01 ? `+${tagTotalExceededAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED` : '—'}
                  </td>
                  <td className="py-2.5 px-4 border-y border-slate-300 text-slate-400">-</td>
                  <td className="py-2.5 px-4 border-y border-slate-300 text-slate-400">-</td>
                </tr>

                {/* Customer Rows for Tag */}
                {rows.map((c, index) => (
                  <tr key={`${tag}-${c.customerId || index}`} className="group hover:bg-gray-50/50 transition-all text-center">
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
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
