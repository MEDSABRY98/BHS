'use client';

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Wallet, AlertTriangle, Clock, Users, Search } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';
import { AGING_BUCKETS, ComputeDebit, DaysSince } from '../Utils/SalespersonAggregations';
import { FmtDay, KpiCard, Money, Panel, ShortMoney, SimpleTable, Whole } from '../Utils/Cards';

const BUCKET_COLORS = ['#059669', '#D4AF37', '#F59E0B', '#F97316', '#EF4444', '#991B1B'];

export default function DebitTab() {
  const { data, agingMode, setAgingMode } = UseSalespersonData();
  const d = useMemo(() => (data ? ComputeDebit(data, agingMode) : null), [data, agingMode]);
  const [search, setSearch] = useState('');

  const customers = useMemo(() => {
    if (!d) return [];
    const q = search.trim().toLowerCase();
    return q ? d.customers.filter((c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)) : d.customers;
  }, [d, search]);

  if (!data || !d) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-start">
        <div className="grid grid-cols-2 bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-sm">
          {(['days', 'months'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setAgingMode(m)}
              className={`w-24 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${agingMode === m ? 'bg-slate-900 text-[#D4AF37]' : 'text-slate-500 hover:text-slate-800'}`}
              title={m === 'days' ? 'Aged from the due date' : 'Invoice month + payment term, from the 1st of the next month'}
            >
              {m === 'days' ? 'Days' : 'Months'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard label="Open Debit" value={Money(d.openDebit)} icon={<Wallet className="w-5 h-5" />} accent="gold" hint="His share of the customers' balances" />
        <KpiCard
          label="Overdue"
          value={Money(d.overdue)}
          icon={<AlertTriangle className="w-5 h-5" />}
          accent="red"
          hint={`${d.overduePct.toFixed(1)}% of open debit`}
        />
        <KpiCard
          label="Over 90 Days"
          value={Money(d.over90)}
          icon={<Clock className="w-5 h-5" />}
          accent="ink"
          hint={`${d.over90Pct.toFixed(1)}% of open debit`}
        />
        <KpiCard label="Customers with Debit" value={Whole(d.customersCount)} icon={<Users className="w-5 h-5" />} accent="slate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Debit Aging" subtitle={agingMode === 'days' ? 'By days past the due date' : 'By invoice month + payment term'}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={ShortMoney} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v: any) => Money(Number(v))} cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="amount" name="Amount" radius={[6, 6, 0, 0]}>
                  {d.buckets.map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Debit by City">
          <SimpleTable
            rows={d.cities}
            columns={[
              { header: 'City', cell: (r) => <span className="font-bold text-slate-900">{r.city}</span> },
              { header: 'Open Debit', cell: (r) => <span className="font-mono font-bold">{Money(r.balance)}</span> },
              { header: 'Share', cell: (r) => (d.openDebit ? `${((r.balance / d.openDebit) * 100).toFixed(1)}%` : '-') },
              { header: 'Customers', cell: (r) => Whole(r.customers) },
            ]}
          />
        </Panel>
      </div>

      <Panel
        title="Customers Debit"
        subtitle={`${customers.length} customers`}
        right={
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer or city..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37] w-56"
            />
          </div>
        }
      >
        <SimpleTable
          rows={customers}
          columns={[
            { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
            { header: 'Customer', cell: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
            { header: 'City', cell: (r) => r.city },
            { header: 'Balance', cell: (r) => <span className="font-mono font-black text-slate-900">{Money(r.balance)}</span> },
            ...AGING_BUCKETS.map((b, i) => ({
              header: b.label,
              cell: (r: (typeof customers)[number]) => {
                const v = r.aging[b.key] || 0;
                return Math.abs(v) < 0.01 ? (
                  <span className="text-slate-300">-</span>
                ) : (
                  <span className={`font-mono ${i >= 4 ? 'text-red-600 font-bold' : i >= 2 ? 'text-amber-600' : ''}`}>{Money(v)}</span>
                );
              },
            })),
            {
              header: 'Last Payment',
              cell: (r) => {
                const days = DaysSince(r.lastPayment);
                return r.lastPayment ? (
                  <span className={days !== null && days > 90 ? 'text-red-600 font-semibold' : days !== null && days > 30 ? 'text-amber-600' : ''}>
                    {FmtDay(r.lastPayment)}
                  </span>
                ) : (
                  <span className="text-red-600 font-semibold">Never</span>
                );
              },
            },
          ]}
          footer={[
            '',
            'TOTAL',
            '',
            Money(customers.reduce((s, c) => s + c.balance, 0)),
            ...AGING_BUCKETS.map((b) => Money(customers.reduce((s, c) => s + (c.aging[b.key] || 0), 0))),
            '',
          ]}
        />
      </Panel>
    </div>
  );
}
