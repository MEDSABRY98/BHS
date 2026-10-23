'use client';

// Collection Quality: when the money came in compared with the invoices' due dates.
// Numbers: SalespersonAggregations → ComputeCollectionQuality (payments split over their matched invoices).

import React, { useCallback, useMemo, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Banknote, Clock, CheckCircle2, Unlink } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';
import { Change, ComputeCollectionQuality, LATENESS_BUCKETS } from '../Utils/SalespersonAggregations';
import { GOLD, KpiCard, Money, Panel, SLATE, ShortMoney, Whole } from '../Utils/Cards';
import { TagViewTable, TagViewToggle, type TagView } from '../Utils/TagViews';
import { CustomerLink, CustomerPopup } from '../Utils/CustomerPopup';

const BUCKET_COLORS = ['#059669', '#D4AF37', '#F59E0B', '#F97316', '#EF4444', '#991B1B'];
const days = (v: number | null) => (v === null ? '-' : `${v.toFixed(1)} days`);
const pct = (v: number | null) => (v === null ? '-' : `${v.toFixed(1)}%`);

export default function QualityTab() {
  const { data } = UseSalespersonData();
  const q = useMemo(() => (data ? ComputeCollectionQuality(data) : null), [data]);
  const [tagView, setTagView] = useState<TagView>('DEFAULT');
  const [popup, setPopup] = useState<string | null>(null);
  const tagsOf = useCallback((name: string) => data?.tagsByCustomer?.[name] || [], [data]);
  const nameOf = useCallback((r: { name: string }) => r.name, []);

  if (!data || !q) return null;
  const { cur, prev } = q;
  const bucketRows = LATENESS_BUCKETS.map((b) => ({
    label: b.label === 'On Time' ? 'On Time' : `${b.label} late`,
    amount: cur.buckets[b.key],
    share: cur.applied ? (cur.buckets[b.key] / cur.applied) * 100 : 0,
  }));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <KpiCard
          label="Avg Days Late"
          value={days(cur.avgDaysLate)}
          icon={<Clock className="w-5 h-5" />}
          accent="red"
          change={cur.avgDaysLate !== null && prev.avgDaysLate !== null ? Change(cur.avgDaysLate, prev.avgDaysLate) : undefined}
          invertChange
          previous={days(prev.avgDaysLate)}
          hint="Aged by months (invoice month + payment term) on the payment date, weighted by amount"
        />
        <KpiCard
          label="Paid On Time"
          value={pct(cur.onTimePct)}
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="green"
          previous={pct(prev.onTimePct)}
          hint="Of the money matched to invoices"
        />
        <KpiCard
          label="Unapplied Payments"
          value={pct(cur.unappliedPct)}
          icon={<Unlink className="w-5 h-5" />}
          accent="slate"
          hint={`${Money(cur.unapplied)} not matched to invoices`}
        />
        <KpiCard
          label="Collected"
          value={Money(cur.total)}
          icon={<Banknote className="w-5 h-5" />}
          accent="gold"
          change={Change(cur.total, prev.total)}
          previous={Money(prev.total)}
          hint={`${Money(cur.applied)} matched to invoices`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Collected by Lateness" subtitle="Money matched to invoices, aged by months: invoice month + payment term, from the 1st of the next month">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketRows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={ShortMoney} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip
                  formatter={(v: any, _n: any, p: any) => [`${Money(Number(v))} (${(p?.payload?.share ?? 0).toFixed(1)}%)`, 'Collected']}
                  cursor={{ fill: '#F8FAFC' }}
                />
                <Bar dataKey="amount" name="Collected" radius={[6, 6, 0, 0]}>
                  {bucketRows.map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Avg Days Late per Month" subtitle="This period vs same months last year (lower is better)">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={q.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip formatter={(v: any) => (v === null || v === undefined ? '-' : `${v} days`)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="current" name="This period" stroke={GOLD} strokeWidth={3} dot={{ r: 3 }} connectNulls />
                <Line type="monotone" dataKey="previous" name="Last year" stroke={SLATE} strokeWidth={2} dot={{ r: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Customers" subtitle="Who pays on time and who pays late (period)" right={<TagViewToggle view={tagView} onChange={setTagView} />}>
        <TagViewTable
          view={tagView}
          rows={q.customers}
          nameOf={nameOf}
          tagsOf={tagsOf}
          empty="No collections in this period"
          columns={[
            { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
            { header: 'Customer', cell: (r) => <CustomerLink name={r.name} onOpen={setPopup} /> },
            { header: 'Payments', cell: (r) => Whole(r.payments) },
            { header: 'Collected', cell: (r) => <span className="font-mono font-bold">{Money(r.collected)}</span> },
            {
              header: 'Avg Days Late',
              cell: (r) =>
                r.avgDaysLate === null ? (
                  '-'
                ) : (
                  <span className={r.avgDaysLate > 60 ? 'text-red-600 font-bold' : r.avgDaysLate > 30 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                    {r.avgDaysLate.toFixed(0)}
                  </span>
                ),
            },
            { header: 'On Time', cell: (r) => pct(r.onTimePct) },
            { header: 'Unapplied', cell: (r) => (r.unapplied > 0.01 ? <span className="font-mono text-slate-500">{Money(r.unapplied)}</span> : '-') },
          ]}
          totals={(list) => {
            const applied = list.reduce((s, r) => s + r.applied, 0);
            const weighted = list.reduce((s, r) => s + (r.avgDaysLate ?? 0) * r.applied, 0);
            const onTime = list.reduce((s, r) => s + ((r.onTimePct ?? 0) / 100) * r.applied, 0);
            return [
              '',
              'TOTAL',
              Whole(list.reduce((s, r) => s + r.payments, 0)),
              Money(list.reduce((s, r) => s + r.collected, 0)),
              applied ? (weighted / applied).toFixed(0) : '-',
              applied ? `${((onTime / applied) * 100).toFixed(1)}%` : '-',
              Money(list.reduce((s, r) => s + r.unapplied, 0)),
            ];
          }}
        />
      </Panel>
      <CustomerPopup name={popup} onClose={() => setPopup(null)} mode="debit" />
    </div>
  );
}
