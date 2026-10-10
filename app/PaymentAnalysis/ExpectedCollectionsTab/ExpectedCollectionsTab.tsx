'use client';

import React, { useMemo, useState } from 'react';
import NoData from '../../Components/DataState/NoDataTab';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { Search } from 'lucide-react';
import { parseDate } from '@/app/CustomersAnalysis/DebitInsightsTab/Utils/DateUtils';
import MonthDetailsView from './MonthDetailsView';
import { ExportExcelButton, exportExpectedCollectionsExcel } from '../Export/ExportExcel';

export default function ExpectedCollectionsTab() {
  const { data, loading, error, selectedTags, selectedClasses, selectedCities } = usePaymentAnalysis();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<any>(null);
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  const projectedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthsMap: Record<string, { monthKey: string; monthName: string; totalAmount: number; customers: any[]; sourceMonthsTotals: Record<string, number> }> = {};

    const getOrCreateMonth = (key: string, name: string) => {
      if (!monthsMap[key]) {
        monthsMap[key] = { monthKey: key, monthName: name, totalAmount: 0, customers: [], sourceMonthsTotals: {} };
      }
      return monthsMap[key];
    };

    // Filter data according to global selections
    const filteredRows = data.filter(row => {
      if (selectedTags.length > 0) {
        if (!row.customerTag) return false;
        const rowTags = row.customerTag.split(',').map(t => t.trim()).filter(Boolean);
        if (!rowTags.some(tag => selectedTags.includes(tag))) return false;
      }
      if (selectedClasses.length > 0) {
        if (!row.customerClass) return false;
        if (!selectedClasses.includes(row.customerClass.trim())) return false;
      }
      if (selectedCities.length > 0) {
        if (!row.city) return false;
        if (!selectedCities.includes(row.city.trim())) return false;
      }
      return true;
    });

    const customerMap = new Map<string, any[]>();
    filteredRows.forEach(row => {
      if (!row.customerName) return;
      const existing = customerMap.get(row.customerName) || [];
      existing.push(row);
      customerMap.set(row.customerName, existing);
    });

    customerMap.forEach((invoices, customerName) => {
      const supp = { 
        'CUSTOMER ID': invoices[0]?.customerId || 'Unknown', 
        'CUSTOMER NAME': customerName,
        'PAYMENT TERM': invoices[0]?.paymentTerm || 0,
        'TAG': invoices[0]?.customerTag || '',
        'CITY': invoices[0]?.city || ''
      };

      const matchingTotals = new Map<string, number>();
      const maxDebits = new Map<string, number>();
      const mainInvoiceIndices = new Map<string, number>();

      invoices.forEach((inv, idx) => {
        if (inv.matching) {
          const net = inv.debit - inv.credit;
          matchingTotals.set(inv.matching, (matchingTotals.get(inv.matching) || 0) + net);

          const currentMax = maxDebits.get(inv.matching) ?? -1;
          if (inv.debit > currentMax) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          } else if (!mainInvoiceIndices.has(inv.matching)) {
            maxDebits.set(inv.matching, inv.debit);
            mainInvoiceIndices.set(inv.matching, idx);
          }
        }
      });

      const openInvoices: { amount: number; dueDate: Date; invoiceDate: string | null; include: boolean }[] = [];
      // Payments/credits not matched to an invoice yet — they reduce what is still to be collected
      let unappliedCredit = 0;

      invoices.forEach((inv, idx) => {
        let amountToUse = 0;
        let shouldProcess = false;

        if (!inv.matching) {
          const net = inv.debit - inv.credit;
          if (Math.abs(net) > 0.01) {
            amountToUse = net;
            shouldProcess = true;
          }
        } else {
          if (mainInvoiceIndices.get(inv.matching) === idx) {
            const residual = matchingTotals.get(inv.matching) || 0;
            if (Math.abs(residual) > 0.01) {
              amountToUse = residual;
              shouldProcess = true;
            }
          }
        }

        if (shouldProcess && amountToUse < 0) {
          unappliedCredit += -amountToUse;
          return;
        }

        if (shouldProcess && amountToUse > 0) {
          // Expected month = invoice month + payment term (in months), collected from the 1st of the next month.
          // The term is counted from the INVOICE date; the due date already includes the term,
          // so it is only used when there is no invoice date or no payment term.
          const pt = Number(inv.paymentTerm) || 0;
          const invoiceDate = inv.date ? parseDate(inv.date) : null;
          const dueDateField = inv.dueDate ? parseDate(inv.dueDate) : null;
          let dueDate: Date;
          if (invoiceDate && pt > 0) {
            dueDate = new Date(invoiceDate.getFullYear(), invoiceDate.getMonth() + Math.round(pt / 30) + 1, 1);
          } else if (dueDateField) {
            dueDate = new Date(dueDateField);
          } else if (invoiceDate) {
            dueDate = new Date(invoiceDate);
          } else {
            dueDate = new Date();
          }
          dueDate.setHours(0, 0, 0, 0);

          // If the due date is in the past, consider it due this month to avoid past months in projection
          if (dueDate.getTime() < today.getTime()) {
             dueDate = new Date(today.getFullYear(), today.getMonth(), 1);
          }

          let shouldInclude = true;
          if (inv.date) {
            const invDateObj = parseDate(inv.date);
            if (invDateObj) {
              if (filterFromDate) {
                const fDate = new Date(filterFromDate);
                if (invDateObj < fDate) shouldInclude = false;
              }
              if (filterToDate) {
                const tDate = new Date(filterToDate);
                tDate.setHours(23, 59, 59, 999);
                if (invDateObj > tDate) shouldInclude = false;
              }
            }
          }
          
          // Keep every open invoice so credits are used oldest-first across ALL of them;
          // the invoice-date filter only decides what is shown.
          openInvoices.push({ amount: amountToUse, dueDate, invoiceDate: inv.date || null, include: shouldInclude });
        }
      });

      // Use unapplied credits against the oldest invoices first (same as how they will be matched)
      if (unappliedCredit > 0.01) {
        openInvoices.sort((a, b) => {
          const da = a.invoiceDate ? parseDate(a.invoiceDate)?.getTime() ?? 0 : 0;
          const db = b.invoiceDate ? parseDate(b.invoiceDate)?.getTime() ?? 0 : 0;
          return da - db;
        });
        for (const inv of openInvoices) {
          if (unappliedCredit <= 0.01) break;
          const used = Math.min(inv.amount, unappliedCredit);
          inv.amount -= used;
          unappliedCredit -= used;
        }
      }

      const monthAmounts: Record<string, { amount: number, sourceMonthsAmounts: Record<string, number> }> = {};
      openInvoices.forEach(inv => {
        if (!inv.include || inv.amount <= 0.001) return;
        const y = inv.dueDate.getFullYear();
        const m = String(inv.dueDate.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;
        if (!monthAmounts[key]) monthAmounts[key] = { amount: 0, sourceMonthsAmounts: {} };
        monthAmounts[key].amount += inv.amount;
        
        let mName = 'Unknown';
        if (inv.invoiceDate) {
           const d = parseDate(inv.invoiceDate);
           if (d) {
              mName = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
           }
        }
        monthAmounts[key].sourceMonthsAmounts[mName] = (monthAmounts[key].sourceMonthsAmounts[mName] || 0) + inv.amount;
      });

      Object.keys(monthAmounts).forEach(k => {
        const obj = monthAmounts[k];
        if (obj.amount > 0.001) {
          const [y, m] = k.split('-');
          const date = new Date(Number(y), Number(m) - 1, 1);
          const name = date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          const group = getOrCreateMonth(k, name);
          group.totalAmount += obj.amount;
          
          Object.entries(obj.sourceMonthsAmounts).forEach(([sMonth, sAmt]) => {
              group.sourceMonthsTotals[sMonth] = (group.sourceMonthsTotals[sMonth] || 0) + sAmt;
          });
          
          // Sort source months chronologically
          const sortedMonths = Object.keys(obj.sourceMonthsAmounts).sort((a, b) => {
             if (a === 'Unknown') return 1;
             if (b === 'Unknown') return -1;
             const [m1, y1] = a.split(' ');
             const [m2, y2] = b.split(' ');
             const d1 = new Date(`${m1} 1, 20${y1}`);
             const d2 = new Date(`${m2} 1, 20${y2}`);
             return d1.getTime() - d2.getTime();
          });
          
          group.customers.push({ customer: supp, amount: obj.amount, sourceMonths: sortedMonths.join(', ') });
        }
      });
    });

    Object.values(monthsMap).forEach(group => {
      group.totalAmount = Math.round(group.totalAmount * 100) / 100;
      group.customers.forEach(s => s.amount = Math.round(s.amount * 100) / 100);
      group.customers.sort((a, b) => b.amount - a.amount);
    });

    const result = Object.values(monthsMap).filter(g => g.totalAmount > 0.01);
    result.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return result;
  }, [data, selectedTags, selectedClasses, selectedCities, filterFromDate, filterToDate]);

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

  const exportToExcel = () => exportExpectedCollectionsExcel(projectedData);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <div className="text-red-400 bg-red-400/10 px-6 py-4 rounded-xl border border-red-400/20 font-bold">
          Error: {error}
        </div>
      </div>
    );
  }

  if (selectedMonth) {
    return (
      <MonthDetailsView 
        month={selectedMonth} 
        onBack={() => setSelectedMonth(null)} 
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Expected Collections</h2>
          
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl ml-2 shadow-sm">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Source From:</span>
            <input 
              type="date" 
              value={filterFromDate}
              onChange={(e) => setFilterFromDate(e.target.value)}
              className="text-sm bg-transparent font-medium text-slate-700 focus:outline-none focus:text-indigo-600 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">To:</span>
            <input 
              type="date" 
              value={filterToDate}
              onChange={(e) => setFilterToDate(e.target.value)}
              className="text-sm bg-transparent font-medium text-slate-700 focus:outline-none focus:text-indigo-600 cursor-pointer"
            />
            {(filterFromDate || filterToDate) && (
              <button 
                onClick={() => { setFilterFromDate(''); setFilterToDate(''); }}
                className="ml-2 text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-md"
              >
                CLEAR
              </button>
            )}
          </div>
          
          <ExportExcelButton
            onExport={exportToExcel}
            disabled={projectedData.length === 0}
            title="Export Expected Collections to Excel"
            className="w-9 h-9 !p-0 justify-center rounded-xl"
            label=""
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search months..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* Total Summary */}
      {filteredData.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-center shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] gap-2">
          <span className="font-bold text-slate-500 uppercase tracking-[0.2em] text-sm">Grand Total Expected</span>
          <span className={`font-black text-3xl ${totals > 0 ? 'text-indigo-600' : totals < 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
            {totals.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED
          </span>
        </div>
      )}

      {/* Grid of months */}
      {filteredData.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-12 shadow-sm">
          <NoData title="NO DATA FOUND" message="No expected collections match your criteria." />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {filteredData.map(item => (
            <button
              key={item.monthKey}
              onClick={() => setSelectedMonth(item)}
              className="flex flex-col items-center justify-center bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-xl hover:-translate-y-1 hover:border-indigo-500 transition-all cursor-pointer group gap-4 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 group-hover:bg-indigo-500 transition-colors" />
              <div className="text-slate-400 font-bold uppercase tracking-[0.15em] text-sm group-hover:text-slate-600 transition-colors">
                {item.monthName}
              </div>
              <div className="text-2xl font-black text-slate-800 tracking-tight text-center">
                {item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-xs font-semibold text-slate-400 mt-2 bg-slate-50 px-3 py-1 rounded-full">
                {item.customers.length} Customers
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
