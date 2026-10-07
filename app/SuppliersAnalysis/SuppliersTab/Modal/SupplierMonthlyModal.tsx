import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import { SupplierTransaction, SupplierRecord } from '../../Service/suppliers_service';
import NoData from '../../../Components/DataState/NoDataTab';

interface SupplierMonthlyModalProps {
  supplier: SupplierRecord;
  transactions: SupplierTransaction[];
  onClose: () => void;
}

export default function SupplierMonthlyModal({ supplier, transactions, onClose }: SupplierMonthlyModalProps) {
  const monthlyData = useMemo(() => {
    const dataMap: Record<string, { balance: number; dueAmount: number; notDueAmount: number }> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentTerm = Number(supplier?.['PAYMENT TERM']) || 0;

    transactions.forEach(t => {
      if (t['SUPPLIER ID'] !== supplier['SUPPLIER ID']) return;
      
      const residual = Number(t['RESIDUAL AMOUNT']) || 0;
      if (residual === 0) return;

      let monthKey = 'Unknown';
      if (t.DATE) {
        const [year, month] = String(t.DATE).split('T')[0].split('-');
        monthKey = `${year}-${month}`; // e.g., "2026-09"
      }

      if (!dataMap[monthKey]) {
        dataMap[monthKey] = { balance: 0, dueAmount: 0, notDueAmount: 0 };
      }
      
      const entry = dataMap[monthKey];
      entry.balance += residual;

      if (residual > 0) return;

      let isNotDue = false;
      if (t.DATE) {
        const [year, month, day] = String(t.DATE).split('T')[0].split('-');
        const invDate = new Date(Number(year), Number(month) - 1, Number(day));
        if (!isNaN(invDate.getTime())) {
          let dueDate = invDate;
          if (paymentTerm > 0) {
            const monthsToAdd = Math.round(paymentTerm / 30);
            dueDate = new Date(invDate.getFullYear(), invDate.getMonth() + monthsToAdd + 1, 1);
          }
          dueDate.setHours(0, 0, 0, 0);
          isNotDue = dueDate.getTime() > today.getTime();
        }
      }

      if (isNotDue) entry.notDueAmount += residual;
    });

    const result = Object.entries(dataMap).map(([month, entry]) => {
      entry.balance = Math.round(entry.balance * 100) / 100;
      let due = entry.balance - entry.notDueAmount;
      if (due > 0 && entry.notDueAmount < 0) {
        const offset = Math.min(due, -entry.notDueAmount);
        entry.notDueAmount += offset;
        due -= offset;
      }
      entry.dueAmount = Math.round(due * 100) / 100;
      entry.notDueAmount = Math.round(entry.notDueAmount * 100) / 100;
      
      // Format month nicely (e.g. "2026-09" -> "September 2026")
      let monthName = month;
      if (month !== 'Unknown') {
        const [y, m] = month.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        if (!isNaN(d.getTime())) {
          monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
      }

      return {
        monthKey: month,
        monthName,
        ...entry
      };
    });

    // Sort by month (newest first)
    result.sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    return result;
  }, [transactions, supplier]);

  const totals = useMemo(() => {
    return monthlyData.reduce((sum, item) => {
      sum.balance += item.balance;
      sum.dueAmount += item.dueAmount;
      sum.notDueAmount += item.notDueAmount;
      return sum;
    }, { balance: 0, dueAmount: 0, notDueAmount: 0 });
  }, [monthlyData]);

  const formatMoney = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Monthly Breakdown</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">{supplier['SUPPLIER NAME'] || supplier['SUPPLIER ID']}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-100 rounded-xl transition-all border border-slate-200 shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-slate-50/30">
          {monthlyData.length === 0 ? (
            <NoData isTable={false} title="NO DATA" message="No transactions found for this supplier." />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-center">
                <thead className="bg-slate-900 text-white text-xs uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-6 py-4 text-center">Month</th>
                    <th className="px-6 py-4 text-center">Total Balance</th>
                    <th className="px-6 py-4 text-center">Due Amount</th>
                    <th className="px-6 py-4 text-center">Not Due Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyData.map((row) => (
                    <tr key={row.monthKey} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700 text-center">{row.monthName}</td>
                      <td className={`px-6 py-4 font-mono font-bold text-center ${row.balance > 0 ? 'text-red-500' : row.balance < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {formatMoney(row.balance)}
                      </td>
                      <td className={`px-6 py-4 font-mono font-bold text-center ${row.dueAmount > 0 ? 'text-red-600' : row.dueAmount < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {formatMoney(row.dueAmount)}
                      </td>
                      <td className={`px-6 py-4 font-mono font-bold text-center ${row.notDueAmount > 0 ? 'text-orange-500' : row.notDueAmount < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {formatMoney(row.notDueAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-6 py-4 text-center font-black uppercase tracking-widest text-[11px] text-slate-800">
                      Total
                    </td>
                    <td className={`px-6 py-4 font-mono font-black text-center ${totals.balance > 0 ? 'text-red-500' : totals.balance < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
                      {formatMoney(totals.balance)}
                    </td>
                    <td className={`px-6 py-4 font-mono font-black text-center ${totals.dueAmount > 0 ? 'text-red-600' : totals.dueAmount < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
                      {formatMoney(totals.dueAmount)}
                    </td>
                    <td className={`px-6 py-4 font-mono font-black text-center ${totals.notDueAmount > 0 ? 'text-orange-500' : totals.notDueAmount < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
                      {formatMoney(totals.notDueAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
