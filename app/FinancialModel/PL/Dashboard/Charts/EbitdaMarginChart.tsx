'use client';
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EbitdaMarginChartProps { data: any[]; }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const actual = payload.find((p: any) => p.dataKey === 'Actual Margin')?.value || 0;
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 min-w-[150px]">
        <p className="font-black text-slate-900 mb-2 text-sm border-b border-slate-100 pb-2">{label}</p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-4">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500" />Actual</span>
            <span className="text-xs font-black text-slate-800 tabular-nums">{actual.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function EbitdaMarginChart({ data }: EbitdaMarginChartProps) {
  const avgActual = data.length ? data.reduce((s, d) => s + (d['Actual Margin'] || 0), 0) / data.length : 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-[380px]">
      <div className="bg-gradient-to-r from-indigo-50 to-white px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">EBITDA Margin</p>
          <p className="text-base font-black text-slate-900 tabular-nums mt-0.5">Avg {avgActual.toFixed(1)}%</p>
        </div>
      </div>
      <div className="flex-1 p-4 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="ebitdaMarginActualArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 700 }} dy={8} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />
            <Area type="monotone" dataKey="Actual Margin" stroke="#6366f1" strokeWidth={2.5} fill="url(#ebitdaMarginActualArea)" dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
