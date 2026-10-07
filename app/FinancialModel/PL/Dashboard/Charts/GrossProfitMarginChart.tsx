'use client';
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface GrossProfitMarginChartProps { data: any[]; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const actual = payload.find((p: any) => p.dataKey === 'Actual Margin')?.value || 0;
    const forecast = payload.find((p: any) => p.dataKey === 'Forecast Margin')?.value || 0;
    const diff = actual - forecast;
    const diffColor = diff >= 0 ? 'text-emerald-500' : 'text-red-500';
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 min-w-[180px]">
        <p className="font-black text-slate-900 mb-2 text-sm border-b border-slate-100 pb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-400" />Actual</span>
            <span className="text-xs font-black text-slate-800 tabular-nums">{actual.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />Forecast</span>
            <span className="text-xs font-black text-slate-800 tabular-nums">{forecast.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 gap-4">
            <span className="text-xs font-bold text-slate-600">Variance</span>
            <span className={`text-xs font-black tabular-nums ${diffColor}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function GrossProfitMarginChart({ data }: GrossProfitMarginChartProps) {
  const avgActual = data.length ? data.reduce((s, d) => s + (d['Actual Margin'] || 0), 0) / data.length : 0;
  const avgForecast = data.length ? data.reduce((s, d) => s + (d['Forecast Margin'] || 0), 0) / data.length : 0;
  const diff = avgActual - avgForecast;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[380px]">
      <div className="bg-gradient-to-r from-teal-50 to-white px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Profit Margin</p>
          <p className="text-base font-black text-slate-900 tabular-nums mt-0.5">Avg {avgActual.toFixed(1)}%</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Forecast Avg</p>
            <p className="text-sm font-black text-blue-500 tabular-nums">{avgForecast.toFixed(1)}%</p>
          </div>
          <span className={`text-xs font-black px-2 py-1 rounded-lg ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
          </span>
        </div>
      </div>
      <div className="flex-1 p-4 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gpMarginActualArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gpMarginForecastArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="Actual Margin" stroke="#14b8a6" strokeWidth={2.5} fill="url(#gpMarginActualArea)" dot={{ r: 3, fill: '#14b8a6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
            <Area type="monotone" dataKey="Forecast Margin" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 4" fill="url(#gpMarginForecastArea)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
