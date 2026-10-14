'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Banknote, CreditCard, Users, Percent } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';
import { Change, ComputeCollections, DaysSince } from '../Utils/SalespersonAggregations';
import { FmtDay, GOLD, INK, KpiCard, Money, Panel, SLATE, ShortMoney, SimpleTable, Whole } from '../Utils/Cards';

export default function CollectionsTab() {
  const { data } = UseSalespersonData();
  const c = useMemo(() => (data ? ComputeCollections(data) : null), [data]);
  const [view, setView] = useState<'customers' | 'unpaid'>('customers');

  if (!data || !c) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard
          label="Net Collected"
          value={Money(c.cur.net)}
          icon={<Banknote className="w-5 h-5" />}
          accent="gold"
          change={Change(c.cur.net, c.prev.net)}
          previous={Money(c.prev.net)}
        />
        <KpiCard
          label="Payments"
          value={Whole(c.cur.payments)}
          icon={<CreditCard className="w-5 h-5" />}
          accent="ink"
          change={Change(c.cur.payments, c.prev.payments)}
          previous={Whole(c.prev.payments)}
          hint={`Avg payment ${Money(c.cur.avgPayment)}`}
        />
        <KpiCard
          label="Paying Customers"
          value={Whole(c.cur.customers)}
          icon={<Users className="w-5 h-5" />}
          accent="green"
          change={Change(c.cur.customers, c.prev.customers)}
          previous={Whole(c.prev.customers)}
        />
        <KpiCard
          label="Collection Rate"
          value={c.collectionRate === null ? '-' : `${c.collectionRate.toFixed(1)}%`}
          icon={<Percent className="w-5 h-5" />}
          accent="slate"
          hint="Net collected ÷ net sales in the period"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Monthly Collections" subtitle="This period vs same months last year">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={ShortMoney} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v: any) => Money(Number(v))} cursor={{ fill: '#F8FAFC' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="current" name="This period" fill={GOLD} radius={[6, 6, 0, 0]} />
                <Bar dataKey="previous" name="Last year" fill={SLATE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Sales vs Collections" subtitle="Net sales and net collected per month">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={c.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={ShortMoney} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v: any) => Money(Number(v))} cursor={{ fill: '#F8FAFC' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="sales" name="Net Sales" fill={INK} radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="current" name="Collected" stroke={GOLD} strokeWidth={3} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel
        title={view === 'customers' ? 'Collections per Customer' : 'Customers Who Did Not Pay'}
        subtitle={
          view === 'customers'
            ? 'Net collected in the period'
            : 'Balance and no payment in the period'
        }
        right={
          <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
            {(
              [
                ['customers', `Customers (${c.customers.length})`],
                ['unpaid', `Did Not Pay (${c.unpaid.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${view === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {view === 'customers' ? (
          <SimpleTable
            rows={c.customers}
            columns={[
              { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { header: 'Customer', cell: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
              { header: 'City', cell: (r) => r.city },
              { header: 'Net Collection', cell: (r) => <span className="font-mono font-bold">{Money(r.net)}</span> },
              { header: 'Payments', cell: (r) => Whole(r.payments) },
              { header: 'Last Payment', cell: (r) => FmtDay(r.last) },
            ]}
            footer={['', 'TOTAL', '', Money(c.customers.reduce((s, r) => s + r.net, 0)), Whole(c.cur.payments), '']}
          />
        ) : (
          <SimpleTable
            rows={c.unpaid}
            empty="Every customer with a balance paid in this period"
            columns={[
              { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { header: 'Customer', cell: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
              { header: 'City', cell: (r) => r.city },
              { header: 'Balance', cell: (r) => <span className="font-mono font-bold">{Money(r.balance)}</span> },
              {
                header: 'Last Payment',
                cell: (r) => (r.lastPayment ? FmtDay(r.lastPayment) : <span className="text-red-600 font-semibold">Never</span>),
              },
              {
                header: 'Days Since',
                cell: (r) => {
                  const days = DaysSince(r.lastPayment);
                  if (days === null) return '-';
                  return <span className={days > 90 ? 'text-red-600 font-bold' : days > 30 ? 'text-amber-600 font-semibold' : ''}>{Whole(days)}</span>;
                },
              },
            ]}
            footer={['', 'TOTAL', '', Money(c.unpaid.reduce((s, r) => s + r.balance, 0)), '', '']}
          />
        )}
      </Panel>
    </div>
  );
}
