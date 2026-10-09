import React, { useState, useEffect, useMemo } from 'react';
import { Target, Download, Loader2, FileSpreadsheet, X } from 'lucide-react';
import DataLoader from '@/app/Components/Loading/DataLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { fetchAccounts, fetchEntriesByYear, FinancialAccount, FinancialEntry } from '../Service/FinancialService';
import { useFinancialModel } from '../Context/FinancialModelContext';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BreakEvenPointTab() {
  const { selectedYear, startMonth, endMonth } = useFinancialModel();
  const [viewMode, setViewMode] = useState<'ACTUAL' | 'FORECAST' | 'BOTH'>('ACTUAL');
  const [displayFormat, setDisplayFormat] = useState<'NUMBERS' | 'PERCENTAGE'>('NUMBERS');
  const [detailsModal, setDetailsModal] = useState<{
    isOpen: boolean;
    type: 'VARIABLE' | 'FIXED' | null;
    month: number | 'TOTAL';
    mode: 'ACTUAL' | 'FORECAST';
  }>({
    isOpen: false,
    type: null,
    month: 'TOTAL',
    mode: 'ACTUAL'
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);

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
        fetchAccounts(),
        fetchEntriesByYear(selectedYear)
      ]);
      setAccounts(accs);
      setEntries(yrEntries);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      if (!silent) setIsLoading(false);
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

  // Calculations
  const getRevMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => calculateSectionTotal('REVENUE', m, mode);
  const getRevYear = (mode: 'ACTUAL'|'FORECAST') => calculateSectionYearTotal('REVENUE', mode);

  const getVarCostsMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => 
    calculateSectionTotal('COGS', m, mode) + calculateSectionTotal('DIRECT_EXPENSE', m, mode);
  
  const getVarCostsYear = (mode: 'ACTUAL'|'FORECAST') => 
    calculateSectionYearTotal('COGS', mode) + calculateSectionYearTotal('DIRECT_EXPENSE', mode);

  const getContributionMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => 
    getRevMonth(m, mode) - getVarCostsMonth(m, mode);
  
  const getContributionYear = (mode: 'ACTUAL'|'FORECAST') => 
    getRevYear(mode) - getVarCostsYear(mode);

  const getFixedCostsMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => 
    calculateSectionTotal('INDIRECT_EXPENSE', m, mode) + calculateSectionTotal('DEPRECIATION', m, mode) + calculateSectionTotal('FINANCE_COST', m, mode);
  
  const getFixedCostsYear = (mode: 'ACTUAL'|'FORECAST') => 
    calculateSectionYearTotal('INDIRECT_EXPENSE', mode) + calculateSectionYearTotal('DEPRECIATION', mode) + calculateSectionYearTotal('FINANCE_COST', mode);

  const getBEPMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => {
    // As per user request, Break-Even is treated as Total Costs (assuming all costs are static targets)
    return getVarCostsMonth(m, mode) + getFixedCostsMonth(m, mode);
  };

  const getBEPYear = (mode: 'ACTUAL'|'FORECAST') => {
    return getVarCostsYear(mode) + getFixedCostsYear(mode);
  };

  const getMoSMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => {
    return getRevMonth(m, mode) - getBEPMonth(m, mode);
  };

  const getMoSYear = (mode: 'ACTUAL'|'FORECAST') => {
    return getRevYear(mode) - getBEPYear(mode);
  };

  // Rendering Helpers
  const renderRowInner = (
    label: string, 
    calcM: (m: number, mode: 'ACTUAL'|'FORECAST') => number, 
    calcY: (mode: 'ACTUAL'|'FORECAST') => number, 
    isNet: boolean, 
    mode: 'ACTUAL'|'FORECAST',
    isMargin: boolean = false,
    onClickCell?: (m: number | 'TOTAL', mode: 'ACTUAL'|'FORECAST') => void
  ) => (
    <tr key={`${label}-${mode}`} className={`${isNet ? 'bg-[#0f0f0f] text-white border-t-4 border-[#D4AF37]' : 'bg-slate-50 text-slate-800 border-t border-slate-200'}`}>
      <td 
        onClick={onClickCell ? () => onClickCell('TOTAL', mode) : undefined}
        className={`px-4 py-4 text-sm font-black uppercase tracking-wider sticky left-0 z-10 text-center min-w-[300px] ${isNet ? 'bg-[#0f0f0f] shadow-[1px_0_0_0_#000]' : 'bg-slate-50 shadow-[1px_0_0_0_#cbd5e1]'} ${onClickCell ? 'cursor-pointer hover:bg-slate-200 transition-colors' : ''}`}
      >
        {label} {viewMode === 'BOTH' ? (mode === 'FORECAST' ? '(F)' : '(A)') : ''}
      </td>
      {MONTHS.slice(startMonth - 1, endMonth).map((_, i) => {
        const monthIndex = startMonth + i;
        const val = calcM(monthIndex, mode);
        return (
          <td 
            key={monthIndex} 
            onClick={onClickCell ? () => onClickCell(monthIndex, mode) : undefined}
            className={`px-3 py-4 text-sm font-bold text-center tabular-nums whitespace-nowrap ${isNet ? (val < 0 ? 'text-red-400' : 'text-[#D4AF37]') : ''} ${onClickCell ? 'cursor-pointer hover:bg-slate-200 transition-colors' : ''}`}
          >
            {isMargin ? `${(val * 100).toFixed(1)}%` : (displayFormat === 'PERCENTAGE' && !isMargin ? (getRevMonth(monthIndex, mode) === 0 ? '0.0%' : ((val / getRevMonth(monthIndex, mode)) * 100).toFixed(1) + '%') : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
          </td>
        );
      })}
      <td 
        onClick={onClickCell ? () => onClickCell('TOTAL', mode) : undefined}
        className={`px-4 py-4 text-sm font-black text-center tabular-nums whitespace-nowrap sticky right-0 ${isNet ? 'bg-[#1a1a1a] shadow-[-1px_0_0_0_#000]' : 'bg-slate-100 shadow-[-1px_0_0_0_#cbd5e1]'} ${onClickCell ? 'cursor-pointer hover:bg-slate-200 transition-colors' : ''}`}
      >
        {isMargin ? `${(calcY(mode) * 100).toFixed(1)}%` : (displayFormat === 'PERCENTAGE' && !isMargin ? (getRevYear(mode) === 0 ? '0.0%' : ((calcY(mode) / getRevYear(mode)) * 100).toFixed(1) + '%') : calcY(mode).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
      </td>
    </tr>
  );

  const renderRow = (
    label: string, 
    calcM: (m: number, mode: 'ACTUAL'|'FORECAST') => number, 
    calcY: (mode: 'ACTUAL'|'FORECAST') => number, 
    isNet: boolean = false,
    isMargin: boolean = false,
    onClickCell?: (m: number | 'TOTAL', mode: 'ACTUAL'|'FORECAST') => void
  ) => {
    if (viewMode === 'BOTH') {
      return (
        <React.Fragment key={`row-${label}`}>
          {renderRowInner(label, calcM, calcY, isNet, 'FORECAST', isMargin, onClickCell)}
          {renderRowInner(label, calcM, calcY, isNet, 'ACTUAL', isMargin, onClickCell)}
        </React.Fragment>
      );
    }
    return renderRowInner(label, calcM, calcY, isNet, viewMode, isMargin, onClickCell);
  };

  const renderSpacer = (key: string) => (
    <tr key={key}>
      <td colSpan={14} className="h-4 bg-white border-0"></td>
    </tr>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Dark Header */}
      <div className="bg-[#0f0f0f] rounded-3xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <Target className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Break-Even Point</h1>
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
        </div>
      </div>
      
      {isLoading ? (
        <DataLoader message="" className="min-h-[500px]" />
      ) : accounts.length === 0 ? (
        <NoData />
      ) : (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/60">
          <div className="border border-slate-200 rounded-2xl overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-[#0f0f0f]">
                  <th className="px-4 py-4 text-xs font-black uppercase tracking-wider text-slate-300 sticky left-0 top-0 bg-[#0f0f0f] z-40 shadow-[1px_0_0_0_#222,0_1px_0_0_#222] text-center min-w-[300px]">
                    Metric
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
                {renderRow('Total Revenue', getRevMonth, getRevYear)}
                {renderRow('Variable Costs', getVarCostsMonth, getVarCostsYear, false, false, (m, mode) => setDetailsModal({ isOpen: true, type: 'VARIABLE', month: m, mode }))}
                {renderRow('Contribution Margin', getContributionMonth, getContributionYear, true)}
                {renderRow('Contribution Margin %', 
                  (m, mode) => getRevMonth(m, mode) === 0 ? 0 : getContributionMonth(m, mode) / getRevMonth(m, mode),
                  (mode) => getRevYear(mode) === 0 ? 0 : getContributionYear(mode) / getRevYear(mode),
                  false, true
                )}
                
                {renderSpacer('sp1')}
                {renderRow('Total Fixed Costs', getFixedCostsMonth, getFixedCostsYear, false, false, (m, mode) => setDetailsModal({ isOpen: true, type: 'FIXED', month: m, mode }))}
                {renderSpacer('sp2')}

                {renderRow('Break-Even Revenue', getBEPMonth, getBEPYear, true)}
                
                {renderSpacer('sp3')}
                {renderRow('Sales vs Break-Even ($)', getMoSMonth, getMoSYear)}
                {renderRow('Sales vs Break-Even (%)', 
                  (m, mode) => getRevMonth(m, mode) === 0 ? 0 : getMoSMonth(m, mode) / getRevMonth(m, mode),
                  (mode) => getRevYear(mode) === 0 ? 0 : getMoSYear(mode) / getRevYear(mode),
                  false, true
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#0f0f0f] px-6 py-4 flex items-center justify-between border-b border-white/10">
              <h3 className="text-lg font-black text-white">
                {detailsModal.type === 'VARIABLE' ? 'Variable Costs Breakdown' : 'Fixed Costs Breakdown'} 
                <span className="text-[#D4AF37] ml-2">
                  ({detailsModal.month === 'TOTAL' ? 'Year Total' : MONTHS[(detailsModal.month as number) - 1]} - {detailsModal.mode === 'ACTUAL' ? 'Actual' : 'Forecast'})
                </span>
              </h3>
              <button 
                onClick={() => setDetailsModal({ ...detailsModal, isOpen: false })}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {(() => {
                const targetTypes = detailsModal.type === 'VARIABLE' ? ['COGS', 'DIRECT_EXPENSE'] : ['INDIRECT_EXPENSE', 'DEPRECIATION', 'FINANCE_COST'];
                const targetAccounts = accounts.filter(a => targetTypes.includes(a.ACCOUNT_TYPE));
                const totalVal = detailsModal.type === 'VARIABLE' 
                  ? (detailsModal.month === 'TOTAL' ? getVarCostsYear(detailsModal.mode) : getVarCostsMonth(detailsModal.month as number, detailsModal.mode))
                  : (detailsModal.month === 'TOTAL' ? getFixedCostsYear(detailsModal.mode) : getFixedCostsMonth(detailsModal.month as number, detailsModal.mode));
                
                return (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50">
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 text-center">Expense</th>
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 text-center">Value</th>
                        <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 text-center">% of Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targetAccounts.map(acc => {
                        const val = detailsModal.month === 'TOTAL' ? calculateRowTotal(acc.ID, detailsModal.mode) : getAmount(acc.ID, detailsModal.month as number, detailsModal.mode);
                        if (val === 0) return null;
                        const pct = totalVal === 0 ? 0 : (val / totalVal) * 100;
                        return (
                          <tr key={acc.ID} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-bold text-slate-700 text-center">{acc.ACCOUNT_NAME}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-900 tabular-nums text-center">
                              {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-500 tabular-nums text-center">
                              {pct.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
