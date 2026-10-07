'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EbitdaChartProps { data: any[]; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const actual = payload.find((p: any) => p.dataKey === 'Actual')?.value || 0;
    const forecast = payload.find((p: any) => p.dataKey === 'Forecast')?.value || 0;
    const diff = actual - forecast;
    const diffColor = diff >= 0 ? 'text-emerald-500' : 'text-red-500';
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 min-w-[180px]">
        <p className="font-black text-slate-900 mb-2 text-sm border-b border-slate-100 pb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-teal-400" />Actual</span>
            <span className="text-xs font-black text-slate-800 tabular-nums">{actual.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" />Forecast</span>
            <span className="text-xs font-black text-slate-800 tabular-nums">{forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 gap-4">
            <span className="text-xs font-bold text-slate-600">Variance</span>
            <span className={`text-xs font-black tabular-nums ${diffColor}`}>{diff > 0 ? '+' : ''}{diff.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function EbitdaChart({ data }: EbitdaChartProps) {
  const totalActual = data.reduce((s, d) => s + d.Actual, 0);
  const totalForecast = data.reduce((s, d) => s + d.Forecast, 0);
  const diff = totalActual - totalForecast;
  let diffPercent = 0;
  if (totalForecast !== 0) {
    diffPercent = (diff / Math.abs(totalForecast)) * 100;
  } else if (totalActual > 0) {
    diffPercent = 100;
  } else if (totalActual < 0) {
    diffPercent = -100;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[380px]">
      <div className="bg-gradient-to-r from-indigo-50 to-white px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EBITDA</p>
          <p className="text-base font-black text-slate-900 tabular-nums mt-0.5">{totalActual.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Forecast</p>
            <p className="text-sm font-black text-blue-500 tabular-nums">{totalForecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="flex items-center gap-1.5">
          <span className={`text-xs font-black px-2 py-1 rounded-lg ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {diff > 0 ? '+' : ''}{diff.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
          <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
          </span>
        </div>
        </div>
      </div>
      <div className="flex-1 p-4 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
            <defs>
              <linearGradient id="ebitdaActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                <stop offset="100%" stopColor="#a5b4fc" stopOpacity={0.5} />
              </linearGradient>
              <linearGradient id="ebitdaForecast" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.4} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f0fdfa', radius: 4 }} />
            <Bar dataKey="Actual" fill="url(#ebitdaActual)" radius={[5, 5, 0, 0]} maxBarSize={32} />
            <Bar dataKey="Forecast" fill="url(#ebitdaForecast)" radius={[5, 5, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
