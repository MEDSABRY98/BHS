import React, { useState, useEffect, useMemo } from 'react';
import { Target, Download, Loader2, FileSpreadsheet, X } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { toast } from '@/app/Components/Notification';
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
  const [isExporting, setIsExporting] = useState(false);
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

  // ---------------------------------------------------------------------------
  // Cost behaviour
  // Fallback when COST_BEHAVIOR is empty: only COGS is variable; every other
  // expense type is treated as fixed (a "Direct" expense is not variable by default).
  // ---------------------------------------------------------------------------
  const isVariable = (acc: FinancialAccount) => {
    if (acc.ACCOUNT_TYPE === 'REVENUE') return false;
    if (acc.COST_BEHAVIOR === 'VARIABLE') return true;
    if (!acc.COST_BEHAVIOR && acc.ACCOUNT_TYPE === 'COGS') return true;
    return false;
  };

  const isFixed = (acc: FinancialAccount) => {
    if (acc.ACCOUNT_TYPE === 'REVENUE') return false;
    if (acc.COST_BEHAVIOR === 'FIXED') return true;
    if (!acc.COST_BEHAVIOR && ['DIRECT_EXPENSE', 'INDIRECT_EXPENSE', 'DEPRECIATION', 'FINANCE_COST'].includes(acc.ACCOUNT_TYPE)) return true;
    return false;
  };

  // Fast lookup instead of entries.find on every cell
  const entryMap = useMemo(() => {
    const map = new Map<string, FinancialEntry>();
    entries.forEach(e => map.set(`${e.ACCOUNT_ID}|${e.PERIOD_MONTH}`, e));
    return map;
  }, [entries]);

  const rawAmount = (accountId: string, month: number, mode: 'ACTUAL' | 'FORECAST') => {
    const entry = entryMap.get(`${accountId}|${month}`);
    if (!entry) return 0;
    return (mode === 'ACTUAL' ? entry.ACTUAL_AMOUNT : entry.FORECAST_AMOUNT) || 0;
  };

  const revenueAccounts = useMemo(() => accounts.filter(a => a.ACCOUNT_TYPE === 'REVENUE'), [accounts]);

  // COGS is driven by its own revenue stream (Food COGS -> Food Revenues, Non-Food COGS -> Non-Food Revenues).
  // Every other variable cost is driven by total revenue (null).
  const driverMap = useMemo(() => {
    const key = (name: string) =>
      name.toLowerCase().replace(/\b(revenues?|sales|cogs|cost of goods sold|cost of sales)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const map = new Map<string, string | null>();
    accounts.forEach(acc => {
      if (!isVariable(acc)) return;
      let driver: string | null = null;
      if (acc.ACCOUNT_TYPE === 'COGS') {
        const k = key(acc.ACCOUNT_NAME);
        const match = revenueAccounts.find(r => key(r.ACCOUNT_NAME) === k);
        if (match) driver = match.ID;
      }
      map.set(acc.ID, driver);
    });
    return map;
  }, [accounts, revenueAccounts]);

  const driverRevenue = (accountId: string, month: number, mode: 'ACTUAL' | 'FORECAST') => {
    const driver = driverMap.get(accountId);
    if (driver) return rawAmount(driver, month, mode);
    return revenueAccounts.reduce((sum, r) => sum + rawAmount(r.ID, month, mode), 0);
  };

  // Variable cost rate = actual cost / actual driver revenue, using only the months
  // of the year that actually have revenue. null = no actual history for this account.
  const variableRates = useMemo(() => {
    const map = new Map<string, number | null>();
    accounts.filter(isVariable).forEach(acc => {
      let cost = 0;
      let rev = 0;
      for (let m = 1; m <= 12; m++) {
        const r = driverRevenue(acc.ID, m, 'ACTUAL');
        if (r > 0) {
          rev += r;
          cost += rawAmount(acc.ID, m, 'ACTUAL');
        }
      }
      map.set(acc.ID, rev > 0 && cost !== 0 ? cost / rev : null);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, entryMap, driverMap]);

  // ACTUAL   -> booked amount.
  // FORECAST -> the forecast amount you entered always wins.
  //             Only when a variable cost has NO forecast entered for that month,
  //             it is auto-filled as: actual rate x forecast driver revenue.
  const isAutoForecast = (accountId: string, month: number) => {
    const rate = variableRates.get(accountId);
    return rate !== undefined && rate !== null && rawAmount(accountId, month, 'FORECAST') === 0;
  };

  const getAmount = (accountId: string, month: number, modeOverride?: 'ACTUAL' | 'FORECAST') => {
    const mode = modeOverride || (viewMode === 'BOTH' ? 'ACTUAL' : viewMode);
    if (mode === 'FORECAST' && isAutoForecast(accountId, month)) {
      return (variableRates.get(accountId) as number) * driverRevenue(accountId, month, 'FORECAST');
    }
    return rawAmount(accountId, month, mode);
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
    accounts.filter(isVariable).reduce((sum, acc) => sum + getAmount(acc.ID, m, mode), 0);
  
  const getVarCostsYear = (mode: 'ACTUAL'|'FORECAST') => 
    accounts.filter(isVariable).reduce((sum, acc) => sum + calculateRowTotal(acc.ID, mode), 0);

  const getContributionMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => 
    getRevMonth(m, mode) - getVarCostsMonth(m, mode);
  
  const getContributionYear = (mode: 'ACTUAL'|'FORECAST') => 
    getRevYear(mode) - getVarCostsYear(mode);

  const getFixedCostsMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => 
    accounts.filter(isFixed).reduce((sum, acc) => sum + getAmount(acc.ID, m, mode), 0);
  
  const getFixedCostsYear = (mode: 'ACTUAL'|'FORECAST') => 
    accounts.filter(isFixed).reduce((sum, acc) => sum + calculateRowTotal(acc.ID, mode), 0);

  // Historical CM% from actual months that have revenue (used for forecast months
  // that have forecast costs but no forecast revenue yet).
  const actualCmPct = useMemo(() => {
    let rev = 0;
    let cm = 0;
    for (let m = 1; m <= 12; m++) {
      const r = getRevMonth(m, 'ACTUAL');
      if (r > 0) {
        rev += r;
        cm += r - getVarCostsMonth(m, 'ACTUAL');
      }
    }
    return rev > 0 ? cm / rev : NaN;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, entryMap]);

  // CM% used for break-even:
  //  ACTUAL   -> the month's own CM% (negative = real loss -> break-even N/A).
  //  FORECAST -> the forecast's own CM% when it is valid (revenue > 0 and CM% > 0);
  //              otherwise the historical actual CM% so every forecast month still
  //              gets a "required sales" target. Fallback cells are marked with *.
  const cmInfo = (rev: number, cm: number, fixed: number, mode: 'ACTUAL'|'FORECAST') => {
    const own = rev > 0 ? cm / rev : NaN;
    if (Number.isFinite(own) && own > 0) return { pct: own, fallback: false };
    if (mode === 'FORECAST' && (fixed !== 0 || rev > 0) && Number.isFinite(actualCmPct) && actualCmPct > 0) {
      return { pct: actualCmPct, fallback: true };
    }
    return { pct: own, fallback: false };
  };

  const cmInfoMonth = (m: number, mode: 'ACTUAL'|'FORECAST') =>
    cmInfo(getRevMonth(m, mode), getContributionMonth(m, mode), getFixedCostsMonth(m, mode), mode);

  const cmInfoYear = (mode: 'ACTUAL'|'FORECAST') =>
    cmInfo(getRevYear(mode), getContributionYear(mode), getFixedCostsYear(mode), mode);

  const getCmPctMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => cmInfoMonth(m, mode).pct;
  const getCmPctYear = (mode: 'ACTUAL'|'FORECAST') => cmInfoYear(mode).pct;
  const cmFallbackMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => cmInfoMonth(m, mode).fallback;
  const cmFallbackYear = (mode: 'ACTUAL'|'FORECAST') => cmInfoYear(mode).fallback;

  // Break-even = Fixed / CM%. N/A when CM% is missing or zero/negative (unreachable).
  const breakEven = (fixed: number, cmPct: number) =>
    !Number.isFinite(cmPct) || cmPct <= 0 ? NaN : fixed / cmPct;

  const getBEPMonth = (m: number, mode: 'ACTUAL'|'FORECAST') =>
    breakEven(getFixedCostsMonth(m, mode), getCmPctMonth(m, mode));

  const getBEPYear = (mode: 'ACTUAL'|'FORECAST') =>
    breakEven(getFixedCostsYear(mode), getCmPctYear(mode));

  // Margin of safety only makes sense when the month has revenue
  const getMoSMonth = (m: number, mode: 'ACTUAL'|'FORECAST') => {
    const rev = getRevMonth(m, mode);
    return rev <= 0 ? NaN : rev - getBEPMonth(m, mode);
  };

  // Totals only count months that have sales (a month with no sales has no surplus/shortfall)
  const sumFinite = (fn: (m: number) => number) => {
    let total = 0;
    let any = false;
    for (let m = startMonth; m <= endMonth; m++) {
      const v = fn(m);
      if (Number.isFinite(v)) { total += v; any = true; }
    }
    return any ? total : NaN;
  };

  const getMoSYear = (mode: 'ACTUAL'|'FORECAST') => sumFinite(m => getMoSMonth(m, mode));

  // Revenue of the months that actually have a surplus/shortfall figure (for the % total)
  const getMoSRevYear = (mode: 'ACTUAL'|'FORECAST') =>
    sumFinite(m => (Number.isFinite(getMoSMonth(m, mode)) ? getRevMonth(m, mode) : NaN));


  // Rendering Helpers
  const formatCell = (val: number, rev: number, isMargin: boolean) => {
    if (!Number.isFinite(val)) return 'N/A';
    if (Math.abs(val) < 0.005) return '-';
    if (isMargin) return `${(val * 100).toFixed(1)}%`;
    if (displayFormat === 'PERCENTAGE') return rev === 0 ? '0.0%' : ((val / rev) * 100).toFixed(1) + '%';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const renderRowInner = (
    label: string, 
    calcM: (m: number, mode: 'ACTUAL'|'FORECAST') => number, 
    calcY: (mode: 'ACTUAL'|'FORECAST') => number, 
    isNet: boolean, 
    mode: 'ACTUAL'|'FORECAST',
    isMargin: boolean = false,
    onClickCell?: (m: number | 'TOTAL', mode: 'ACTUAL'|'FORECAST') => void,
    flag?: { m: (m: number, mode: 'ACTUAL'|'FORECAST') => boolean; y: (mode: 'ACTUAL'|'FORECAST') => boolean }
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
            className={`px-4 py-4 text-[15px] font-bold text-center tabular-nums whitespace-nowrap ${isNet ? (val < 0 ? 'text-red-400' : 'text-[#D4AF37]') : ''} ${onClickCell ? 'cursor-pointer hover:bg-slate-200 transition-colors' : ''}`}
          >
            {formatCell(val, getRevMonth(monthIndex, mode), isMargin)}
            {flag?.m(monthIndex, mode) && <span title="Based on historical actual CM% (forecast CM% missing or not positive)"> *</span>}
          </td>
        );
      })}
      <td 
        onClick={onClickCell ? () => onClickCell('TOTAL', mode) : undefined}
        className={`px-4 py-4 text-[15px] font-black text-center tabular-nums whitespace-nowrap sticky right-0 ${isNet ? 'bg-[#1a1a1a] shadow-[-1px_0_0_0_#000]' : 'bg-slate-100 shadow-[-1px_0_0_0_#cbd5e1]'} ${onClickCell ? 'cursor-pointer hover:bg-slate-200 transition-colors' : ''}`}
      >
        {formatCell(calcY(mode), getRevYear(mode), isMargin)}
        {flag?.y(mode) && <span title="Based on historical actual CM% (forecast CM% missing or not positive)"> *</span>}
      </td>
    </tr>
  );

  const renderRow = (
    label: string, 
    calcM: (m: number, mode: 'ACTUAL'|'FORECAST') => number, 
    calcY: (mode: 'ACTUAL'|'FORECAST') => number, 
    isNet: boolean = false,
    isMargin: boolean = false,
    onClickCell?: (m: number | 'TOTAL', mode: 'ACTUAL'|'FORECAST') => void,
    flag?: { m: (m: number, mode: 'ACTUAL'|'FORECAST') => boolean; y: (mode: 'ACTUAL'|'FORECAST') => boolean }
  ) => {
    if (viewMode === 'BOTH') {
      return (
        <React.Fragment key={`row-${label}`}>
          {renderRowInner(label, calcM, calcY, isNet, 'FORECAST', isMargin, onClickCell, flag)}
          {renderRowInner(label, calcM, calcY, isNet, 'ACTUAL', isMargin, onClickCell, flag)}
        </React.Fragment>
      );
    }
    return renderRowInner(label, calcM, calcY, isNet, viewMode, isMargin, onClickCell, flag);
  };

  const cmFlag = { m: cmFallbackMonth, y: cmFallbackYear };

  const renderSpacer = (key: string) => (
    <tr key={key}>
      <td colSpan={14} className="h-4 bg-white border-0"></td>
    </tr>
  );

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const { exportBEPToExcel } = await import('./Export/BEPExcelExport');
      const isPct = displayFormat === 'PERCENTAGE';
      const modes: ('ACTUAL' | 'FORECAST')[] = viewMode === 'BOTH' ? ['FORECAST', 'ACTUAL'] : [viewMode];
      const sfx = (mode: 'ACTUAL' | 'FORECAST') => (viewMode === 'BOTH' ? (mode === 'FORECAST' ? ' (F)' : ' (A)') : '');
      const months: number[] = [];
      for (let m = startMonth; m <= endMonth; m++) months.push(m);

      const rows: import('./Export/BEPExcelExport').BEPExportRow[] = [];
      let currentRowIdx = 5; // header ends at 4, data starts at 5
      const getCol = (idx: number) => String.fromCharCode(64 + idx);
      const spacer = () => { rows.push({ kind: 'spacer' }); currentRowIdx++; };

      let revTotalStart = 0; // will hold the row index of "Total Revenue"
      const revRowMap = new Map<string, number>(); // `${revenueAccountId}|${modeIdx}` -> excel row

      const pushAccounts = (list: FinancialAccount[], section: string, isVarCosts = false) => {
        const startIdx = currentRowIdx;
        list.sort((a,b)=>a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME)).forEach(acc => {
          modes.forEach((mode, modeIdx) => {
            if (section === 'REVENUE') revRowMap.set(`${acc.ID}|${modeIdx}`, currentRowIdx);

            // Same rate used on screen: actual cost / actual driver revenue (null = no history)
            const accRate = isVarCosts ? variableRates.get(acc.ID) ?? null : null;
            const rate = accRate === null ? undefined : accRate;

            const values = months.map((m, i) => {
              const val = getAmount(acc.ID, m, mode);
              // FORECAST variable cost with a rate -> live formula: rate x driver revenue
              // (COGS -> its own revenue row, other variable costs -> total revenue row)
              // Only for months where no forecast was entered (entered forecast always wins)
              if (isVarCosts && mode === 'FORECAST' && accRate !== null && revTotalStart > 0 && isAutoForecast(acc.ID, m)) {
                 const col = getCol(i + 3); // months start at column 3 (C)
                 const driverId = driverMap.get(acc.ID);
                 const driverR = (driverId && revRowMap.get(`${driverId}|${modeIdx}`)) || (revTotalStart + modeIdx);
                 return { formula: `$B${currentRowIdx}*${col}${driverR}`, result: val };
              }
              return val;
            });
            const firstCol = getCol(3);
            const lastCol = getCol(months.length + 2);
            const valTotal = calculateRowTotal(acc.ID, mode);
            const total = { formula: `SUM(${firstCol}${currentRowIdx}:${lastCol}${currentRowIdx})`, result: valTotal };
            
            rows.push({ kind: 'account', label: acc.ACCOUNT_NAME + sfx(mode), section, values, total, rate, isForecast: mode === 'FORECAST' });
            currentRowIdx++;
          });
        });
        return startIdx;
      };

      const pushTotalSum = (label: string, section: string, startIdx: number) => {
        modes.forEach((mode, modeIdx) => {
          const values: any[] = months.map((m, i) => {
            const col = getCol(i + 3);
            if (startIdx === currentRowIdx) return 0;
            const cells = [];
            for (let r = startIdx + modeIdx; r < currentRowIdx; r += modes.length) cells.push(`${col}${r}`);
            return { formula: cells.length ? `SUM(${cells.join(',')})` : '0' };
          });
          const tCol = getCol(months.length + 3);
          const tCells = [];
          for (let r = startIdx + modeIdx; r < currentRowIdx; r += modes.length) tCells.push(`${tCol}${r}`);
          const total = { formula: tCells.length ? `SUM(${tCells.join(',')})` : '0' };
          rows.push({ kind: 'sectionTotal', label: label + sfx(mode), section, values, total });
          currentRowIdx++;
        });
      };

      // 1. REVENUE
      rows.push({ kind: 'pill', label: 'Revenues', section: 'REVENUE' }); currentRowIdx++;
      const revAccs = accounts.filter(a => a.ACCOUNT_TYPE === 'REVENUE');
      const revStart = pushAccounts(revAccs, 'REVENUE');
      revTotalStart = currentRowIdx;
      pushTotalSum('Revenue', 'REVENUE', revStart);
      spacer();

      // 2. VARIABLE COSTS
      rows.push({ kind: 'pill', label: 'Variable Costs', section: 'COGS' }); currentRowIdx++;
      const varAccs = accounts.filter(isVariable);
      const varStart = pushAccounts(varAccs, 'COGS', true);
      const varTotalStart = currentRowIdx;
      pushTotalSum('Variable Costs', 'COGS', varStart);
      spacer();

      // 3. CM
      const cmStart = currentRowIdx;
      modes.forEach((mode, modeIdx) => {
         const revR = revTotalStart + modeIdx;
         const varR = varTotalStart + modeIdx;
         const values = months.map((m, i) => {
            const col = getCol(i + 3);
            return { formula: `${col}${revR}-${col}${varR}` };
         });
         const tCol = getCol(months.length + 3);
         rows.push({ kind: 'profit', label: 'Contribution' + sfx(mode), values, total: { formula: `${tCol}${revR}-${tCol}${varR}` }, isNet: false });
         currentRowIdx++;
      });
      modes.forEach((mode, modeIdx) => {
         const revR = revTotalStart + modeIdx;
         const cmR = cmStart + modeIdx;
         // Same rule as on screen: own CM% when valid; forecast fallback -> historical actual CM% (value)
         const cmCell = (info: { pct: number; fallback: boolean }, col: string) =>
           info.fallback ? info.pct : { formula: `IF(${col}${revR}<=0, "N/A", ${col}${cmR}/${col}${revR})` };
         const values = months.map((m, i) => cmCell(cmInfoMonth(m, mode), getCol(i + 3)));
         const tCol = getCol(months.length + 3);
         rows.push({ kind: 'margin', label: 'CM %' + sfx(mode), values, total: cmCell(cmInfoYear(mode), tCol) });
         currentRowIdx++;
      });
      spacer();

      // 4. FIXED COSTS
      rows.push({ kind: 'pill', label: 'Fixed Costs', section: 'INDIRECT_EXPENSE' }); currentRowIdx++;
      const fixAccs = accounts.filter(isFixed);
      const fixStart = pushAccounts(fixAccs, 'INDIRECT_EXPENSE');
      const fixTotalStart = currentRowIdx;
      pushTotalSum('Fixed Costs', 'INDIRECT_EXPENSE', fixStart);
      spacer();

      // 5. BEP
      const bepStart = currentRowIdx;
      modes.forEach((mode, modeIdx) => {
         const fixR = fixTotalStart + modeIdx;
         const cmPctR = cmStart + modes.length + modeIdx;
         const values = months.map((m, i) => {
            const col = getCol(i + 3);
            return { formula: `IF(ISNUMBER(${col}${cmPctR}), IF(${col}${cmPctR}<=0, "N/A", ${col}${fixR}/${col}${cmPctR}), "N/A")` };
         });
         const tCol = getCol(months.length + 3);
         rows.push({ kind: 'profit', label: 'Break-Even' + sfx(mode), values, total: { formula: `IF(ISNUMBER(${tCol}${cmPctR}), IF(${tCol}${cmPctR}<=0, "N/A", ${tCol}${fixR}/${tCol}${cmPctR}), "N/A")` }, isNet: true });
         currentRowIdx++;
      });
      spacer();

      // 6. SVB
      const svbStart = currentRowIdx;
      modes.forEach((mode, modeIdx) => {
         const revR = revTotalStart + modeIdx;
         const bepR = bepStart + modeIdx;
         const values = months.map((m, i) => {
            const col = getCol(i + 3);
            return { formula: `IF(AND(ISNUMBER(${col}${bepR}), ${col}${revR}>0), ${col}${revR}-${col}${bepR}, "N/A")` };
         });
         const tCol = getCol(months.length + 3);
         rows.push({ kind: 'profit', label: 'Surplus / Shortfall' + sfx(mode), values, total: { formula: `IF(COUNT(${getCol(3)}${currentRowIdx}:${getCol(months.length + 2)}${currentRowIdx})=0, "N/A", SUM(${getCol(3)}${currentRowIdx}:${getCol(months.length + 2)}${currentRowIdx}))` }, isNet: true });
         currentRowIdx++;
      });
      modes.forEach((mode, modeIdx) => {
         const revR = revTotalStart + modeIdx;
         const svbR = svbStart + modeIdx;
         const values = months.map((m, i) => {
            const col = getCol(i + 3);
            return { formula: `IF(ISNUMBER(${col}${svbR}), IF(${col}${revR}<=0, "N/A", ${col}${svbR}/${col}${revR}), "N/A")` };
         });
         const tCol = getCol(months.length + 3);
         rows.push({ kind: 'margin', label: 'Surplus %' + sfx(mode), values, total: { formula: `IF(ISNUMBER(${tCol}${svbR}), ${tCol}${svbR}/SUMPRODUCT(ISNUMBER(${getCol(3)}${svbR}:${getCol(months.length + 2)}${svbR})*${getCol(3)}${revR}:${getCol(months.length + 2)}${revR}), "N/A")` } });
         currentRowIdx++;
      });

      const modeLabel = viewMode === 'BOTH' ? 'Forecast vs Actual' : viewMode === 'ACTUAL' ? 'Actuals' : 'Forecast';
      const rangeLabel = `${MONTHS[startMonth - 1]} - ${MONTHS[endMonth - 1]} ${selectedYear}`;
      const isFullYear = startMonth === 1 && endMonth === 12;
      
      await exportBEPToExcel({
        title: 'Break-Even Point',
        subtitle: `${rangeLabel}   |   ${modeLabel}   |   ${isPct ? '% of Revenue' : 'Amounts'}`,
        monthLabels: months.map(m => MONTHS[m - 1]),
        rows,
        fileName: `BreakEven_${selectedYear}_${MONTHS[startMonth - 1]}-${MONTHS[endMonth - 1]}_${viewMode}.xlsx`,
        sheetName: 'Break-Even Point',
        totalLabel: isFullYear ? 'TOTAL' : `TOTAL (${MONTHS[startMonth - 1]}-${MONTHS[endMonth - 1]})`,
        rateColumn: true
      });
      toast.success('Break-Even Point exported successfully');
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
            <Target className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">Break-Even Point</h1>
            <div className="h-0.5 w-16 bg-[#D4AF37] mt-1 rounded-full" />
          </div>
          <button
            onClick={handleExportExcel}
            disabled={isExporting || isLoading || accounts.length === 0}
            title="Export Break-Even to Excel"
            className="ml-1 flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-400/40 text-emerald-400 hover:text-emerald-300 transition-all disabled:opacity-40 disabled:pointer-events-none"
          >
            {isExporting ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Download className="w-[18px] h-[18px]" />}
          </button>
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
          <div className="border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse">
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
                {renderRow('Revenue', getRevMonth, getRevYear)}
                {renderRow('Variable Costs', getVarCostsMonth, getVarCostsYear, false, false, (m, mode) => setDetailsModal({ isOpen: true, type: 'VARIABLE', month: m, mode }))}
                {renderRow('Contribution', getContributionMonth, getContributionYear, true)}
                {renderRow('CM %',
                  getCmPctMonth,
                  getCmPctYear,
                  false, true, undefined, cmFlag
                )}
                
                {renderSpacer('sp1')}
                {renderRow('Fixed Costs', getFixedCostsMonth, getFixedCostsYear, false, false, (m, mode) => setDetailsModal({ isOpen: true, type: 'FIXED', month: m, mode }))}
                {renderSpacer('sp2')}

                {renderRow('Break-Even', getBEPMonth, getBEPYear, true, false, undefined, cmFlag)}

                {renderSpacer('sp3')}
                {renderRow('Surplus / Shortfall', getMoSMonth, getMoSYear)}
                {renderRow('Surplus %',
                  (m, mode) => getRevMonth(m, mode) <= 0 ? NaN : getMoSMonth(m, mode) / getRevMonth(m, mode),
                  (mode) => { const r = getMoSRevYear(mode); return Number.isFinite(r) && r > 0 ? getMoSYear(mode) / r : NaN; },
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
                const targetAccounts = accounts
                  .filter(detailsModal.type === 'VARIABLE' ? isVariable : isFixed)
                  .sort((a, b) => a.ACCOUNT_NAME.localeCompare(b.ACCOUNT_NAME));
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
