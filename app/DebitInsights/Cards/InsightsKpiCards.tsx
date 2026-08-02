'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { DebitInsightsMetrics } from '../Utils/InsightsTypes';

interface InsightsKpiCardsProps {
  metrics: DebitInsightsMetrics;
}

function formatCurrency(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function YoYBadge({ change }: { change: number | null }) {
  if (change === null) {
    return (
      <p className="text-xs text-gray-400 mt-1">No same-period last year data</p>
    );
  }

  const isUp = change >= 0;
  const Icon = isUp ? ArrowUp : ArrowDown;

  return (
    <p className={`inline-flex items-center gap-1 text-xs font-semibold mt-1 ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
      <Icon className="w-3.5 h-3.5" />
      {Math.abs(change).toFixed(1)}% vs same period last year
    </p>
  );
}

export default function InsightsKpiCards({ metrics }: InsightsKpiCardsProps) {
  const monthCount = metrics.trendSeries.length;
  const avgMonthlyNetSales = monthCount > 0 ? metrics.period.netSales / monthCount : 0;
  const avgMonthlyCollections = monthCount > 0 ? metrics.period.collections / monthCount : 0;
  const periodMonthsLabel = monthCount === 1 ? '1 month in period' : `${monthCount} months in period`;

  return (
    <div className="grid grid-cols-6 gap-2 xl:gap-3 min-w-0">
      <div className="bg-white rounded-xl border border-gray-200 p-3 xl:p-4 min-w-0">
        <p className="text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Open Debt (as-of)</p>
        <p className="text-lg xl:text-2xl font-bold text-gray-900 truncate">{formatCurrency(metrics.totalOpenDebt)}</p>
        <p className="text-[10px] xl:text-xs text-gray-400 mt-1 truncate">Open balances with aging logic</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 xl:p-4 min-w-0">
        <p className="text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Net Sales (period)</p>
        <p className="text-lg xl:text-2xl font-bold text-gray-900 truncate">{formatCurrency(metrics.period.netSales)}</p>
        <YoYBadge change={metrics.period.netSalesYoYChange} />
        <p className="text-[10px] xl:text-xs text-gray-400 mt-1 truncate">SAL − RSAL only</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 xl:p-4 min-w-0">
        <p className="text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Avg Monthly Net Sales</p>
        <p className="text-lg xl:text-2xl font-bold text-gray-900 truncate">{formatCurrency(avgMonthlyNetSales)}</p>
        <p className="text-[10px] xl:text-xs text-gray-400 mt-1 truncate">{periodMonthsLabel}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 xl:p-4 min-w-0">
        <p className="text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Collections (period)</p>
        <p className="text-lg xl:text-2xl font-bold text-gray-900 truncate">{formatCurrency(metrics.period.collections)}</p>
        <p className="text-[10px] xl:text-xs text-gray-400 mt-1 truncate">Payment / R-Payment net</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 xl:p-4 min-w-0">
        <p className="text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Avg Monthly Collections</p>
        <p className="text-lg xl:text-2xl font-bold text-gray-900 truncate">{formatCurrency(avgMonthlyCollections)}</p>
        <p className="text-[10px] xl:text-xs text-gray-400 mt-1 truncate">{periodMonthsLabel}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-3 xl:p-4 min-w-0">
        <p className="text-[10px] xl:text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 truncate">Collection Rate</p>
        <p className="text-lg xl:text-2xl font-bold text-gray-900 truncate">
          {metrics.period.collectionRate === null
            ? 'N/A'
            : `${metrics.period.collectionRate.toFixed(1)}%`}
        </p>
        <p className="text-[10px] xl:text-xs text-gray-400 mt-1 truncate">Collections / Net Sales</p>
      </div>
    </div>
  );
}
