'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, Package, Users, DollarSign, BarChart3, MapPin, ShoppingBag, UserCircle, Download, Filter, X } from 'lucide-react';
import { useSalesModuleFilters } from '@/app/Sales/Model/SalesFilters';
import { useSalesDataContext } from '@/app/Sales/Context/SalesDataContext';
import { useSalesTabFetch } from '@/app/Sales/Hooks/useSalesTabFetch';
import { getOverviewData } from '@/app/Sales/Service/sales_core_service';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import SalesTabLoader from '@/app/Sales/Shared/TabLoader';
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
  Line,
} from 'recharts';

interface SalesOverviewTabProps {
  userId: string;
  showCosts?: boolean;
}

export default function SalesOverviewTab({ userId, showCosts = true }: SalesOverviewTabProps) {
  const { commonFilters: filters } = useSalesModuleFilters();
  const { dataVersion } = useSalesDataContext();
  const { data, isInitialLoading, isRefreshing, error, reload, loading } = useSalesTabFetch<{
    metrics: any;
      chartDataVsLastYear: any[];
      chartDataVsLastMonth: any[];
      chartDataVsTarget: any[];
      yearlyTableData: any[];
      monthlyTableData: any[];
  } | null>({
    tabKey: 'overview',
    userId,
    filters,
    dataVersion,
    fetcher: () => getOverviewData(userId, filters),
  });

  if (isInitialLoading) {
    return <SalesTabLoader />;
  }

  if (error) {
    return (
      <TabFetchError
        message={error}
        onRetry={() => void reload()}
        isRetrying={loading}
        className="min-h-[360px]"
      />
    );
  }

  if (!data) {
    return <SalesTabLoader />;
  }

  const { metrics, chartDataVsLastYear, chartDataVsLastMonth, chartDataVsTarget, yearlyTableData, monthlyTableData } = data;

  const renderChart = (title: string, dataArray: any[]) => {
    if (!dataArray || dataArray.length === 0) return <NoData />;
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8 overflow-hidden">
        <h2 className="text-xl font-bold text-gray-800 mb-6">{title}</h2>
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 shadow-md overflow-hidden">
          <div className="relative w-full" style={{ height: '550px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dataArray}
                margin={{ top: 80, right: 30, left: 40, bottom: 20 }}
                barGap={8}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#475569"
                  style={{ fontSize: '15px', fontWeight: 900 }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis hide={true} domain={[0, 'auto']} />
                <Tooltip
                  content={(props: any) => {
                    const { active, payload, label } = props;
                    if (active && payload && payload.length > 0) {
                      const d = payload[0].payload;
                      const isPositive = d.isPositive;
                      return (
                        <div className="bg-white p-4 rounded-xl shadow-xl border border-gray-100 min-w-[180px]">
                          <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{label}</p>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-gray-500 font-medium w-20 inline-block">{d.legendPrev}:</span>
                              <span className="font-bold text-slate-700">
                                {d.prevAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 font-medium w-20 inline-block">{d.legendCurr}:</span>
                              <span className="font-bold text-blue-600">
                                {d.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 font-medium w-20 inline-block">Diff:</span>
                              <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPositive ? '+' : '-'}{Math.abs(d.diff).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500 font-medium w-20 inline-block">Growth:</span>
                              <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isPositive ? '+' : '-'}{d.percent.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={36} />

                {/* Previous Bar */}
                <Bar
                  dataKey="prevAmount"
                  name={dataArray[0]?.legendPrev || 'Compare'}
                  fill="#cbd5e1"
                  radius={[4, 4, 0, 0]}
                  barSize={45}
                >
                  <LabelList
                    dataKey="prevAmount"
                    position="top"
                    formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                    style={{ fontSize: '13px', fontWeight: '900', fill: '#64748b' }}
                    offset={10}
                  />
                </Bar>

                {/* Current Bar — colored green/red per month */}
                <Bar
                  dataKey="currentAmount"
                  name={dataArray[0]?.legendCurr || 'Current'}
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  barSize={45}
                >
                  <LabelList
                    dataKey="currentAmount"
                    position="top"
                    formatter={(val: any) => (val === 0 || !val) ? '' : Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 })}
                    style={{ fontSize: '13px', fontWeight: '900', fill: '#059669' }}
                    offset={10}
                  />
                  {dataArray.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isPositive ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>

                {/* Hidden line used only to render the top card labels */}
                <Line
                  type="monotone"
                  dataKey="topBaseline"
                  stroke="none"
                  dot={false}
                  activeDot={false}
                  legendType="none"
                >
                  <LabelList
                    dataKey="diff"
                    content={(props: any) => {
                      const { x, index } = props;
                      const entry = dataArray[index];
                      if (!entry) return null;

                      const isPositive = entry.isPositive;
                      const isFuture = entry.isFuture && entry.currentAmount === 0;
                      const color = isFuture ? '#94a3b8' : (isPositive ? '#059669' : '#e11d48');
                      const diffStr = isFuture ? '-' : ((isPositive ? '▲ +' : '▼ ') + Math.abs(entry.diff).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }));
                      const percentStr = isFuture ? '' : (entry.percent.toFixed(1) + '%');

                      return (
                        <g style={{ pointerEvents: 'none' }}>
                          <rect
                            x={x - 45}
                            y={10}
                            width={90}
                            height={55}
                            rx={12}
                            fill={isFuture ? '#f8fafc' : (isPositive ? '#f0fdf4' : '#fef2f2')}
                            stroke={isFuture ? '#e2e8f0' : (isPositive ? '#bcf0da' : '#fecaca')}
                            strokeWidth={1.5}
                          />
                          <text
                            x={x}
                            y={isFuture ? 42 : 35}
                            fill={color}
                            textAnchor="middle"
                            style={{ fontSize: isFuture ? '20px' : '14px', fontWeight: '900' }}
                          >
                            {diffStr}
                          </text>
                          {!isFuture && (
                            <text
                              x={x}
                              y={55}
                              fill={color}
                              textAnchor="middle"
                              style={{ fontSize: '12px', fontWeight: '800', opacity: 0.8 }}
                            >
                              {percentStr}
                            </text>
                          )}
                        </g>
                      );
                    }}
                  />
                </Line>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-2xl font-medium text-slate-800">Sales Overview</h1>
      </div>


      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Total Sales</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.totalAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-indigo-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">AVG AMOUNT / MON</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.avgMonthlyAmount.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Total Qty</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.totalQty.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <Package className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-cyan-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Avg Qty / Mon</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">
                {metrics.avgMonthlyQty.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <TrendingUp className="w-5 h-5 text-cyan-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Customers</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">{metrics.totalCustomers}</p>
            </div>
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500 hover:shadow-md transition-all duration-300 min-h-[120px] flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-gray-500 mb-1">Products</p>
              <p className="text-xl font-black text-gray-800 tracking-tight">{metrics.totalProducts}</p>
            </div>
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center shrink-0 ml-2">
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Sales Comparison Charts */}
      <div className="flex flex-col gap-8 w-full">
        {renderChart("Monthly Sales vs Last Year", chartDataVsLastYear)}
        {renderChart("Monthly Sales vs Last Month", chartDataVsLastMonth)}
        {renderChart("Monthly Sales vs Target", chartDataVsTarget)}
      </div>
    </div>
  );
}
