'use client';

import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Wallet, AlertTriangle, Clock, Users, Search, Tag } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';
import { AGING_BUCKETS, ComputeDebit, DaysSince, LedgerOverdueAbove } from '../Utils/SalespersonAggregations';
import { FmtDay, KpiCard, Money, Panel, ShortMoney, SimpleTable, Whole } from '../Utils/Cards';
import { CustomerLink, CustomerPopup } from '../Utils/CustomerPopup';

const BUCKET_COLORS = ['#059669', '#D4AF37', '#F59E0B', '#F97316', '#EF4444', '#991B1B'];

export default function DebitTab() {
  const { data: allData, agingMode, setAgingMode, minDays } = UseSalespersonData();
  // "Overdue > N days" box (next to the Debit header): every number shows only the debit older than N days
  // (same day count as the aging: Days = past the due date, Months = invoice month + payment term)
  const data = useMemo(() => {
    if (!allData || !(minDays > 0)) return allData;
    return { ...allData, ledger: LedgerOverdueAbove(allData, minDays, agingMode) };
  }, [allData, minDays, agingMode]);
  const d = useMemo(() => (data ? ComputeDebit(data, agingMode) : null), [data, agingMode]);
  const [search, setSearch] = useState('');
  const [popup, setPopup] = useState<string | null>(null);
  // same views as Customers Analysis → Payment Terms: Default (all) · No Tags · Tags Only (grouped by tag, A-Z)
  const [view, setView] = useState<'DEFAULT' | 'NO TAGS' | 'TAGS ONLY'>('DEFAULT');

  const customers = useMemo(() => {
    if (!d) return [];
    const q = search.trim().toLowerCase();
    return q ? d.customers.filter((c) => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)) : d.customers;
  }, [d, search]);

  const tagsOf = (name: string) => data?.tagsByCustomer?.[name] || [];
  const noTagCustomers = useMemo(() => customers.filter((c) => !tagsOf(c.name).length), [customers, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const tagGroups = useMemo(() => {
    const map = new Map<string, typeof customers>();
    for (const c of customers) for (const t of tagsOf(c.name)) map.set(t, [...(map.get(t) || []), c]);
    return [...map]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(([tag, list]) => ({ tag, list: [...list].sort((x, y) => x.name.localeCompare(y.name, undefined, { sensitivity: 'base' })) }));
  }, [customers, data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !d) return null;

  type CustomerRow = (typeof customers)[number];
  const customerColumns: { header: string; cell: (r: CustomerRow, i: number) => React.ReactNode; className?: string }[] = [
            { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
            { header: 'Customer', cell: (r) => <CustomerLink name={r.name} onOpen={setPopup} /> },
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
          ];
  const totalsRow = (list: CustomerRow[]): React.ReactNode[] => [
            '',
            'TOTAL',
            '',
            Money(list.reduce((s, c) => s + c.balance, 0)),
            ...AGING_BUCKETS.map((b) => Money(list.reduce((s, c) => s + (c.aging[b.key] || 0), 0))),
            '',
          ];

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
        subtitle={`${view === 'NO TAGS' ? noTagCustomers.length : customers.length} customers${minDays > 0 ? ` • debit older than ${minDays} days only` : ''}`}
        right={
          <div className="flex items-center gap-2">
          <div className="grid grid-cols-3 bg-slate-100 rounded-xl p-1 gap-1">
            {(['DEFAULT', 'NO TAGS', 'TAGS ONLY'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`w-24 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-center transition-all ${view === v ? 'bg-slate-900 text-[#D4AF37]' : 'text-slate-500 hover:text-slate-800'}`}
                title={v === 'DEFAULT' ? 'All customers by balance' : v === 'NO TAGS' ? 'Customers without a tag' : 'Tagged customers grouped by tag, A-Z'}
              >
                {v === 'DEFAULT' ? 'Default' : v === 'NO TAGS' ? 'No Tags' : 'Tags Only'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer or city..."
              className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37] w-56"
            />
          </div>
          </div>
        }
      >
        {view === 'DEFAULT' ? (
          <SimpleTable rows={customers} columns={customerColumns} footer={totalsRow(customers)} />
        ) : view === 'NO TAGS' ? (
          <SimpleTable rows={noTagCustomers} columns={customerColumns} footer={totalsRow(noTagCustomers)} empty="No customers without a tag" />
        ) : !tagGroups.length ? (
          <div className="text-center text-slate-400 py-10 font-medium">No tagged customers</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  {customerColumns.map((c) => (
                    <th key={c.header} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap">
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tagGroups.map((g) => {
                  const tot = totalsRow(g.list);
                  return (
                    <React.Fragment key={g.tag}>
                      {/* tag header row with the tag's totals */}
                      <tr className="bg-slate-200 text-slate-800">
                        <td colSpan={3} className="px-3 py-2.5 text-left border-y border-slate-300">
                          <span className="inline-flex items-center gap-2">
                            <Tag className="w-4 h-4 text-slate-500" />
                            <span className="font-black">{g.tag}</span>
                            <span className="text-xs font-semibold text-slate-500">
                              ({g.list.length} customer{g.list.length === 1 ? '' : 's'})
                            </span>
                          </span>
                        </td>
                        {tot.slice(3).map((v, i) => (
                          <td key={i} className="px-3 py-2.5 text-center font-mono font-black border-y border-slate-300">
                            {v}
                          </td>
                        ))}
                      </tr>
                      {g.list.map((r, i) => (
                        <tr key={`${g.tag}|${r.name}`} className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40">
                          {customerColumns.map((c) => (
                            <td key={c.header} className="px-3 py-2 text-center text-slate-700">
                              {c.cell(r, i)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              {/* grand total of the tagged customers (each customer counted once) */}
              <tfoot>
                <tr className="bg-slate-900 text-white font-black">
                  {totalsRow(customers.filter((c) => tagsOf(c.name).length)).map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-center font-mono">
                      {v}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
      <CustomerPopup name={popup} onClose={() => setPopup(null)} mode="debit" />
    </div>
  );
}
