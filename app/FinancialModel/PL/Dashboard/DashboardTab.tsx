import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import DataLoader from '@/app/Components/Loading/DataLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { fetchAccounts, fetchEntriesByYear, FinancialAccount, FinancialEntry } from '../../Service/FinancialService';

// Import Charts
import { RevenueChart } from './Charts/RevenueChart';
import { CogsChart } from './Charts/CogsChart';
import { ProfitabilityChart } from './Charts/ProfitabilityChart';
import { TotalExpensesChart } from './Charts/TotalExpensesChart';
import { GrossProfitChart } from './Charts/GrossProfitChart';
import { GrossProfitMarginChart } from './Charts/GrossProfitMarginChart';
import { EbitdaChart } from './Charts/EbitdaChart';
import { EbitdaMarginChart } from './Charts/EbitdaMarginChart';
import { NetProfitChart } from './Charts/NetProfitChart';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function DashboardTab() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState<number>(1);
  const [endMonth, setEndMonth] = useState<number>(12);
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
      console.error('Failed to load dashboard data:', error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const getAmount = (accountId: string, month: number, mode: 'ACTUAL' | 'FORECAST') => {
    const entry = entries.find(e => e.ACCOUNT_ID === accountId && e.PERIOD_MONTH === month);
    if (!entry) return 0;
    return mode === 'ACTUAL' ? entry.ACTUAL_AMOUNT : entry.FORECAST_AMOUNT;
  };

  const calculateSectionTotal = (type: string, month: number, mode: 'ACTUAL' | 'FORECAST') => {
    return accounts
      .filter(a => a.ACCOUNT_TYPE === type)
      .reduce((sum, acc) => sum + getAmount(acc.ID, month, mode), 0);
  };

  const calculateSectionRangeTotal = (type: string, mode: 'ACTUAL' | 'FORECAST') => {
    let total = 0;
    for(let m = startMonth; m <= endMonth; m++) total += calculateSectionTotal(type, m, mode);
    return total;
  };

  // Prepare Data for Revenue Chart
  const revenueData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    return {
      month: m,
      Actual: calculateSectionTotal('REVENUE', monthIndex, 'ACTUAL'),
      Forecast: calculateSectionTotal('REVENUE', monthIndex, 'FORECAST'),
    };
  });

  // Prepare Data for COGS Chart
  const cogsData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    return {
      month: m,
      Actual: calculateSectionTotal('COGS', monthIndex, 'ACTUAL'),
      Forecast: calculateSectionTotal('COGS', monthIndex, 'FORECAST'),
    };
  });

  // Prepare Data for Total Expenses Chart
  const totalExpensesData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    const expA = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'ACTUAL') + calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('DEPRECIATION', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('FINANCE_COST', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('TAXES', monthIndex, 'ACTUAL');

    const expF = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'FORECAST') + calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'FORECAST') +
                 calculateSectionTotal('DEPRECIATION', monthIndex, 'FORECAST') +
                 calculateSectionTotal('FINANCE_COST', monthIndex, 'FORECAST') +
                 calculateSectionTotal('TAXES', monthIndex, 'FORECAST');
                 
    return { month: m, Actual: expA, Forecast: expF };
  });

  // Prepare Data for Gross Profit Chart
  const grossProfitData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    const revA = calculateSectionTotal('REVENUE', monthIndex, 'ACTUAL');
    const cogsA = calculateSectionTotal('COGS', monthIndex, 'ACTUAL');
    const gpA = revA - cogsA;

    const revF = calculateSectionTotal('REVENUE', monthIndex, 'FORECAST');
    const cogsF = calculateSectionTotal('COGS', monthIndex, 'FORECAST');
    const gpF = revF - cogsF;

    return { month: m, Actual: gpA, Forecast: gpF };
  });

  // Prepare Data for Gross Profit Margin Chart
  const grossProfitMarginData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    const revA = calculateSectionTotal('REVENUE', monthIndex, 'ACTUAL');
    const cogsA = calculateSectionTotal('COGS', monthIndex, 'ACTUAL');
    const gpA = revA - cogsA;
    const marginA = revA === 0 ? 0 : (gpA / revA) * 100;

    const revF = calculateSectionTotal('REVENUE', monthIndex, 'FORECAST');
    const cogsF = calculateSectionTotal('COGS', monthIndex, 'FORECAST');
    const gpF = revF - cogsF;
    const marginF = revF === 0 ? 0 : (gpF / revF) * 100;

    return { month: m, 'Actual Margin': marginA, 'Forecast Margin': marginF };
  });

  // Prepare Data for EBITDA Chart
  const ebitdaData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    const revA = calculateSectionTotal('REVENUE', monthIndex, 'ACTUAL');
    const cogsA = calculateSectionTotal('COGS', monthIndex, 'ACTUAL');
    const dirA = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'ACTUAL');
    const indirA = calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'ACTUAL');
    const ebitdaA = revA - cogsA - dirA - indirA;

    const revF = calculateSectionTotal('REVENUE', monthIndex, 'FORECAST');
    const cogsF = calculateSectionTotal('COGS', monthIndex, 'FORECAST');
    const dirF = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'FORECAST');
    const indirF = calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'FORECAST');
    const ebitdaF = revF - cogsF - dirF - indirF;

    return { month: m, Actual: ebitdaA, Forecast: ebitdaF };
  });

  // Prepare Data for EBITDA Margin Chart
  const ebitdaMarginData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    const revA = calculateSectionTotal('REVENUE', monthIndex, 'ACTUAL');
    const cogsA = calculateSectionTotal('COGS', monthIndex, 'ACTUAL');
    const dirA = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'ACTUAL');
    const indirA = calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'ACTUAL');
    const ebitdaA = revA - cogsA - dirA - indirA;
    const marginA = revA === 0 ? 0 : (ebitdaA / revA) * 100;

    const revF = calculateSectionTotal('REVENUE', monthIndex, 'FORECAST');
    const cogsF = calculateSectionTotal('COGS', monthIndex, 'FORECAST');
    const dirF = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'FORECAST');
    const indirF = calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'FORECAST');
    const ebitdaF = revF - cogsF - dirF - indirF;
    const marginF = revF === 0 ? 0 : (ebitdaF / revF) * 100;

    return { month: m, 'Actual Margin': marginA, 'Forecast Margin': marginF };
  });

  // Prepare Data for Net Profit Chart
  const netProfitData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    const revA = calculateSectionTotal('REVENUE', monthIndex, 'ACTUAL');
    const cogsA = calculateSectionTotal('COGS', monthIndex, 'ACTUAL');
    const expA = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'ACTUAL') + calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('DEPRECIATION', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('FINANCE_COST', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('TAXES', monthIndex, 'ACTUAL');
    const npA = revA - cogsA - expA;

    const revF = calculateSectionTotal('REVENUE', monthIndex, 'FORECAST');
    const cogsF = calculateSectionTotal('COGS', monthIndex, 'FORECAST');
    const expF = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'FORECAST') + calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'FORECAST') +
                 calculateSectionTotal('DEPRECIATION', monthIndex, 'FORECAST') +
                 calculateSectionTotal('FINANCE_COST', monthIndex, 'FORECAST') +
                 calculateSectionTotal('TAXES', monthIndex, 'FORECAST');
    const npF = revF - cogsF - expF;

    return { month: m, Actual: npA, Forecast: npF };
  });

  // Prepare Data for Net Profit Margin Chart
  const profitabilityData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    const revA = calculateSectionTotal('REVENUE', monthIndex, 'ACTUAL');
    const cogsA = calculateSectionTotal('COGS', monthIndex, 'ACTUAL');
    const expA = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'ACTUAL') + calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('DEPRECIATION', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('FINANCE_COST', monthIndex, 'ACTUAL') +
                 calculateSectionTotal('TAXES', monthIndex, 'ACTUAL');
    const netProfitA = revA - cogsA - expA;
    const marginA = revA === 0 ? 0 : (netProfitA / revA) * 100;

    const revF = calculateSectionTotal('REVENUE', monthIndex, 'FORECAST');
    const cogsF = calculateSectionTotal('COGS', monthIndex, 'FORECAST');
    const expF = calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'FORECAST') + calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'FORECAST') +
                 calculateSectionTotal('DEPRECIATION', monthIndex, 'FORECAST') +
                 calculateSectionTotal('FINANCE_COST', monthIndex, 'FORECAST') +
                 calculateSectionTotal('TAXES', monthIndex, 'FORECAST');
    const netProfitF = revF - cogsF - expF;
    const marginF = revF === 0 ? 0 : (netProfitF / revF) * 100;

    return {
      month: m,
      'Actual Margin': marginA,
      'Forecast Margin': marginF,
    };
  });



  // KPIs
  const revA = calculateSectionRangeTotal('REVENUE', 'ACTUAL');
  const revF = calculateSectionRangeTotal('REVENUE', 'FORECAST');
  
  const cogsA = calculateSectionRangeTotal('COGS', 'ACTUAL');
  const cogsF = calculateSectionRangeTotal('COGS', 'FORECAST');
  
  const expA = calculateSectionRangeTotal('DIRECT_EXPENSE', 'ACTUAL') + calculateSectionRangeTotal('INDIRECT_EXPENSE', 'ACTUAL') +
               calculateSectionRangeTotal('DEPRECIATION', 'ACTUAL') + calculateSectionRangeTotal('FINANCE_COST', 'ACTUAL') +
               calculateSectionRangeTotal('TAXES', 'ACTUAL');
  const expF = calculateSectionRangeTotal('DIRECT_EXPENSE', 'FORECAST') + calculateSectionRangeTotal('INDIRECT_EXPENSE', 'FORECAST') +
               calculateSectionRangeTotal('DEPRECIATION', 'FORECAST') + calculateSectionRangeTotal('FINANCE_COST', 'FORECAST') +
               calculateSectionRangeTotal('TAXES', 'FORECAST');

  const gpA = revA - cogsA;
  const gpF = revF - cogsF;

  const gpMarginA = revA === 0 ? 0 : (gpA / revA) * 100;
  const gpMarginF = revF === 0 ? 0 : (gpF / revF) * 100;

  const dirA = calculateSectionRangeTotal('DIRECT_EXPENSE', 'ACTUAL');
  const indirA = calculateSectionRangeTotal('INDIRECT_EXPENSE', 'ACTUAL');
  const dirF = calculateSectionRangeTotal('DIRECT_EXPENSE', 'FORECAST');
  const indirF = calculateSectionRangeTotal('INDIRECT_EXPENSE', 'FORECAST');

  const ebitdaA = gpA - dirA - indirA;
  const ebitdaF = gpF - dirF - indirF;

  const ebitdaMarginA = revA === 0 ? 0 : (ebitdaA / revA) * 100;
  const ebitdaMarginF = revF === 0 ? 0 : (ebitdaF / revF) * 100;

  const npA = gpA - expA;
  const npF = gpF - expF;

  const npMarginA = revA === 0 ? 0 : (npA / revA) * 100;
  const npMarginF = revF === 0 ? 0 : (npF / revF) * 100;

  const DualKpiCard = ({
    title, actual, forecast, isPercentage = false, isNegativeCost = false, accentColor
  }: {
    title: string; actual: number; forecast: number;
    isPercentage?: boolean; isNegativeCost?: boolean; accentColor: string;
  }) => {
    const diff = actual - forecast;
    const isPositive = isNegativeCost ? diff < 0 : diff >= 0;
    const isNeutral = diff === 0;

    const variantColor = isNeutral ? 'text-slate-400' : isPositive ? 'text-emerald-500' : 'text-red-500';
    const badgeBg = isNeutral ? 'bg-slate-100' : isPositive ? 'bg-emerald-50' : 'bg-red-50';
    const progressColor = isPositive ? 'bg-emerald-400' : 'bg-red-400';

    const formatVal = (v: number) =>
      isPercentage
        ? `${v.toFixed(1)}%`
        : v.toLocaleString(undefined, { maximumFractionDigits: 0 });

    // Progress: actual as % of forecast, clamped to 0–100
    const progress = forecast === 0 ? 0 : Math.min(100, Math.abs((actual / forecast) * 100));

    const VarIcon = isNeutral ? null : isPositive ? TrendingUp : TrendingDown;

    return (
      <div className={`bg-white rounded-2xl shadow-sm border-t-[3px] ${accentColor} border-x border-b border-slate-100 flex flex-col overflow-hidden`}>
        {/* Top */}
        <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>

          <div className="grid grid-cols-3 gap-1.5 items-end">
            <div>
              <p className="text-[9px] font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Actual
              </p>
              <p className="text-sm font-black text-slate-900 tabular-nums truncate" title={formatVal(actual)}>{formatVal(actual)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 mb-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Forecast
              </p>
              <p className="text-sm font-black text-slate-900 tabular-nums truncate" title={formatVal(forecast)}>{formatVal(forecast)}</p>
            </div>
            <div className="flex justify-end">
              <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-black ${badgeBg} ${variantColor}`}>
                {VarIcon && <VarIcon className="w-2.5 h-2.5" />}
                {diff > 0 ? '+' : ''}{formatVal(diff)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-slate-100 w-full">
          <div
            className={`h-full ${progressColor} transition-all duration-700 rounded-r-full`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Dark Header */}
      <div className="bg-[#0f0f0f] rounded-3xl px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight">P&L Dashboard</h1>
            <div className="h-0.5 w-16 bg-[#D4AF37] mt-1 rounded-full" />
          </div>
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

      {isLoading ? (
        <DataLoader message="" className="min-h-[500px]" />
      ) : accounts.length === 0 ? (
        <NoData />
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <DualKpiCard title="Revenue" actual={revA} forecast={revF} accentColor="border-emerald-400" />
            <DualKpiCard title="COGS" actual={cogsA} forecast={cogsF} isNegativeCost accentColor="border-red-400" />
            <DualKpiCard title="Total Expenses" actual={expA} forecast={expF} isNegativeCost accentColor="border-orange-400" />
            <DualKpiCard title="Gross Profit" actual={gpA} forecast={gpF} accentColor="border-teal-400" />
            <DualKpiCard title="Gross Profit Margin" actual={gpMarginA} forecast={gpMarginF} isPercentage accentColor="border-teal-400" />
            <DualKpiCard title="EBITDA" actual={ebitdaA} forecast={ebitdaF} accentColor="border-indigo-400" />
            <DualKpiCard title="EBITDA Margin" actual={ebitdaMarginA} forecast={ebitdaMarginF} isPercentage accentColor="border-indigo-400" />
            <DualKpiCard title="Net Profit (AT)" actual={npA} forecast={npF} accentColor="border-[#D4AF37]" />
            <DualKpiCard title="Net Profit (AT) Margin" actual={npMarginA} forecast={npMarginF} isPercentage accentColor="border-[#D4AF37]" />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueChart data={revenueData} />
            <CogsChart data={cogsData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <TotalExpensesChart data={totalExpensesData} />
            <GrossProfitChart data={grossProfitData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <GrossProfitMarginChart data={grossProfitMarginData} />
            <EbitdaChart data={ebitdaData} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <EbitdaMarginChart data={ebitdaMarginData} />
            <NetProfitChart data={netProfitData} />
          </div>
          <div className="grid grid-cols-1 gap-6 mt-6">
            <ProfitabilityChart data={profitabilityData} />
          </div>
        </div>
      )}
    </div>
  );
}
