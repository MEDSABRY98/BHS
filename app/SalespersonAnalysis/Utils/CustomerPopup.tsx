'use client';

// Customer popup: click a customer name → open debit by invoice month (bars).
// Used by Debit, Collections and Collection Quality (mode 'collections' = collected per month, kept for later).

import React, { useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { UserRound, X } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';
import { CustomerMonthly } from './SalespersonAggregations';
import { FmtDay, GOLD, INK, Money, ShortMoney, Whole } from './Cards';

/** The customer name as a link that opens the popup. */
export function CustomerLink({ name, onOpen }: { name: string; onOpen: (name: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(name)}
      className="font-bold text-slate-900 hover:text-[#B8860B] hover:underline underline-offset-2 text-center"
      title="Open debit and collections by month"
    >
      {name}
    </button>
  );
}

export function CustomerPopup({ name, onClose, mode }: { name: string | null; onClose: () => void; mode: 'debit' | 'collections' }) {
  const { data } = UseSalespersonData();
  const c = useMemo(() => (data && name ? CustomerMonthly(data, name) : null), [data, name]);

  useEffect(() => {
    if (!name) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [name, onClose]);

  if (!name || !c) return null;
  const openTotal = c.open.filter((r) => r.amount > 1).reduce((s, r) => s + r.amount, 0);
  const collectedTotal = c.collected.filter((r) => r.amount > 1).reduce((s, r) => s + r.amount, 0);

  // months with more than 1 AED only, oldest → newest; amount + share of the total on top of each bar
  const chart = (all: { month: string; amount: number }[], color: string, emptyText: string) => {
    const rows = all.filter((r) => r.amount > 1).sort((a: any, b: any) => String(a.key ?? '').localeCompare(String(b.key ?? ''))); // oldest → newest
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    const data = rows.map((r) => ({ ...r, share: total ? (r.amount / total) * 100 : 0 }));
    if (!data.length) {
      return <div className="h-[120px] flex items-center justify-center text-sm font-medium text-slate-400">{emptyText}</div>;
    }
    // amount on top of the bar, its share right under the amount
    const TopLabel = ({ x, y, width, index }: any) => (
      <g>
        <text x={x + width / 2} y={y - 22} textAnchor="middle" fontSize={14} fontWeight={800} fill="#0F172A">
          {Whole(data[index]?.amount ?? 0)}
        </text>
        <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="#B8860B">
          {`${(data[index]?.share ?? 0).toFixed(1)}%`}
        </text>
      </g>
    );
    return (
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 44, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#475569' }} interval={0} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={ShortMoney} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={55} />
            <Tooltip formatter={(v: any) => Money(Number(v))} cursor={{ fill: '#F8FAFC' }} />
            <Bar dataKey="amount" name="Amount" fill={color} radius={[6, 6, 0, 0]}>
              <LabelList dataKey="amount" content={<TopLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[160] bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center shadow-lg shadow-[#D4AF37]/30">
            <UserRound className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-slate-900 leading-tight truncate">{name}</h3>
            <p className="text-xs font-semibold text-slate-400">
              {c.city || '—'} • Balance {Money(c.balance)} • Last payment {c.lastPayment ? FmtDay(c.lastPayment) : 'Never'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {mode === 'debit' ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="text-sm font-black text-slate-900">Open Debit by Invoice Month</h4>
                <span className="text-xs font-bold text-slate-500">Total {Money(openTotal)}</span>
              </div>
              {chart(c.open, GOLD, 'No open debit')}
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <h4 className="text-sm font-black text-slate-900">Collected per Month</h4>
                <span className="text-xs font-bold text-slate-500">
                  {FmtDay(data!.period.start)} – {FmtDay(data!.period.end)} • Total {Money(collectedTotal)}
                </span>
              </div>
              {chart(c.collected, INK, 'No collections in the period')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
