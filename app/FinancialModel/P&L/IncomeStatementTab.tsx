import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, FileSpreadsheet } from 'lucide-react';
import DataLoader from '@/app/Components/Loading/DataLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { fetchAccounts, fetchEntriesByYear, FinancialAccount, FinancialEntry } from '../Service/FinancialService';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function IncomeStatementTab() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(12);
  const [viewMode, setViewMode] = useState<'ACTUAL' | 'FORECAST' | 'BOTH'>('ACTUAL');
  
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [accs, yrEntries] = await Promise.all([
        fetchAccounts(),
        fetchEntriesByYear(selectedYear)
      ]);
      
      accs.sort((a, b) => a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME));
      setAccounts(accs);
      setEntries(yrEntries);
    } catch (error) {
      console.error('Failed to load income statement data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAmount = (accountId: string, month: number, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const entry = entries.find(e => e.ACCOUNT_ID === accountId && e.PERIOD_MONTH === month);
    if (!entry) return 0;
    const mode = modeOverride || (viewMode === 'BOTH' ? 'ACTUAL' : viewMode);
    return mode === 'ACTUAL' ? entry.ACTUAL_AMOUNT : entry.FORECAST_AMOUNT;
  };

  const calculateRowTotal = (accountId: string, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    let total = 0;
    for (let m = startMonth; m <= endMonth; m++) total += getAmount(accountId, m, modeOverride);
    return total;
  };

  const calculateSectionTotal = (type: string, month: number, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const sectionAccounts = accounts.filter(a => a.ACCOUNT_TYPE === type);
    return sectionAccounts.reduce((sum, acc) => sum + getAmount(acc.ID, month, modeOverride), 0);
  };

  const calculateSectionYearTotal = (type: string, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const sectionAccounts = accounts.filter(a => a.ACCOUNT_TYPE === type);
    return sectionAccounts.reduce((sum, acc) => sum + calculateRowTotal(acc.ID, modeOverride), 0);
  };

  // Rendering Helpers
  const accentColor = (type: 'REVENUE' | 'COGS' | 'DIRECT_EXPENSE' | 'INDIRECT_EXPENSE' | 'EXPENSE' | 'DEPRECIATION' | 'TAXES' | string) => {
    switch (type) {
      case 'REVENUE': return 'border-l-4 border-emerald-400';
      case 'COGS': return 'border-l-4 border-red-400';
      case 'DIRECT_EXPENSE':
      case 'INDIRECT_EXPENSE':
      case 'EXPENSE': return 'border-l-4 border-orange-400';
      case 'DEPRECIATION': return 'border-l-4 border-slate-400';
      case 'TAXES': return 'border-l-4 border-purple-400';
      default: return 'border-l-4 border-slate-200';
    }
  };

  const renderSectionPill = (key: string, label: string, pillColor: string) => (
    <tr key={key}>
      <td colSpan={14} className="pt-5 pb-1 px-4 bg-white">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${pillColor}`}>
            {label}
          </span>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
      </td>
    </tr>
  );

  const renderRowInner = (acc: FinancialAccount, mode: 'ACTUAL' | 'FORECAST', accType: string, isSubRow = false) => (
    <tr key={`${acc.ID}-${mode}`} className={`hover:bg-slate-50/80 transition-colors group border-b border-slate-100 ${accentColor(accType)} ${isSubRow ? 'bg-slate-50/30' : 'bg-white'}`}>
      <td className={`pl-4 pr-4 py-3 text-sm font-bold text-slate-700 min-w-[300px] sticky left-0 z-10 shadow-[1px_0_0_0_#f1f5f9] text-center ${isSubRow ? 'bg-slate-50/30' : 'bg-white'} group-hover:bg-slate-50/80`}>
        {acc.ACCOUNT_NAME} {viewMode === 'BOTH' ? (mode === 'FORECAST' ? <span className="text-blue-400 text-[10px] font-black ml-1">(F)</span> : <span className="text-emerald-400 text-[10px] font-black ml-1">(A)</span>) : ''}
      </td>
      {MONTHS.slice(startMonth - 1, endMonth).map((_, i) => {
        const monthIndex = startMonth + i;
        const val = getAmount(acc.ID, monthIndex, mode);
        return (
          <td key={monthIndex} className={`px-3 py-3 text-sm text-center tabular-nums whitespace-nowrap ${mode === 'FORECAST' ? 'text-blue-500' : 'text-slate-700'}`}>
            {val === 0 ? <span className="text-slate-300">–</span> : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        );
      })}
      <td className={`px-4 py-3 text-sm font-black text-center tabular-nums whitespace-nowrap sticky right-0 shadow-[-1px_0_0_0_#f1f5f9] ${mode === 'FORECAST' ? 'text-blue-600 bg-blue-50/40' : 'text-slate-800 bg-slate-50'}`}>
        {calculateRowTotal(acc.ID, mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  );

  const renderRow = (acc: FinancialAccount, accType: string) => {
    if (viewMode === 'BOTH') {
      return (
        <React.Fragment key={acc.ID}>
          {renderRowInner(acc, 'FORECAST', accType)}
          {renderRowInner(acc, 'ACTUAL', accType, true)}
        </React.Fragment>
      );
    }
    return renderRowInner(acc, viewMode, accType);
  };

  const renderSectionTotalInner = (label: string, type: string, textColor: string, bgColor: string, borderColor: string, mode: 'ACTUAL' | 'FORECAST', isSubRow = false) => (
    <tr key={`total-${type}-${mode}`} className={`${accentColor(type)} border-b border-slate-200 ${bgColor}`}>
      <td className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] bg-inherit text-center min-w-[300px] ${textColor}`}>
        Total {label} {viewMode === 'BOTH' ? (mode === 'FORECAST' ? '(F)' : '(A)') : ''}
      </td>
      {MONTHS.slice(startMonth - 1, endMonth).map((_, i) => {
        const monthIndex = startMonth + i;
        return (
          <td key={monthIndex} className={`px-3 py-2.5 text-xs font-bold text-center tabular-nums whitespace-nowrap ${textColor}`}>
            {calculateSectionTotal(type, monthIndex, mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        );
      })}
      <td className={`px-4 py-2.5 text-xs font-black text-center tabular-nums shadow-[-1px_0_0_0_#e2e8f0] whitespace-nowrap sticky right-0 ${textColor} bg-inherit`}>
        {calculateSectionYearTotal(type, mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  );

  const renderSectionTotal = (label: string, type: string, textColor: string, bgColor: string, borderColor: string) => {
    if (viewMode === 'BOTH') {
      return (
        <React.Fragment key={`tot-${type}`}>
          {renderSectionTotalInner(label, type, textColor, bgColor, borderColor, 'FORECAST')}
          {renderSectionTotalInner(label, type, textColor, bgColor, borderColor, 'ACTUAL', true)}
        </React.Fragment>
      );
    }
    return renderSectionTotalInner(label, type, textColor, bgColor, borderColor, viewMode);
  };

  const renderProfitRowInner = (label: string, calculateMonth: (month: number, mode: 'ACTUAL'|'FORECAST') => number, calculateYear: (mode: 'ACTUAL'|'FORECAST') => number, isNet: boolean = false, mode: 'ACTUAL'|'FORECAST') => (
    <tr key={`${label}-${mode}`} className={`${isNet ? 'bg-[#0f0f0f] text-white border-t-4 border-[#D4AF37]' : 'bg-slate-100 text-slate-800 border-t-2 border-slate-300'}`}>
      <td className={`px-4 py-4 text-sm font-black uppercase tracking-wider sticky left-0 z-10 text-center min-w-[300px] ${isNet ? 'bg-[#0f0f0f] shadow-[1px_0_0_0_#000]' : 'bg-slate-100 shadow-[1px_0_0_0_#cbd5e1]'}`}>
        {label} {viewMode === 'BOTH' ? (mode === 'FORECAST' ? '(F)' : '(A)') : ''}
      </td>
      {MONTHS.slice(startMonth - 1, endMonth).map((_, i) => {
        const monthIndex = startMonth + i;
        const val = calculateMonth(monthIndex, mode);
        return (
          <td key={monthIndex} className={`px-3 py-4 text-sm font-bold text-center tabular-nums whitespace-nowrap ${isNet ? (val < 0 ? 'text-red-400' : 'text-[#D4AF37]') : ''}`}>
            {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        );
      })}
      <td className={`px-4 py-4 text-sm font-black text-center tabular-nums whitespace-nowrap sticky right-0 ${isNet ? 'bg-[#1a1a1a] shadow-[-1px_0_0_0_#000]' : 'bg-slate-200 shadow-[-1px_0_0_0_#cbd5e1]'}`}>
        {calculateYear(mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  );

  const renderProfitRow = (label: string, calculateMonth: (month: number, mode: 'ACTUAL'|'FORECAST') => number, calculateYear: (mode: 'ACTUAL'|'FORECAST') => number, isNet: boolean = false) => {
    if (viewMode === 'BOTH') {
      return (
        <React.Fragment key={`profit-${label}`}>
          {renderProfitRowInner(label, calculateMonth, calculateYear, isNet, 'FORECAST')}
          {renderProfitRowInner(label, calculateMonth, calculateYear, isNet, 'ACTUAL')}
        </React.Fragment>
      );
    }
    return renderProfitRowInner(label, calculateMonth, calculateYear, isNet, viewMode);
  };

  const renderMarginRowInner = (label: string, calculateMonthVal: (month: number, mode: 'ACTUAL'|'FORECAST') => number, calculateMonthRev: (month: number, mode: 'ACTUAL'|'FORECAST') => number, calculateYearVal: (mode: 'ACTUAL'|'FORECAST') => number, calculateYearRev: (mode: 'ACTUAL'|'FORECAST') => number, isNet: boolean, mode: 'ACTUAL'|'FORECAST') => (
    <tr key={`margin-${label}-${mode}`} className={isNet ? 'bg-[#1a1a1a] border-t border-[#D4AF37]/30' : 'bg-slate-100 border-t border-slate-200'}>
      <td className={`px-4 py-3 text-sm font-black uppercase tracking-wider sticky left-0 z-10 text-center min-w-[300px] italic ${isNet ? 'bg-[#1a1a1a] text-[#D4AF37]/80 shadow-[1px_0_0_0_#000]' : 'bg-slate-100 text-slate-500 shadow-[1px_0_0_0_#cbd5e1]'}`}>
        {label} {viewMode === 'BOTH' ? (mode === 'FORECAST' ? '(F)' : '(A)') : ''}
      </td>
      {MONTHS.slice(startMonth - 1, endMonth).map((_, i) => {
        const monthIndex = startMonth + i;
        const val = calculateMonthVal(monthIndex, mode);
        const rev = calculateMonthRev(monthIndex, mode);
        const margin = rev === 0 ? 0 : (val / rev) * 100;
        return (
          <td key={monthIndex} className={`px-3 py-3 text-sm font-bold text-center tabular-nums whitespace-nowrap italic ${isNet ? 'text-[#D4AF37]/80' : 'text-slate-500'}`}>
            {margin.toFixed(1)}%
          </td>
        );
      })}
      <td className={`px-4 py-3 text-sm font-black text-center tabular-nums whitespace-nowrap sticky right-0 italic ${isNet ? 'bg-[#222] text-[#D4AF37] shadow-[-1px_0_0_0_#000]' : 'bg-slate-200 text-slate-600 shadow-[-1px_0_0_0_#cbd5e1]'}`}>
        {(calculateYearRev(mode) === 0 ? 0 : (calculateYearVal(mode) / calculateYearRev(mode)) * 100).toFixed(1)}%
      </td>
    </tr>
  );

  const renderMarginRow = (label: string, calculateMonthVal: (month: number, mode: 'ACTUAL'|'FORECAST') => number, calculateMonthRev: (month: number, mode: 'ACTUAL'|'FORECAST') => number, calculateYearVal: (mode: 'ACTUAL'|'FORECAST') => number, calculateYearRev: (mode: 'ACTUAL'|'FORECAST') => number, isNet = false) => {
    if (viewMode === 'BOTH') {
      return (
        <React.Fragment key={`margin-grp-${label}`}>
          {renderMarginRowInner(label, calculateMonthVal, calculateMonthRev, calculateYearVal, calculateYearRev, isNet, 'FORECAST')}
          {renderMarginRowInner(label, calculateMonthVal, calculateMonthRev, calculateYearVal, calculateYearRev, isNet, 'ACTUAL')}
        </React.Fragment>
      );
    }
    return renderMarginRowInner(label, calculateMonthVal, calculateMonthRev, calculateYearVal, calculateYearRev, isNet, viewMode);
  };

  const renderSpacer = (key: string) => (
    <tr key={key}>
      <td colSpan={14} className="h-3 bg-white border-0"></td>
    </tr>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Dark Header */}
      <div className="bg-[#0f0f0f] rounded-3xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">P&L</h1>
            <div className="h-0.5 w-16 bg-[#D4AF37] mt-1 rounded-full" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle View Mode */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('ACTUAL')}
              className={`w-24 px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'ACTUAL' ? 'bg-emerald-500 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            >
              Actuals
            </button>
            <button
              onClick={() => setViewMode('FORECAST')}
              className={`w-24 px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'FORECAST' ? 'bg-blue-500 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            >
              Forecast
            </button>
            <button
              onClick={() => setViewMode('BOTH')}
              className={`w-24 px-4 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'BOTH' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            >
              Both
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="number" min={1} max={12} placeholder="MM"
                className="w-20 pl-8 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-center font-black text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/30"
                value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}
              />
              <Calendar className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <span className="text-white/30 font-bold text-sm">To</span>
            <div className="relative">
              <input
                type="number" min={1} max={12} placeholder="MM"
                className="w-20 pl-8 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-center font-black text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/30"
                value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}
              />
              <Calendar className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
            <span className="text-white/20 font-light text-xl mx-1">/</span>
            <input
              type="number" min={2000} max={2100} placeholder="YYYY"
              className="w-24 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-center font-black text-white focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none placeholder:text-white/30"
              value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
      
      {isLoading ? (
        <DataLoader message="" className="min-h-[500px]" />
      ) : accounts.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto no-scrollbar border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0f0f0f]">
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-wider text-slate-300 sticky left-0 bg-[#0f0f0f] z-20 shadow-[1px_0_0_0_#222] text-center min-w-[300px]">
                    Account
                  </th>
                  {MONTHS.slice(startMonth - 1, endMonth).map((m, i) => (
                    <th key={m} className="px-3 py-4 text-xs font-black uppercase tracking-wider text-slate-300 text-center min-w-[100px]">
                      {m}
                    </th>
                  ))}
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-wider text-[#D4AF37] text-center sticky right-0 bg-[#0f0f0f] z-20 shadow-[-1px_0_0_0_#222]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {/* REVENUES */}
                {renderSectionPill('pill-rev', 'Revenues', 'bg-emerald-50 text-emerald-700')}
                {accounts.filter(a => a.ACCOUNT_TYPE === 'REVENUE').map(acc => renderRow(acc, 'REVENUE'))}
                {renderSectionTotal('Revenues', 'REVENUE', 'text-emerald-800', 'bg-emerald-50/60', 'border-emerald-200')}
                {renderSpacer('spacer-rev')}

                {/* COGS */}
                {renderSectionPill('pill-cogs', 'Cost of Goods Sold (COGS)', 'bg-red-50 text-red-700')}
                {accounts.filter(a => a.ACCOUNT_TYPE === 'COGS').map(acc => renderRow(acc, 'COGS'))}
                {renderSectionTotal('COGS', 'COGS', 'text-red-800', 'bg-red-50/60', 'border-red-200')}

                {/* GROSS PROFIT */}
                {renderProfitRow(
                  'Gross Profit',
                  (m, mode) => calculateSectionTotal('REVENUE', m, mode) - calculateSectionTotal('COGS', m, mode),
                  (mode) => calculateSectionYearTotal('REVENUE', mode) - calculateSectionYearTotal('COGS', mode)
                )}
                {renderMarginRow(
                  'Gross Profit Margin',
                  (m, mode) => calculateSectionTotal('REVENUE', m, mode) - calculateSectionTotal('COGS', m, mode),
                  (m, mode) => calculateSectionTotal('REVENUE', m, mode),
                  (mode) => calculateSectionYearTotal('REVENUE', mode) - calculateSectionYearTotal('COGS', mode),
                  (mode) => calculateSectionYearTotal('REVENUE', mode)
                )}
                {renderSpacer('spacer-gp')}

                {/* EXPENSES */}
                {renderSectionPill('pill-exp', 'Expenses', 'bg-orange-50 text-orange-700')}
                {accounts.filter(a => a.ACCOUNT_TYPE === 'EXPENSE').map(acc => renderRow(acc, 'EXPENSE'))}
                {renderSectionTotal('Expenses', 'EXPENSE', 'text-orange-800', 'bg-orange-50/60', 'border-orange-200')}
                {renderSpacer('spacer-exp')}

                {/* EBITDA */}
                {renderProfitRow(
                  'EBITDA',
                  (m, mode) => (calculateSectionTotal('REVENUE', m, mode) - calculateSectionTotal('COGS', m, mode)) - calculateSectionTotal('EXPENSE', m, mode),
                  (mode) => (calculateSectionYearTotal('REVENUE', mode) - calculateSectionYearTotal('COGS', mode)) - calculateSectionYearTotal('EXPENSE', mode),
                  false
                )}
                {renderSpacer('spacer-ebitda')}

                {/* DEPRECIATION */}
                {renderSectionPill('pill-dep', 'Depreciation', 'bg-slate-100 text-slate-600')}
                {accounts.filter(a => a.ACCOUNT_TYPE === 'DEPRECIATION').map(acc => renderRow(acc, 'DEPRECIATION'))}
                {renderSectionTotal('Depreciation', 'DEPRECIATION', 'text-slate-700', 'bg-slate-50/80', 'border-slate-200')}
                {renderSpacer('spacer-dep')}

                {/* EBIT */}
                {renderProfitRow(
                  'EBIT (Operating Profit)',
                  (m, mode) => (calculateSectionTotal('REVENUE', m, mode) - calculateSectionTotal('COGS', m, mode)) - calculateSectionTotal('EXPENSE', m, mode) - calculateSectionTotal('DEPRECIATION', m, mode),
                  (mode) => (calculateSectionYearTotal('REVENUE', mode) - calculateSectionYearTotal('COGS', mode)) - calculateSectionYearTotal('EXPENSE', mode) - calculateSectionYearTotal('DEPRECIATION', mode),
                  false
                )}
                {renderSpacer('spacer-ebit')}

                {/* TAXES */}
                {renderSectionPill('pill-tax', 'Taxes', 'bg-purple-50 text-purple-700')}
                {accounts.filter(a => a.ACCOUNT_TYPE === 'TAXES').map(acc => renderRow(acc, 'TAXES'))}
                {renderSectionTotal('Taxes', 'TAXES', 'text-purple-800', 'bg-purple-50/60', 'border-purple-200')}
                {renderSpacer('spacer-tax')}

                {/* NET PROFIT */}
                {renderProfitRow(
                  'Net Profit',
                  (m, mode) => (calculateSectionTotal('REVENUE', m, mode) - calculateSectionTotal('COGS', m, mode)) - calculateSectionTotal('EXPENSE', m, mode) - calculateSectionTotal('DEPRECIATION', m, mode) - calculateSectionTotal('TAXES', m, mode),
                  (mode) => (calculateSectionYearTotal('REVENUE', mode) - calculateSectionYearTotal('COGS', mode)) - calculateSectionYearTotal('EXPENSE', mode) - calculateSectionYearTotal('DEPRECIATION', mode) - calculateSectionYearTotal('TAXES', mode),
                  true
                )}
                {renderMarginRow(
                  'Net Profit Margin',
                  (m, mode) => (calculateSectionTotal('REVENUE', m, mode) - calculateSectionTotal('COGS', m, mode)) - calculateSectionTotal('DIRECT_EXPENSE', m, mode) - calculateSectionTotal('INDIRECT_EXPENSE', m, mode) - calculateSectionTotal('EXPENSE', m, mode) - calculateSectionTotal('DEPRECIATION', m, mode) - calculateSectionTotal('TAXES', m, mode),
                  (m, mode) => calculateSectionTotal('REVENUE', m, mode),
                  (mode) => (calculateSectionYearTotal('REVENUE', mode) - calculateSectionYearTotal('COGS', mode)) - calculateSectionYearTotal('DIRECT_EXPENSE', mode) - calculateSectionYearTotal('INDIRECT_EXPENSE', mode) - calculateSectionYearTotal('EXPENSE', mode) - calculateSectionYearTotal('DEPRECIATION', mode) - calculateSectionYearTotal('TAXES', mode),
                  (mode) => calculateSectionYearTotal('REVENUE', mode),
                  true
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
