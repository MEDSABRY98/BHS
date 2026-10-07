'use client';

import React, { useMemo, useState } from 'react';
import NoData from '../../Components/DataState/NoDataTab';
import { useSuppliersData } from '../Context/SuppliersDataContext';
import { Search, FileSpreadsheet } from 'lucide-react';
import { exportStyledExcel } from '../../Components/Export/ExcelExport';

import MonthDetailsModal from './Modal/MonthDetailsModal';

export default function ExpectedPaymentsTab() {
  const { suppliers, transactions, loading, error } = useSuppliersData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<any>(null);

  const projectedData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthsMap: Record<string, { monthKey: string; monthName: string; totalAmount: number; suppliers: any[] }> = {};

    const getOrCreateMonth = (key: string, name: string) => {
      if (!monthsMap[key]) {
        monthsMap[key] = { monthKey: key, monthName: name, totalAmount: 0, suppliers: [] };
      }
      return monthsMap[key];
    };

    const supplierTx: Record<string, any[]> = {};
    transactions.forEach(t => {
      if (!t['SUPPLIER ID']) return;
      if (!supplierTx[t['SUPPLIER ID']]) supplierTx[t['SUPPLIER ID']] = [];
      supplierTx[t['SUPPLIER ID']].push(t);
    });

    Object.keys(supplierTx).forEach(suppId => {
      const supp: any = suppliers.find(s => s['SUPPLIER ID'] === suppId) || { 'SUPPLIER ID': suppId, 'SUPPLIER NAME': 'Unknown' };
      const paymentTerm = Number(supp?.['PAYMENT TERM']) || 0;
      
      let unappliedPayments = 0;
      let invoices: { amount: number, dueDate: Date }[] = [];

      supplierTx[suppId].forEach(t => {
        const residual = Number(t['RESIDUAL AMOUNT']) || 0;
        if (residual === 0) return;

        if (residual > 0) {
          unappliedPayments += residual;
        } else {
          let dueDate = new Date();
          if (t.DATE) {
            const [year, month, day] = String(t.DATE).split('T')[0].split('-');
            const invDate = new Date(Number(year), Number(month) - 1, Number(day));
            if (!isNaN(invDate.getTime())) {
              dueDate = invDate;
              const monthsToAdd = Math.round(paymentTerm / 30);
              dueDate = new Date(invDate.getFullYear(), invDate.getMonth() + monthsToAdd + 1, 1);
              dueDate.setHours(0, 0, 0, 0);
            }
          }
          invoices.push({ amount: -residual, dueDate });
        }
      });

      invoices.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

      for (const inv of invoices) {
        if (unappliedPayments > 0) {
          if (unappliedPayments >= inv.amount) {
            unappliedPayments -= inv.amount;
            inv.amount = 0;
          } else {
            inv.amount -= unappliedPayments;
            unappliedPayments = 0;
          }
        }
      }

      const monthAmounts: Record<string, number> = {};

      invoices.forEach(inv => {
        if (inv.amount <= 0) return;
        
        const y = inv.dueDate.getFullYear();
        const m = String(inv.dueDate.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;
        monthAmounts[key] = (monthAmounts[key] || 0) + inv.amount;
      });

      Object.keys(monthAmounts).forEach(k => {
        const amt = monthAmounts[k];
        if (amt > 0.001) {
          const [y, m] = k.split('-');
          const date = new Date(Number(y), Number(m) - 1, 1);
          const name = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          const group = getOrCreateMonth(k, name);
          group.totalAmount += amt;
          group.suppliers.push({ supplier: supp, amount: amt });
        }
      });
    });

    Object.values(monthsMap).forEach(group => {
      group.totalAmount = Math.round(group.totalAmount * 100) / 100;
      group.suppliers.forEach(s => s.amount = Math.round(s.amount * 100) / 100);
      group.suppliers.sort((a, b) => b.amount - a.amount);
    });

    const result = Object.values(monthsMap).filter(g => g.totalAmount > 0.01);
    result.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return result;
  }, [transactions, suppliers]);

  const filteredData = useMemo(() => {
    let list = projectedData;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(item => item.monthName.toLowerCase().includes(lower));
    }
    return list;
  }, [projectedData, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + item.totalAmount, 0);
  }, [filteredData]);



  const exportToExcel = async () => {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const rows: Record<string, unknown>[] = [];
    
    projectedData.forEach(month => {
       month.suppliers.forEach(s => {
          rows.push({
             'Month': month.monthName,
             'Supplier ID': s.supplier['SUPPLIER ID'],
             'Supplier Name': s.supplier['SUPPLIER NAME'] || 'Unknown',
             'Payment Term': `${Number(s.supplier['PAYMENT TERM']) || 0} Days`,
             'Amount Due': round2(s.amount),
          });
       });
    });

    if (rows.length === 0) return;
    
    const date = new Date().toISOString().split('T')[0];
    await exportStyledExcel(rows, `Expected_Payments_${date}`, {
      sheetName: 'Expected Payments',
      columnWidth: 20,
      numericColumns: ['Amount Due'],
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="text-red-400 bg-red-400/10 px-6 py-4 rounded-xl border border-red-400/20 font-bold">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Expected Payments</h2>
          <button
            type="button"
            onClick={exportToExcel}
            title="Export Detailed Excel"
            className="flex items-center justify-center w-9 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search months..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Total Summary */}
      {filteredData.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] gap-2">
          <span className="font-bold text-slate-500 uppercase tracking-[0.2em] text-sm">Grand Total Expected</span>
          <span className={`font-black text-3xl ${totals > 0 ? 'text-red-600' : totals < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
            {totals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
          </span>
        </div>
      )}

      {/* Grid of months */}
      {filteredData.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-12 shadow-sm">
          <NoData title="NO DATA FOUND" message="No expected payments match your criteria." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {filteredData.map(item => (
            <button
              key={item.monthKey}
              onClick={() => setSelectedMonth(item)}
              className="flex flex-col items-center justify-center bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1 hover:border-[#D4AF37] transition-all cursor-pointer group gap-4 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 group-hover:bg-[#D4AF37] transition-colors" />
              <div className="text-slate-400 font-bold uppercase tracking-[0.15em] text-sm group-hover:text-slate-600 transition-colors">
                {item.monthName}
              </div>
              <div className={`text-2xl font-black tracking-tight ${item.totalAmount > 0 ? 'text-red-500' : item.totalAmount < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
                {item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedMonth && (
        <MonthDetailsModal 
          month={selectedMonth} 
          onClose={() => setSelectedMonth(null)} 
        />
      )}
    </div>
  );
}
