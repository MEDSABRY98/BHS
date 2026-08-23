'use client';

import { DollarSign, Package, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
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
import type { ChartDataRow, DashboardMetrics } from '../Types';

interface DashboardTabProps {
  dashboardMetrics: DashboardMetrics;
  chartData: ChartDataRow[];
}

export default function DashboardTab({ dashboardMetrics, chartData }: DashboardTabProps) {
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto pb-1">
        <div className="grid grid-cols-7 gap-4 min-w-[1120px]">
          <div
            className={`bg-white rounded-xl border p-5 min-w-0 ${
              dashboardMetrics.daysSinceLastInvoice !== null && dashboardMetrics.daysSinceLastInvoice > 5
                ? 'border-red-500'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 leading-tight">Last Invoice Date</h3>
              <Calendar
                className={`w-5 h-5 shrink-0 ${
                  dashboardMetrics.daysSinceLastInvoice !== null && dashboardMetrics.daysSinceLastInvoice > 5
                    ? 'text-red-600'
                    : 'text-gray-600'
                }`}
              />
            </div>
            {dashboardMetrics.lastInvoiceDate ? (
              <div>
                <p className="text-lg font-bold text-gray-800 mb-1">
                  {dashboardMetrics.lastInvoiceDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <p
                  className={`text-sm font-medium ${
                    dashboardMetrics.daysSinceLastInvoice !== null && dashboardMetrics.daysSinceLastInvoice > 5
                      ? 'text-red-600 font-bold'
                      : 'text-gray-600'
                  }`}
                >
                  {dashboardMetrics.daysSinceLastInvoice !== null
                    ? `${dashboardMetrics.daysSinceLastInvoice} days ago`
                    : '-'}
                </p>
              </div>
            ) : (
              <p className="text-xl font-bold text-gray-400">-</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 leading-tight">Active Months</h3>
              <BarChart3 className="w-5 h-5 text-teal-600 shrink-0" />
            </div>
            <p className="text-xl font-bold text-gray-800">{dashboardMetrics.uniqueMonths}</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 leading-tight">Total Sales Amount</h3>
              <DollarSign className="w-5 h-5 text-green-600 shrink-0" />
            </div>
            <p className="text-xl font-bold text-gray-800">
              {dashboardMetrics.totalAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 leading-tight">Avg Monthly Amount</h3>
              <TrendingUp className="w-5 h-5 text-purple-600 shrink-0" />
            </div>
            <p className="text-xl font-bold text-gray-800">
              {dashboardMetrics.avgMonthlyAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 leading-tight">Total Quantity</h3>
              <Package className="w-5 h-5 text-blue-600 shrink-0" />
            </div>
            <p className="text-xl font-bold text-gray-800">
              {dashboardMetrics.totalQty.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 leading-tight">Avg Monthly Quantity</h3>
              <TrendingUp className="w-5 h-5 text-orange-600 shrink-0" />
            </div>
            <p className="text-xl font-bold text-gray-800">
              {dashboardMetrics.avgMonthlyQty.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-600 leading-tight">Total Products</h3>
              <Package className="w-5 h-5 text-indigo-600 shrink-0" />
            </div>
            <p className="text-xl font-bold text-gray-800">{dashboardMetrics.uniqueProducts}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-6">Monthly Sales Performance Comparison</h2>
        {chartData.length > 0 ? (
          <div className="rounded-lg border border-gray-200 p-4 overflow-hidden">
            <div className="relative w-full" style={{ height: '550px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 80, right: 30, left: 40, bottom: 20 }} barGap={8}>
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
                        const data = payload[0].payload;
                        const isPositive = data.isPositive;
                        return (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 min-w-[180px]">
                            <p className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{label}</p>
                            <div className="space-y-2 text-sm">
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">{data.legendPrev}:</span>
                                <span className="font-bold text-slate-700">
                                  {data.prevAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">{data.legendCurr}:</span>
                                <span className="font-bold text-emerald-600">
                                  {data.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">Diff:</span>
                                <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isPositive ? '+' : '-'}
                                  {Math.abs(data.diff).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 font-medium w-20 inline-block">Growth:</span>
                                <span className={`font-black ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {isPositive ? '+' : '-'}
                                  {data.percent.toFixed(1)}%
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

                  <Bar
                    dataKey="prevAmount"
                    name={chartData[0]?.legendPrev || 'Last Year'}
                    fill="#cbd5e1"
                    radius={[4, 4, 0, 0]}
                    barSize={45}
                  >
                    <LabelList
                      dataKey="prevAmount"
                      position="top"
                      formatter={(val: any) => val ? Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }) : ''}
                      style={{ fontSize: '13px', fontWeight: '900', fill: '#64748b' }}
                      offset={10}
                    />
                  </Bar>

                  <Bar
                    dataKey="currentAmount"
                    name={chartData[0]?.legendCurr || 'Current Year'}
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    barSize={45}
                  >
                    <LabelList
                      dataKey="currentAmount"
                      position="top"
                      formatter={(val: any) => val ? Number(val).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 }) : ''}
                      style={{ fontSize: '13px', fontWeight: '900', fill: '#059669' }}
                      offset={10}
                    />
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isPositive ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>

                  <Line type="monotone" dataKey="topBaseline" stroke="none" dot={false} activeDot={false} legendType="none">
                    <LabelList
                      dataKey="diff"
                      content={(props: any) => {
                        const { x, index } = props;
                        const entry = chartData[index ?? 0];
                        if (!entry || x === undefined) return null;

                        const isPositive = entry.isPositive;
                        const isFuture = entry.isFuture && entry.currentAmount === 0;
                        const color = isFuture ? '#94a3b8' : isPositive ? '#059669' : '#e11d48';

                        const diffStr = isFuture
                          ? '-'
                          : (isPositive ? '▲ +' : '▼ ') +
                            Math.abs(entry.diff).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
                        const percentStr = isFuture ? '' : entry.percent.toFixed(1) + '%';

                        return (
                          <g style={{ pointerEvents: 'none' }}>
                            <rect
                              x={x - 45}
                              y={10}
                              width={90}
                              height={55}
                              rx={12}
                              fill={isFuture ? '#f8fafc' : isPositive ? '#f0fdf4' : '#fef2f2'}
                              stroke={isFuture ? '#e2e8f0' : isPositive ? '#bcf0da' : '#fecaca'}
                              strokeWidth={1}
                              className=""
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
        ) : (
          <NoData />
        )}
      </div>
    </div>
  );
}
