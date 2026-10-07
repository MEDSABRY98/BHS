'use client';

import React, { useMemo, useState } from 'react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { getPaymentCategory } from '../Utils/PaymentType';
import { Search, Tags, AlertCircle, Users, UserX } from 'lucide-react';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';

export default function UnpaidCustomersTab() {
  const { data, paymentsData, dateRange, selectedTags, selectedClasses, selectedCities } = usePaymentAnalysis();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'DEFAULT' | 'NO TAGS' | 'TAGS ONLY'>('DEFAULT');

  const unpaidCustomers = useMemo(() => {
    const map = new Map<string, { 
      customerId: string, 
      customerName: string, 
      city: string, 
      balance: number, 
      tags: string[],
      lastPaymentDate: string | null
    }>();

    data.forEach(row => {
      const customerId = row.customerId;
      if (!customerId) return;

      if (selectedTags.length > 0) {
        if (!row.customerTag) return;
        const rowTags = row.customerTag.split(',').map(t => t.trim()).filter(Boolean);
        if (!rowTags.some(tag => selectedTags.includes(tag))) return;
      }

      if (selectedClasses.length > 0) {
        if (!row.customerClass) return;
        if (!selectedClasses.includes(row.customerClass.trim())) return;
      }

      if (selectedCities.length > 0) {
        if (!row.city) return;
        if (!selectedCities.includes(row.city.trim())) return;
      }

      if (!map.has(customerId)) {
        const tags = row.customerTag ? row.customerTag.split(',').map(t => t.trim()).filter(Boolean) : [];
        map.set(customerId, { 
          customerId, 
          customerName: row.customerName || 'Unknown', 
          city: row.city || 'Unknown', 
          balance: 0, 
          tags,
          lastPaymentDate: null
        });
      }

      const entry = map.get(customerId)!;
      entry.balance += (Number(row.debit) || 0) - (Number(row.credit) || 0);

      const category = getInvoiceType(row);
      if (category === 'Payment' && row.date) {
        if (!entry.lastPaymentDate || row.date > entry.lastPaymentDate) {
          entry.lastPaymentDate = row.date;
        }
      }
    });

    const payingCustomerIds = new Set(
      paymentsData
        .filter(r => getPaymentCategory(r) === 'Payment')
        .map(r => r.customerId)
    );

    return Array.from(map.values()).filter(c => {
      if (c.balance <= 1) return false;
      if (payingCustomerIds.has(c.customerId)) return false;
      return true;
    }).sort((a, b) => b.balance - a.balance);

  }, [data, paymentsData, selectedTags, selectedClasses, selectedCities]);

  const filteredData = useMemo(() => {
    let baseData = unpaidCustomers;
    if (viewMode === 'NO TAGS') {
      baseData = baseData.filter(c => c.tags.length === 0);
    } else if (viewMode === 'TAGS ONLY') {
      baseData = baseData.filter(c => c.tags.length > 0);
    }

    if (!searchTerm.trim()) return baseData;
    const q = searchTerm.toLowerCase();
    return baseData.filter(c => 
      c.customerName.toLowerCase().includes(q) || 
      c.customerId.toLowerCase().includes(q)
    );
  }, [unpaidCustomers, searchTerm, viewMode]);

  const payingTags = useMemo(() => {
    const activeTags = new Set<string>();
    paymentsData.forEach(r => {
      if (getPaymentCategory(r) === 'Payment' && r.customerTag) {
        const tags = r.customerTag.split(',').map(t => t.trim()).filter(Boolean);
        tags.forEach(t => activeTags.add(t));
      }
    });
    return activeTags;
  }, [paymentsData]);

  const groupedTags = useMemo(() => {
    if (viewMode !== 'TAGS ONLY') return [];
    
    const groups: Record<string, typeof filteredData> = {};
    filteredData.forEach(c => {
      c.tags.forEach(tag => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(c);
      });
    });

    return Object.keys(groups).sort().map(tag => {
      const rows = groups[tag];
      rows.sort((a, b) => b.balance - a.balance);
      const totalBalance = rows.reduce((sum, r) => sum + r.balance, 0);
      return { tag, rows, totalBalance, hasPaymentsInPeriod: payingTags.has(tag) };
    });
  }, [filteredData, viewMode, payingTags]);

  const renderRow = (row: typeof unpaidCustomers[0]) => (
    <tr key={row.customerId} className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-6 py-4 text-slate-800 font-bold text-center group-hover:text-red-500 transition-colors">
        {row.customerName}
      </td>
      <td className="px-6 py-4 text-slate-500 font-semibold text-center text-sm">
        {row.city}
      </td>
      <td className="px-6 py-4 font-mono font-black text-center text-lg text-slate-900">
        {row.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
      <td className="px-6 py-4 text-center">
        {row.lastPaymentDate ? (
          <div className="flex flex-col items-center justify-center">
            <span className="font-mono font-bold text-slate-700">{row.lastPaymentDate.split('T')[0]}</span>
            {(() => {
              const daysSince = Math.floor((new Date().getTime() - new Date(row.lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24));
              let colorClass = 'text-slate-400';
              if (daysSince > 30) colorClass = 'text-orange-500';
              if (daysSince > 60) colorClass = 'text-red-500';
              return <span className={`text-xs font-bold mt-1 ${colorClass}`}>{daysSince} days ago</span>;
            })()}
          </div>
        ) : (
          <span className="text-red-400 font-bold text-xs uppercase tracking-wider bg-red-50 px-2 py-1 rounded border border-red-100">Never</span>
        )}
      </td>
    </tr>
  );

  return (
    <div className="flex flex-col h-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            Unpaid Customers
          </h2>
          
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setViewMode('DEFAULT')}
              className={`flex justify-center items-center gap-2 w-32 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'DEFAULT' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>All</span>
            </button>
            <button
              onClick={() => setViewMode('NO TAGS')}
              className={`flex justify-center items-center gap-2 w-32 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'NO TAGS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <UserX className="w-4 h-4" />
              <span>No Tags</span>
            </button>
            <button
              onClick={() => setViewMode('TAGS ONLY')}
              className={`flex justify-center items-center gap-2 w-32 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                viewMode === 'TAGS ONLY' ? 'bg-white text-[#D4AF37] shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
            >
              <Tags className="w-4 h-4" />
              <span>By Tag</span>
            </button>
          </div>
        </div>
        
        <div className="relative w-full sm:w-80 xl:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D4AF37] focus:border-[#D4AF37] text-sm font-semibold transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-100 p-6 rounded-2xl flex flex-col justify-center">
          <span className="font-bold text-red-600 uppercase tracking-wider text-xs mb-1">Total Unpaid Balance</span>
          <span className="font-black text-3xl text-red-700">
            {filteredData.reduce((acc, curr) => acc + curr.balance, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl flex flex-col justify-center shadow-lg">
          <span className="font-bold text-slate-300 uppercase tracking-wider text-xs mb-1">Unpaid Customers Count</span>
          <span className="font-black text-3xl text-white">
            {filteredData.length}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-center relative">
            <thead className="text-xs uppercase text-white font-bold tracking-[0.1em] bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-5 whitespace-nowrap">Customer Name</th>
                <th className="px-6 py-5 whitespace-nowrap">City</th>
                <th className="px-6 py-5 whitespace-nowrap">Total Balance</th>
                <th className="px-6 py-5 whitespace-nowrap">Last Payment Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {viewMode === 'TAGS ONLY' ? (
                groupedTags.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-slate-500 font-medium">
                      No unpaid customers found for the selected tags.
                    </td>
                  </tr>
                ) : (
                  groupedTags.map(({ tag, rows, totalBalance, hasPaymentsInPeriod }) => (
                    <React.Fragment key={tag}>
                      <tr className="bg-slate-100">
                        <td colSpan={2} className="px-6 py-3 font-bold text-left pl-6 border-l-4 border-[#D4AF37]">
                          <div className="flex flex-wrap items-center gap-2">
                            <Tags className="w-4 h-4 text-[#D4AF37]" />
                            <span className="text-slate-800 uppercase tracking-widest text-xs">{tag}</span>
                            <span className="text-slate-400 text-xs ml-2">({rows.length})</span>
                            {hasPaymentsInPeriod && (
                              <span className="ml-2 px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Tag Has Payments
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 font-mono font-black text-red-600 text-center">
                          {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-3"></td>
                      </tr>
                      {rows.map(row => renderRow(row))}
                    </React.Fragment>
                  ))
                )
              ) : (
                filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-slate-500 font-medium">
                      No unpaid customers found for the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredData.map(row => renderRow(row))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
