import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, FileSpreadsheet, Download, Loader2, Search, X } from 'lucide-react';
import DataLoader from '@/app/Components/Loading/DataLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { fetchAccounts, fetchEntriesByYear, FinancialAccount, FinancialEntry } from '../Service/FinancialService';
import type { PLExportRow, PLSectionKey } from './Export/PLExcelExport';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function CashFlowStatementTab() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(12);
  const [viewMode, setViewMode] = useState<'ACTUAL' | 'FORECAST' | 'BOTH'>('ACTUAL');
  const [displayFormat, setDisplayFormat] = useState<'NUMBERS' | 'PERCENTAGE'>('NUMBERS');
  
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return accounts;
    const query = searchQuery.toLowerCase().trim();
    return accounts.filter(a => 
      a.ACCOUNT_NAME.toLowerCase().includes(query) ||
      a.ACCOUNT_CODE?.toLowerCase().includes(query) ||
      a.ACCOUNT_CATEGORY?.toLowerCase().includes(query)
    );
  }, [accounts, searchQuery]);

  useEffect(() => {
    loadData();

    const handleRefresh = () => loadData(true);
    window.addEventListener('refresh-financial-model', handleRefresh);
    return () => window.removeEventListener('refresh-financial-model', handleRefresh);
  }, [selectedYear]);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [accs, yrEntries] = await Promise.all([
        fetchAccounts('CF'),
        fetchEntriesByYear(selectedYear, 'CF')
      ]);
      
      accs.sort((a, b) => {
        const orderA = a.ORDER_INDEX || 0;
        const orderB = b.ORDER_INDEX || 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME);
      });
      setAccounts(accs);
      setEntries(yrEntries);
    } catch (error) {
      console.error('Failed to load income statement data:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const getAmount = (accountId: string, month: number, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const entry = entries.find(e => e.ACCOUNT_ID === accountId && e.PERIOD_MONTH === month);
    if (!entry) return 0;
    const mode = modeOverride || (viewMode === 'BOTH' ? 'ACTUAL' : viewMode);
    const amount = mode === 'ACTUAL' ? entry.ACTUAL_AMOUNT : entry.FORECAST_AMOUNT;
    const account = accounts.find(a => a.ID === accountId);
    return account?.CF_DIRECTION === 'OUT' ? -amount : amount;
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

  const getNetCashFlow = (month: number, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    return calculateSectionTotal('OPERATING', month, modeOverride) + 
           calculateSectionTotal('INVESTING', month, modeOverride) + 
           calculateSectionTotal('FINANCING', month, modeOverride);
  };

  const getBalances = (modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const opening = Array(13).fill(0);
    const closing = Array(13).fill(0);
    const mode = modeOverride || (viewMode === 'BOTH' ? 'ACTUAL' : viewMode);
    
    for (let m = startMonth; m <= endMonth; m++) {
      if (m === startMonth) {
        opening[m] = calculateSectionTotal('OPENING_BALANCE', m, modeOverride);
      } else {
        opening[m] = closing[m - 1];
      }
      closing[m] = opening[m] + getNetCashFlow(m, modeOverride);
    }
    return { opening, closing };
  };

  // Rendering Helpers
  const accentColor = (type: string) => {
    switch (type) {
      case 'OPERATING': return 'border-l-4 border-emerald-400';
      case 'INVESTING': return 'border-l-4 border-blue-400';
      case 'FINANCING': return 'border-l-4 border-indigo-400';
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
          <td key={monthIndex} className={`px-4 py-3.5 text-[15px] font-semibold text-center tabular-nums whitespace-nowrap ${mode === 'FORECAST' ? 'text-blue-600' : 'text-slate-800'}`}>
            {val === 0 ? <span className="text-slate-300">–</span> : (displayFormat === 'PERCENTAGE' ? (calculateSectionTotal('REVENUE', monthIndex, mode) === 0 ? '0.0%' : ((val / calculateSectionTotal('REVENUE', monthIndex, mode)) * 100).toFixed(1) + '%') : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
          </td>
        );
      })}
      <td className={`px-4 py-3.5 text-[15px] font-black text-center tabular-nums whitespace-nowrap sticky right-0 shadow-[-1px_0_0_0_#f1f5f9] ${mode === 'FORECAST' ? 'text-blue-600 bg-blue-50/40' : 'text-slate-800 bg-slate-50'}`}>
        {displayFormat === 'PERCENTAGE' ? (calculateSectionYearTotal('REVENUE', mode) === 0 ? '0.0%' : ((calculateRowTotal(acc.ID, mode) / calculateSectionYearTotal('REVENUE', mode)) * 100).toFixed(1) + '%') : calculateRowTotal(acc.ID, mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        const val = calculateSectionTotal(type, monthIndex, mode);
        return (
          <td key={monthIndex} className={`px-4 py-3 text-sm font-black text-center tabular-nums whitespace-nowrap ${textColor}`}>
            {displayFormat === 'PERCENTAGE' ? (calculateSectionTotal('REVENUE', monthIndex, mode) === 0 ? '0.0%' : ((val / calculateSectionTotal('REVENUE', monthIndex, mode)) * 100).toFixed(1) + '%') : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        );
      })}
      <td className={`px-4 py-3 text-sm font-black text-center tabular-nums shadow-[-1px_0_0_0_#e2e8f0] whitespace-nowrap sticky right-0 ${textColor} bg-inherit`}>
        {displayFormat === 'PERCENTAGE' ? (calculateSectionYearTotal('REVENUE', mode) === 0 ? '0.0%' : ((calculateSectionYearTotal(type, mode) / calculateSectionYearTotal('REVENUE', mode)) * 100).toFixed(1) + '%') : calculateSectionYearTotal(type, mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

  const calculateCategoryTotal = (type: string, category: string, month: number, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const sectionAccounts = accounts.filter(a => a.ACCOUNT_TYPE === type && (a.ACCOUNT_CATEGORY?.trim() || 'General') === category);
    return sectionAccounts.reduce((sum, acc) => sum + getAmount(acc.ID, month, modeOverride), 0);
  };

  const calculateCategoryYearTotal = (type: string, category: string, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const sectionAccounts = accounts.filter(a => a.ACCOUNT_TYPE === type && (a.ACCOUNT_CATEGORY?.trim() || 'General') === category);
    return sectionAccounts.reduce((sum, acc) => sum + calculateRowTotal(acc.ID, modeOverride), 0);
  };

  const renderCategoryTotalInner = (category: string, type: string, mode: 'ACTUAL' | 'FORECAST', isSubRow = false) => (
    <tr key={`cat-total-${category}-${mode}`} className={`${accentColor(type)} border-b-2 border-[#D4AF37]/30 bg-[#D4AF37]/[0.06]`}>
      <td className={`px-4 py-2.5 text-[13px] font-black text-slate-700 sticky left-0 z-10 shadow-[1px_0_0_0_#f1f5f9] bg-[#fbf8ee] text-center min-w-[300px]`}>
        <span className="text-[#b8952b] uppercase tracking-wider text-[11px] mr-1">Total</span> {category} {viewMode === 'BOTH' ? (mode === 'FORECAST' ? '(F)' : '(A)') : ''}
      </td>
      {MONTHS.slice(startMonth - 1, endMonth).map((_, i) => {
        const monthIndex = startMonth + i;
        const val = calculateCategoryTotal(type, category, monthIndex, mode);
        return (
          <td key={monthIndex} className="px-4 py-2.5 text-sm font-bold text-center tabular-nums whitespace-nowrap text-slate-800">
            {displayFormat === 'PERCENTAGE' ? (calculateSectionTotal('REVENUE', monthIndex, mode) === 0 ? '0.0%' : ((val / calculateSectionTotal('REVENUE', monthIndex, mode)) * 100).toFixed(1) + '%') : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        );
      })}
      <td className="px-4 py-2.5 text-sm font-black text-center tabular-nums shadow-[-1px_0_0_0_#f1f5f9] whitespace-nowrap sticky right-0 text-slate-900 bg-[#f7f1dc]">
        {displayFormat === 'PERCENTAGE' ? (calculateSectionYearTotal('REVENUE', mode) === 0 ? '0.0%' : ((calculateCategoryYearTotal(type, category, mode) / calculateSectionYearTotal('REVENUE', mode)) * 100).toFixed(1) + '%') : calculateCategoryYearTotal(type, category, mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>
    </tr>
  );

  const renderCategoryTotal = (category: string, type: string) => {
    if (viewMode === 'BOTH') {
      return (
        <React.Fragment key={`cat-tot-${category}`}>
          {renderCategoryTotalInner(category, type, 'FORECAST')}
          {renderCategoryTotalInner(category, type, 'ACTUAL', true)}
        </React.Fragment>
      );
    }
    return renderCategoryTotalInner(category, type, viewMode);
  };

  const renderCashFlowDirection = (typeAccounts: FinancialAccount[], direction: 'IN' | 'OUT', label: string, colorClass: string) => {
    const directionAccounts = typeAccounts.filter(a => direction === 'IN' ? a.CF_DIRECTION !== 'OUT' : a.CF_DIRECTION === 'OUT');
    if (directionAccounts.length === 0) return null;

    return (
      <React.Fragment key={`cf-dir-${label}`}>
        <tr>
          <td colSpan={endMonth - startMonth + 3} className="p-0 bg-slate-50/50 border-y border-slate-100">
            <div className="sticky left-0 inline-flex items-center gap-2.5 px-6 py-2">
              <span className={`w-1.5 h-3.5 rounded-full ${colorClass.split(' ')[0]}`} />
              <span className={`text-[11px] font-black uppercase tracking-widest ${colorClass.split(' ')[1]}`}>{label}</span>
              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">{directionAccounts.length}</span>
            </div>
          </td>
        </tr>
        {directionAccounts.map(acc => renderRow(acc, typeAccounts[0].ACCOUNT_TYPE))}
      </React.Fragment>
    );
  };

  const renderCashFlowSection = (type: string, pillLabel: string, pillClasses: string, totalLabel: string, totalTextClass: string, totalBgClass: string, totalBorderClass: string) => {
    const typeAccounts = filteredAccounts.filter(a => a.ACCOUNT_TYPE === type);
    if (typeAccounts.length === 0) return null;

    return (
      <React.Fragment key={`cf-sec-${type}`}>
        {renderSectionPill(`pill-${type}`, pillLabel, pillClasses)}
        {renderCashFlowDirection(typeAccounts, 'IN', 'Cash Inflows', 'bg-emerald-400 text-emerald-700')}
        {renderCashFlowDirection(typeAccounts, 'OUT', 'Cash Outflows', 'bg-red-400 text-red-700')}
        {renderSectionTotal(totalLabel, type, totalTextClass, totalBgClass, totalBorderClass)}
        {renderSpacer(`spacer-${type}`)}
      </React.Fragment>
    );
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
            {displayFormat === 'PERCENTAGE' ? (calculateSectionTotal('REVENUE', monthIndex, mode) === 0 ? '0.0%' : ((val / calculateSectionTotal('REVENUE', monthIndex, mode)) * 100).toFixed(1) + '%') : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        );
      })}
      <td className={`px-4 py-4 text-sm font-black text-center tabular-nums whitespace-nowrap sticky right-0 ${isNet ? 'bg-[#1a1a1a] shadow-[-1px_0_0_0_#000]' : 'bg-slate-200 shadow-[-1px_0_0_0_#cbd5e1]'}`}>
        {displayFormat === 'PERCENTAGE' ? (calculateSectionYearTotal('REVENUE', mode) === 0 ? '0.0%' : ((calculateYear(mode) / calculateSectionYearTotal('REVENUE', mode)) * 100).toFixed(1) + '%') : calculateYear(mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
    if (displayFormat === 'PERCENTAGE') return null;
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

  // ---------- Excel Export (mirrors the on-screen P&L) ----------
  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const { exportPLToExcel } = await import('./Export/PLExcelExport');
      const isPct = displayFormat === 'PERCENTAGE';
      const modes: ('ACTUAL' | 'FORECAST')[] = viewMode === 'BOTH' ? ['FORECAST', 'ACTUAL'] : [viewMode];
      const sfx = (mode: 'ACTUAL' | 'FORECAST') => (viewMode === 'BOTH' ? (mode === 'FORECAST' ? ' (F)' : ' (A)') : '');
      const months: number[] = [];
      for (let m = startMonth; m <= endMonth; m++) months.push(m);

      const build = (monthFn: (m: number) => number, yearFn: () => number, mode: 'ACTUAL' | 'FORECAST', forcePct = isPct) => {
        const values = months.map(m => {
          const v = monthFn(m);
          if (!forcePct) return v;
          const rev = calculateSectionTotal('REVENUE', m, mode);
          return rev === 0 ? 0 : v / rev;
        });
        const y = yearFn();
        const yRev = calculateSectionYearTotal('REVENUE', mode);
        const total = forcePct ? (yRev === 0 ? 0 : y / yRev) : y;
        return { values, total };
      };

      const rows: PLExportRow[] = [];
      const sectionAccounts = (type: string) => accounts.filter(a => a.ACCOUNT_TYPE === type);

      const pushAccounts = (list: FinancialAccount[], section: PLSectionKey) => {
        list.forEach(acc => modes.forEach(mode => {
          const { values, total } = build(m => getAmount(acc.ID, m, mode), () => calculateRowTotal(acc.ID, mode), mode);
          rows.push({ kind: 'account', label: acc.ACCOUNT_NAME + sfx(mode), section, values, total, isForecast: mode === 'FORECAST', percent: isPct });
        }));
      };

      const spacer = () => rows.push({ kind: 'spacer' });

      // OPENING BALANCE
      modes.forEach(mode => {
        const { values, total } = build(m => getBalances(mode).opening[m], () => getBalances(mode).opening[startMonth], mode);
        rows.push({ kind: 'profit', label: 'Opening Cash Balance' + sfx(mode), values, total, isNet: false, percent: false });
      });
      spacer();

      const pushCFSection = (type: string, label: string) => {
        rows.push({ kind: 'pill', label, section: type });
        
        const inflows = sectionAccounts(type).filter(a => a.CF_DIRECTION !== 'OUT');
        if (inflows.length > 0) {
          rows.push({ kind: 'categoryHeader', label: 'Cash Inflows', section: type, count: inflows.length });
          pushAccounts(inflows, type);
        }
        
        const outflows = sectionAccounts(type).filter(a => a.CF_DIRECTION === 'OUT');
        if (outflows.length > 0) {
          rows.push({ kind: 'categoryHeader', label: 'Cash Outflows', section: type, count: outflows.length });
          pushAccounts(outflows, type);
        }
        
        modes.forEach(mode => {
          const { values, total } = build(m => calculateSectionTotal(type, m, mode), () => calculateSectionYearTotal(type, mode), mode);
          rows.push({ kind: 'sectionTotal', label: `Total ${label}` + sfx(mode), section: type, values, total, percent: false });
        });
        spacer();
      };

      pushCFSection('OPERATING', 'Operating Activities');
      pushCFSection('INVESTING', 'Investing Activities');
      pushCFSection('FINANCING', 'Financing Activities');

      // Net Cash Flow
      modes.forEach(mode => {
        const { values, total } = build(
          m => getNetCashFlow(m, mode),
          () => calculateSectionYearTotal('OPERATING', mode) + calculateSectionYearTotal('INVESTING', mode) + calculateSectionYearTotal('FINANCING', mode),
          mode
        );
        rows.push({ kind: 'profit', label: 'Net Cash Flow' + sfx(mode), values, total, isNet: false, percent: false });
      });
      spacer();

      // CLOSING BALANCE
      modes.forEach(mode => {
        const { values, total } = build(m => getBalances(mode).closing[m], () => getBalances(mode).closing[endMonth], mode);
        rows.push({ kind: 'profit', label: 'Closing Cash Balance' + sfx(mode), values, total, isNet: true, percent: false });
      });

      const modeLabel = viewMode === 'BOTH' ? 'Forecast vs Actual' : viewMode === 'ACTUAL' ? 'Actuals' : 'Forecast';
      const rangeLabel = `${MONTHS[startMonth - 1]} – ${MONTHS[endMonth - 1]} ${selectedYear}`;
      await exportPLToExcel({
        title: 'Cash Flow Statement',
        subtitle: `${rangeLabel}   |   ${modeLabel}`,
        monthLabels: months.map(m => MONTHS[m - 1]),
        rows,
        fileName: `CF_Statement_${selectedYear}_${MONTHS[startMonth - 1]}-${MONTHS[endMonth - 1]}_${viewMode}.xlsx`,
      });
      toast.success('Cash Flow exported successfully');
    } catch (err) {
      console.error(err);
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Dark Header */}
      <div className="bg-[#0f0f0f] rounded-3xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Cash Flow</h1>
            <div className="h-0.5 w-16 bg-[#D4AF37] mt-1 rounded-full" />
          </div>
          <button
            onClick={handleExportExcel}
            disabled={isExporting || isLoading || accounts.length === 0}
            title="Export Cash Flow to Excel"
            className="ml-1 flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-400/40 text-emerald-400 hover:text-emerald-300 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {isExporting ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Download className="w-[18px] h-[18px]" />}
          </button>

          <div className="relative ml-2 w-48 sm:w-64">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search account..."
              className="w-full pl-9 pr-8 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-white/40 hover:text-white/80 transition-colors"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
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

          {/* Toggle Format Mode */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setDisplayFormat('NUMBERS')}
              className={`w-12 px-2 py-2 text-sm font-bold rounded-lg transition-all ${displayFormat === 'NUMBERS' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-white/40 hover:text-white/70'}`}
              title="Numbers"
            >
              $
            </button>
            <button
              onClick={() => setDisplayFormat('PERCENTAGE')}
              className={`w-12 px-2 py-2 text-sm font-bold rounded-lg transition-all ${displayFormat === 'PERCENTAGE' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-white/40 hover:text-white/70'}`}
              title="Percentage"
            >
              %
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
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
          <div className="border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0f0f0f]">
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-wider text-slate-300 sticky left-0 top-0 bg-[#0f0f0f] z-40 shadow-[1px_0_0_0_#222,0_1px_0_0_#222] text-center min-w-[300px]">
                    Account
                  </th>
                  {MONTHS.slice(startMonth - 1, endMonth).map((m, i) => (
                    <th key={m} className="px-3 py-4 text-xs font-black uppercase tracking-wider text-slate-300 text-center min-w-[100px] sticky top-0 bg-[#0f0f0f] z-30 shadow-[0_1px_0_0_#222]">
                      {m}
                    </th>
                  ))}
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-wider text-[#D4AF37] text-center sticky right-0 top-0 bg-[#0f0f0f] z-40 shadow-[-1px_0_0_0_#222,0_1px_0_0_#222]">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {/* OPENING BALANCE */}
                {renderProfitRow(
                  'Opening Cash Balance',
                  (m, mode) => getBalances(mode).opening[m],
                  (mode) => getBalances(mode).opening[startMonth],
                  false
                )}

                {/* OPERATING ACTIVITIES */}
                {renderCashFlowSection('OPERATING', 'Operating Activities', 'bg-emerald-50 text-emerald-700', 'Operating Activities', 'text-emerald-800', 'bg-emerald-50/60', 'border-emerald-200')}

                {/* INVESTING ACTIVITIES */}
                {renderCashFlowSection('INVESTING', 'Investing Activities', 'bg-blue-50 text-blue-700', 'Investing Activities', 'text-blue-800', 'bg-blue-50/60', 'border-blue-200')}

                {/* FINANCING ACTIVITIES */}
                {renderCashFlowSection('FINANCING', 'Financing Activities', 'bg-indigo-50 text-indigo-700', 'Financing Activities', 'text-indigo-800', 'bg-indigo-50/60', 'border-indigo-200')}

                {/* NET CASH FLOW */}
                {renderProfitRow(
                  'Net Cash Flow',
                  (m, mode) => getNetCashFlow(m, mode),
                  (mode) => calculateSectionYearTotal('OPERATING', mode) + calculateSectionYearTotal('INVESTING', mode) + calculateSectionYearTotal('FINANCING', mode),
                  false
                )}

                {/* CLOSING BALANCE */}
                {renderProfitRow(
                  'Closing Cash Balance',
                  (m, mode) => getBalances(mode).closing[m],
                  (mode) => getBalances(mode).closing[endMonth],
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
