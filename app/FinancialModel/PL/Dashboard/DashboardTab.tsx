import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight, DollarSign, Percent, Briefcase, Target, PieChart, ShoppingCart, Award, Maximize2, X, BarChart2, LineChart as LineChartIcon } from 'lucide-react';
import DataLoader from '@/app/Components/Loading/DataLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import { fetchAccounts, fetchEntriesByYear, FinancialAccount, FinancialEntry } from '../../Service/FinancialService';
import { useFinancialModel } from '../../Context/FinancialModelContext';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  const { selectedYear, startMonth, endMonth } = useFinancialModel();
  const [isLoading, setIsLoading] = useState(true);
  const [activeView, setActiveView] = useState<'CARDS' | 'CHARTS'>('CARDS');
  const [expandedChart, setExpandedChart] = useState<string | null>(null);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  
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

  // Prepare Data for Direct Expenses Chart
  const directExpensesData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    return {
      month: m,
      Actual: calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'ACTUAL'),
      Forecast: calculateSectionTotal('DIRECT_EXPENSE', monthIndex, 'FORECAST'),
    };
  });

  // Prepare Data for Indirect Expenses Chart
  const indirectExpensesData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    return {
      month: m,
      Actual: calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'ACTUAL'),
      Forecast: calculateSectionTotal('INDIRECT_EXPENSE', monthIndex, 'FORECAST'),
    };
  });

  // Prepare Data for Depreciation Chart
  const depreciationData = MONTHS.slice(startMonth - 1, endMonth).map((m, i) => {
    const monthIndex = startMonth + i;
    return {
      month: m,
      Actual: calculateSectionTotal('DEPRECIATION', monthIndex, 'ACTUAL'),
      Forecast: calculateSectionTotal('DEPRECIATION', monthIndex, 'FORECAST'),
    };
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

    return { month: m, 'Actual Margin': marginA };
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

    return { month: m, 'Actual Margin': marginA };
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

    return {
      month: m,
      'Actual Margin': marginA
    };
  });



  // KPIs
  const revA = calculateSectionRangeTotal('REVENUE', 'ACTUAL');
  const revF = calculateSectionRangeTotal('REVENUE', 'FORECAST');
  
  const cogsA = calculateSectionRangeTotal('COGS', 'ACTUAL');
  const cogsF = calculateSectionRangeTotal('COGS', 'FORECAST');
  
  const dirA = calculateSectionRangeTotal('DIRECT_EXPENSE', 'ACTUAL');
  const indirA = calculateSectionRangeTotal('INDIRECT_EXPENSE', 'ACTUAL');
  const dirF = calculateSectionRangeTotal('DIRECT_EXPENSE', 'FORECAST');
  const indirF = calculateSectionRangeTotal('INDIRECT_EXPENSE', 'FORECAST');

  const depA = calculateSectionRangeTotal('DEPRECIATION', 'ACTUAL');
  const depF = calculateSectionRangeTotal('DEPRECIATION', 'FORECAST');

  const financeA = calculateSectionRangeTotal('FINANCE_COST', 'ACTUAL');
  const financeF = calculateSectionRangeTotal('FINANCE_COST', 'FORECAST');

  const taxesA = calculateSectionRangeTotal('TAXES', 'ACTUAL');
  const taxesF = calculateSectionRangeTotal('TAXES', 'FORECAST');

  const expA = dirA + indirA + depA + financeA + taxesA;
  const expF = dirF + indirF + depF + financeF + taxesF;

  const opexA = dirA + indirA;
  const opexF = dirF + indirF;

  const costToIncomeA = revA === 0 ? 0 : (expA / revA) * 100;
  const costToIncomeF = revF === 0 ? 0 : (expF / revF) * 100;

  const gpA = revA - cogsA;
  const gpF = revF - cogsF;

  const gpMarginA = revA === 0 ? 0 : (gpA / revA) * 100;
  const gpMarginF = revF === 0 ? 0 : (gpF / revF) * 100;

  const ebitdaA = gpA - dirA - indirA;
  const ebitdaF = gpF - dirF - indirF;

  const ebitdaMarginA = revA === 0 ? 0 : (ebitdaA / revA) * 100;
  const ebitdaMarginF = revF === 0 ? 0 : (ebitdaF / revF) * 100;

  const ebitA = ebitdaA - depA;
  const ebitF = ebitdaF - depF;

  const ebitMarginA = revA === 0 ? 0 : (ebitA / revA) * 100;
  const ebitMarginF = revF === 0 ? 0 : (ebitF / revF) * 100;

  const ebtA = ebitA - financeA;
  const ebtF = ebitF - financeF;

  const ebtMarginA = revA === 0 ? 0 : (ebtA / revA) * 100;
  const ebtMarginF = revF === 0 ? 0 : (ebtF / revF) * 100;

  const npA = ebtA - taxesA;
  const npF = ebtF - taxesF;

  const npMarginA = revA === 0 ? 0 : (npA / revA) * 100;
  const npMarginF = revF === 0 ? 0 : (npF / revF) * 100;

  const DualKpiCard = ({
    title, actual, forecast, isPercentage = false, isNegativeCost = false, accentColor, icon: Icon, onClick
  }: {
    title: string; actual: number; forecast: number;
    isPercentage?: boolean; isNegativeCost?: boolean; accentColor: string; icon?: any; onClick?: () => void;
  }) => {
    const diff = actual - forecast;
    const isPositive = isNegativeCost ? diff < 0 : diff > 0;
    const isNeutral = diff === 0;

    const variantColor = isNeutral ? 'text-slate-400' : isPositive ? 'text-emerald-500' : 'text-red-500';
    const badgeBg = isNeutral ? 'bg-slate-100' : isPositive ? 'bg-emerald-50' : 'bg-red-50';
    const progressColor = isNeutral ? 'bg-slate-300' : isPositive ? 'bg-emerald-400' : 'bg-red-400';

    const formatVal = (v: number) =>
      isPercentage
        ? `${v.toFixed(1)}%`
        : v.toLocaleString(undefined, { maximumFractionDigits: 0 });

    const progress = forecast === 0 ? (actual > 0 ? 100 : 0) : Math.min(100, Math.abs((actual / forecast) * 100));
    const VarIcon = isNeutral ? null : isPositive ? TrendingUp : TrendingDown;

    let variancePercent = 0;
    if (forecast !== 0) {
      variancePercent = (diff / Math.abs(forecast)) * 100;
    } else if (actual > 0) {
      variancePercent = 100;
    } else if (actual < 0) {
      variancePercent = -100;
    }

    const formattedVariance = isPercentage 
      ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` 
      : `${variancePercent > 0 ? '+' : ''}${variancePercent.toFixed(1)}%`;

    return (
      <div 
        onClick={onClick}
        className={`bg-white rounded-[24px] shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] hover:shadow-lg transition-all duration-300 border-t-[4px] ${accentColor} border-x border-b border-slate-100/80 flex flex-col overflow-hidden group ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
      >
        <div className="px-4 pt-4 pb-4 flex flex-col gap-3 flex-1">
          <div className="flex justify-between items-start">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
            {Icon && (
              <div className="p-2 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-slate-100 transition-colors">
                <Icon className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <p className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" /> Actual
              </p>
              <p className="text-2xl font-black text-slate-900 tabular-nums tracking-tight truncate" title={formatVal(actual)}>
                {formatVal(actual)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]" /> Forecast
              </p>
              <p className="text-[17px] font-bold text-slate-600 tabular-nums tracking-tight truncate" title={formatVal(forecast)}>
                {formatVal(forecast)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-1.5 pt-3 border-t border-slate-50">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-sm font-black ${badgeBg} ${variantColor}`}>
              {VarIcon && <VarIcon className="w-3.5 h-3.5" />}
              {formattedVariance}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">vs Forecast</span>
          </div>
        </div>

        <div className="h-1.5 bg-slate-50 w-full relative">
          <div
            className={`absolute left-0 top-0 h-full ${progressColor} transition-all duration-1000 ease-out`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  };

  const ChartCard = ({ chartId, children }: { chartId: string, children: React.ReactNode }) => (
    <div className="relative group rounded-[24px] overflow-hidden">
      <div 
        className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-2.5 bg-slate-100/80 backdrop-blur-sm rounded-xl hover:bg-slate-200 cursor-pointer shadow-sm border border-white/50"
        onClick={() => setExpandedChart(chartId)}
      >
        <Maximize2 className="w-4 h-4 text-slate-600" />
      </div>
      {children}
    </div>
  );

  const CustomPopupTooltip = ({ active, payload, label, isNegativeCost }: any) => {
    if (active && payload && payload.length) {
      let actualObj = payload.find((p: any) => p.dataKey === 'Actual');
      let forecastObj = payload.find((p: any) => p.dataKey === 'Forecast');
      
      // Support for Margin charts
      if (!actualObj && !forecastObj) {
        actualObj = payload.find((p: any) => p.dataKey === 'Actual Margin');
        forecastObj = payload.find((p: any) => p.dataKey === 'Forecast Margin');
      }
      
      if (!actualObj && !forecastObj) {
        return (
          <div className="bg-white p-4 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 min-w-[180px]">
            <p className="font-black text-slate-900 mb-3 text-sm border-b border-slate-100 pb-2">{label}</p>
            <div className="space-y-2">
              {payload.map((p: any, i: number) => (
                <div key={i} className="flex justify-between items-center gap-6">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                  <span className="text-sm font-black text-slate-800 tabular-nums">
                    {p.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      const isMarginChart = !!payload.find((p: any) => p.dataKey === 'Actual Margin');
      const formatValue = (v: number) => isMarginChart ? `${v.toFixed(1)}%` : v.toLocaleString(undefined, { maximumFractionDigits: 1 });

      const actual = actualObj?.value || 0;
      const forecast = forecastObj?.value || 0;
      const diff = actual - forecast;
      
      let variancePercent = 0;
      if (forecast !== 0) {
        variancePercent = (diff / Math.abs(forecast)) * 100;
      } else if (actual > 0) {
        variancePercent = 100;
      } else if (actual < 0) {
        variancePercent = -100;
      }

      const formattedVariance = isMarginChart ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%` : `${variancePercent > 0 ? '+' : ''}${variancePercent.toFixed(1)}%`;
      
      const isPositivePerformance = isNegativeCost ? diff < 0 : diff > 0;
      const isNeutral = diff === 0;

      const diffColor = isNeutral ? 'text-slate-500' : (isPositivePerformance ? 'text-emerald-500' : 'text-red-500');
      const badgeBg = isNeutral ? 'bg-slate-100 text-slate-600' : (isPositivePerformance ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600');

      return (
        <div className="bg-white p-5 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 min-w-[220px]">
          <p className="font-black text-slate-900 mb-3 text-sm border-b border-slate-100 pb-3">{label}</p>
          <div className="space-y-2.5">
            {actualObj && (
              <div className="flex justify-between items-center gap-6">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: actualObj.color }} />Actual
                </span>
                <span className="text-sm font-black text-slate-800 tabular-nums">
                  {formatValue(actual)}
                </span>
              </div>
            )}
            {forecastObj && (
              <div className="flex justify-between items-center gap-6">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: forecastObj.color }} />Forecast
                </span>
                <span className="text-sm font-black text-slate-800 tabular-nums">
                  {formatValue(forecast)}
                </span>
              </div>
            )}
            {forecastObj && (
              <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-slate-100 gap-6">
                <span className="text-xs font-bold text-slate-600">Variance</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold tabular-nums ${diffColor}`}>
                    {diff > 0 ? '+' : ''}{formatValue(diff)}
                  </span>
                  {!isMarginChart && (
                    <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${badgeBg}`}>
                      {formattedVariance}
                    </span>
                  )}
                  {isMarginChart && (
                    <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${badgeBg}`}>
                      {diff > 0 ? 'Up' : diff < 0 ? 'Down' : 'Flat'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const GenericPopupChart = ({ data, title, isNegativeCost }: { data: any[], title: string, isNegativeCost?: boolean }) => {
    const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'month' && k !== 'name') : [];
    
    return (
      <div className="bg-white rounded-[32px] p-6 md:p-10 h-full flex flex-col w-full">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-black text-slate-800">{title}</h3>
          
          <div className="flex items-center bg-slate-50 rounded-full p-1 border border-slate-100">
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded-full transition-all flex items-center justify-center ${chartType === 'bar' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-2 rounded-full transition-all flex items-center justify-center ${chartType === 'line' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              <LineChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#94a3b8', fontWeight: 700 }} dy={12} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomPopupTooltip isNegativeCost={isNegativeCost} />} />
              <Legend wrapperStyle={{ paddingTop: '24px', fontWeight: 700, fontSize: '14px' }} iconType="circle" />
              
              {keys.map((key, i) => {
                const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
                const color = colors[i % colors.length];
                
                if (chartType === 'bar') {
                  return <Bar key={key} dataKey={key} fill={color} radius={[6, 6, 0, 0]} maxBarSize={60} />;
                } else {
                  return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={4} dot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />;
                }
              })}
            </ComposedChart>
          </ResponsiveContainer>
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

        <div className="flex flex-col md:flex-row items-center gap-4">
          {/* View Toggle */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl">
            <button
              onClick={() => setActiveView('CARDS')}
              className={`w-28 px-2 py-2 text-sm font-bold rounded-lg transition-all ${activeView === 'CARDS' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            >
              KPI Cards
            </button>
            <button
              onClick={() => setActiveView('CHARTS')}
              className={`w-28 px-2 py-2 text-sm font-bold rounded-lg transition-all ${activeView === 'CHARTS' ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-white/40 hover:text-white/70'}`}
            >
              Charts
            </button>
          </div>

          
        </div>
      </div>

      {isLoading ? (
        <DataLoader message="" className="min-h-[500px]" />
      ) : accounts.length === 0 ? (
        <NoData />
      ) : (
        <div className="space-y-6">
          {/* KPI Cards View */}
          {activeView === 'CARDS' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
              {/* Profitability Section */}
              <div>
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#D4AF37]" />
                  Profitability Metrics
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                  <DualKpiCard title="Total Revenue" actual={revA} forecast={revF} accentColor="border-emerald-400" icon={TrendingUp} onClick={() => setExpandedChart('REVENUE')} />
                  <DualKpiCard title="Cost of Goods Sold" actual={cogsA} forecast={cogsF} isNegativeCost accentColor="border-red-400" icon={ShoppingCart} onClick={() => setExpandedChart('COGS')} />
                  <DualKpiCard title="Gross Profit" actual={gpA} forecast={gpF} accentColor="border-teal-400" icon={DollarSign} onClick={() => setExpandedChart('GROSS_PROFIT')} />
                  <DualKpiCard title="Gross Margin" actual={gpMarginA} forecast={gpMarginF} isPercentage accentColor="border-teal-400" icon={Percent} onClick={() => setExpandedChart('GROSS_MARGIN')} />
                  <DualKpiCard title="EBITDA" actual={ebitdaA} forecast={ebitdaF} accentColor="border-indigo-400" icon={Activity} onClick={() => setExpandedChart('EBITDA')} />

                  <DualKpiCard title="EBITDA Margin" actual={ebitdaMarginA} forecast={ebitdaMarginF} isPercentage accentColor="border-indigo-400" icon={Percent} onClick={() => setExpandedChart('EBITDA_MARGIN')} />
                  <DualKpiCard title="EBIT" actual={ebitA} forecast={ebitF} accentColor="border-blue-400" icon={Target} onClick={() => setExpandedChart('PROFITABILITY')} />
                  <DualKpiCard title="EBIT Margin" actual={ebitMarginA} forecast={ebitMarginF} isPercentage accentColor="border-blue-400" icon={Percent} onClick={() => setExpandedChart('PROFITABILITY')} />
                  <DualKpiCard title="Net Profit (Before Tax)" actual={ebtA} forecast={ebtF} accentColor="border-[#D4AF37]" icon={Award} onClick={() => setExpandedChart('NET_PROFIT')} />
                  <DualKpiCard title="Net Profit Margin" actual={ebtMarginA} forecast={ebtMarginF} isPercentage accentColor="border-[#D4AF37]" icon={Percent} onClick={() => setExpandedChart('PROFITABILITY')} />
                </div>
              </div>

              {/* Expenses Breakdown Section */}
              <div>
                <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-orange-500" />
                  Expenses Breakdown
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                  <DualKpiCard title="Direct Expenses" actual={dirA} forecast={dirF} isNegativeCost accentColor="border-orange-400" icon={Briefcase} onClick={() => setExpandedChart('DIRECT_EXPENSES')} />
                  <DualKpiCard title="Indirect Expenses" actual={indirA} forecast={indirF} isNegativeCost accentColor="border-orange-400" icon={Briefcase} onClick={() => setExpandedChart('INDIRECT_EXPENSES')} />
                  <DualKpiCard title="Depreciation" actual={depA} forecast={depF} isNegativeCost accentColor="border-slate-400" icon={PieChart} onClick={() => setExpandedChart('DEPRECIATION')} />
                  <DualKpiCard title="Total Expenses" actual={expA} forecast={expF} isNegativeCost accentColor="border-red-500" icon={Briefcase} onClick={() => setExpandedChart('TOTAL_EXPENSES')} />
                </div>
              </div>
            </div>
          )}

          {/* Charts View */}
          {activeView === 'CHARTS' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard chartId="REVENUE"><RevenueChart data={revenueData} /></ChartCard>
                <ChartCard chartId="COGS"><CogsChart data={cogsData} /></ChartCard>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard chartId="TOTAL_EXPENSES"><TotalExpensesChart data={totalExpensesData} /></ChartCard>
                <ChartCard chartId="GROSS_PROFIT"><GrossProfitChart data={grossProfitData} /></ChartCard>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard chartId="GROSS_MARGIN"><GrossProfitMarginChart data={grossProfitMarginData} /></ChartCard>
                <ChartCard chartId="EBITDA"><EbitdaChart data={ebitdaData} /></ChartCard>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard chartId="EBITDA_MARGIN"><EbitdaMarginChart data={ebitdaMarginData} /></ChartCard>
                <ChartCard chartId="NET_PROFIT"><NetProfitChart data={netProfitData} /></ChartCard>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <ChartCard chartId="PROFITABILITY"><ProfitabilityChart data={profitabilityData} /></ChartCard>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expanded Chart Modal */}
      {expandedChart && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-[#0f0f0f]/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-6xl animate-in zoom-in-95 duration-300">
            
            {/* Modal Controls: Close */}
            <div className="absolute -top-14 right-0 md:-top-5 md:-right-16 z-20 flex flex-col gap-3">
              <button 
                onClick={() => setExpandedChart(null)}
                className="p-3 bg-white hover:bg-slate-100 rounded-full shadow-xl transition-all self-end"
              >
                <X className="w-6 h-6 text-slate-800" />
              </button>
            </div>

            {/* Render Generic Popup Chart with reduced height (!h-[500px]) */}
            <div className="w-full h-[50vh] md:h-[500px] shadow-2xl ring-1 ring-white/20 rounded-[32px]">
               {expandedChart === 'REVENUE' && <GenericPopupChart title="Revenue Analysis" data={revenueData} />}
               {expandedChart === 'COGS' && <GenericPopupChart title="Cost of Goods Sold" data={cogsData} isNegativeCost={true} />}
               {expandedChart === 'TOTAL_EXPENSES' && <GenericPopupChart title="Total Expenses" data={totalExpensesData} isNegativeCost={true} />}
               {expandedChart === 'DIRECT_EXPENSES' && <GenericPopupChart title="Direct Expenses" data={directExpensesData} isNegativeCost={true} />}
               {expandedChart === 'INDIRECT_EXPENSES' && <GenericPopupChart title="Indirect Expenses" data={indirectExpensesData} isNegativeCost={true} />}
               {expandedChart === 'DEPRECIATION' && <GenericPopupChart title="Depreciation" data={depreciationData} isNegativeCost={true} />}
               {expandedChart === 'GROSS_PROFIT' && <GenericPopupChart title="Gross Profit" data={grossProfitData} />}
               {expandedChart === 'GROSS_MARGIN' && <GenericPopupChart title="Gross Profit Margin" data={grossProfitMarginData} />}
               {expandedChart === 'EBITDA' && <GenericPopupChart title="EBITDA" data={ebitdaData} />}
               {expandedChart === 'EBITDA_MARGIN' && <GenericPopupChart title="EBITDA Margin" data={ebitdaMarginData} />}
               {expandedChart === 'NET_PROFIT' && <GenericPopupChart title="Net Profit (Before Tax)" data={netProfitData} />}
               {expandedChart === 'PROFITABILITY' && <GenericPopupChart title="Profitability Overview" data={profitabilityData} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
