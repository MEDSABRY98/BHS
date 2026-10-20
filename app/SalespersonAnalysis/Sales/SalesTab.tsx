'use client';

import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Banknote, FileText, Users, Undo2, Receipt } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';
import { Change, ComputeCustomers, ComputeSales, type CustomerLevel } from '../Utils/SalespersonAggregations';
import {
  FmtDay,
  GOLD,
  GrowthText,
  KpiCard,
  Money,
  Panel,
  SLATE,
  ShortMoney,
  SimpleTable,
  Whole,
} from '../Utils/Cards';

/** Last part of the category path: "Almarai / FMCG / Non-Food FMCG / اكياس مهملات" → "اكياس مهملات". */
function ShortCategory(category: string): string {
  const parts = String(category || '').split('/').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : category;
}

export default function SalesTab() {
  const { data } = UseSalespersonData();
  const s = useMemo(() => (data ? ComputeSales(data) : null), [data]);
  const [customerView, setCustomerView] = useState<'top' | 'new' | 'lost'>('top');
  const [customerLevel, setCustomerLevel] = useState<CustomerLevel>('main');
  const cust = useMemo(() => (data ? ComputeCustomers(data, customerLevel) : null), [data, customerLevel]);
  const [productView, setProductView] = useState<'categories' | 'products'>('categories');

  if (!data || !s || !cust) return null;
  const isMain = customerLevel === 'main';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          compact
          label="Net Sales"
          value={Money(s.cur.netSales)}
          icon={<Banknote className="w-5 h-5" />}
          accent="gold"
          change={Change(s.cur.netSales, s.prev.netSales)}
          previous={Money(s.prev.netSales)}
        />
        <KpiCard
          compact
          label="Invoices"
          value={Whole(s.cur.invoices)}
          icon={<FileText className="w-5 h-5" />}
          accent="ink"
          change={Change(s.cur.invoices, s.prev.invoices)}
          previous={Whole(s.prev.invoices)}
        />
        <KpiCard
          compact
          label="Active Customers"
          value={Whole(s.cur.customers)}
          icon={<Users className="w-5 h-5" />}
          accent="green"
          change={Change(s.cur.customers, s.prev.customers)}
          previous={Whole(s.prev.customers)}
        />
        <KpiCard
          compact
          label="Avg Invoice"
          value={Money(s.avgInvoice)}
          icon={<Receipt className="w-5 h-5" />}
          accent="slate"
          change={Change(s.avgInvoice, s.prevAvgInvoice)}
          previous={Money(s.prevAvgInvoice)}
        />
        <KpiCard
          compact
          label="Returns"
          value={Money(s.cur.returns)}
          icon={<Undo2 className="w-5 h-5" />}
          accent="red"
          hint={`${s.returnRate.toFixed(1)}% of gross sales`}
          change={Change(s.cur.returns, s.prev.returns)}
          invertChange
        />
        <KpiCard
          compact
          label="New / Lost Customers"
          value={`${Whole(s.newCustomers.length)} / ${Whole(s.lostCustomers.length)}`}
          icon={<Users className="w-5 h-5" />}
          accent="ink"
          hint="New this period / bought last year but not now"
        />
      </div>

      <Panel title="Monthly Net Sales" subtitle="This period vs same months last year">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={s.monthly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={2}>
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

      <div>
        <Panel title="Sales by City">
          <SimpleTable
            rows={s.cities}
            columns={[
              { header: 'City', cell: (r) => <span className="font-bold text-slate-900">{r.city}</span> },
              { header: 'Net Sales', cell: (r) => <span className="font-mono font-bold">{Money(r.net)}</span> },
              {
                header: 'Share',
                cell: (r) => (s.cur.netSales ? `${((r.net / s.cur.netSales) * 100).toFixed(1)}%` : '-'),
              },
              { header: 'Customers', cell: (r) => Whole(r.customers) },
              { header: 'Invoices', cell: (r) => Whole(r.invoices) },
            ]}
          />
        </Panel>
      </div>

      <Panel
        title="Customers"
        subtitle={
          customerView === 'top'
            ? 'Net sales per customer vs same period last year'
            : customerView === 'new'
              ? 'First purchase inside the period'
              : 'Bought in the same period last year, nothing in this period'
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1">
              {(
                [
                  ['main', 'Main Customer'],
                  ['sub', 'Sub Customer'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCustomerLevel(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${customerLevel === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(
                [
                  ['top', `Top (${cust.topCustomers.length})`],
                  ['new', `New (${cust.newCustomers.length})`],
                  ['lost', `Lost (${cust.lostCustomers.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCustomerView(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${customerView === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      >
        {customerView === 'top' ? (
          <SimpleTable
            rows={cust.topCustomers}
            columns={[
              { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { header: 'Customer', cell: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
              { header: 'City', cell: (r) => r.city },
              ...(isMain ? [{ header: 'Branches', cell: (r: (typeof cust.topCustomers)[number]) => Whole(r.subs) }] : []),
              { header: 'Net Sales', cell: (r) => <span className="font-mono font-bold">{Money(r.net)}</span> },
              { header: 'Last Year', cell: (r) => <span className="font-mono">{Money(r.previous)}</span> },
              { header: 'Growth', cell: (r) => <GrowthText value={r.growth} /> },
              { header: 'Invoices', cell: (r) => Whole(r.invoices) },
            ]}
          />
        ) : customerView === 'new' ? (
          <SimpleTable
            rows={cust.newCustomers}
            empty="No new customers in this period"
            columns={[
              { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { header: 'Customer', cell: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
              { header: 'City', cell: (r) => r.city },
              { header: 'First Purchase', cell: (r) => FmtDay(r.firstPurchase) },
              { header: 'Net Sales', cell: (r) => <span className="font-mono font-bold">{Money(r.net)}</span> },
            ]}
          />
        ) : (
          <SimpleTable
            rows={cust.lostCustomers}
            empty="No lost customers"
            columns={[
              { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { header: 'Customer', cell: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
              { header: 'City', cell: (r) => r.city },
              { header: 'Sales Last Year', cell: (r) => <span className="font-mono font-bold">{Money(r.previous)}</span> },
              { header: 'Last Purchase', cell: (r) => <span className="text-red-600 font-semibold">{FmtDay(r.lastPurchase)}</span> },
            ]}
          />
        )}
      </Panel>

      <Panel
        title={productView === 'categories' ? 'Sales by Category' : 'Sales by Product'}
        subtitle={productView === 'categories' ? 'Net sales in the period vs same period last year' : 'Net sales in the period'}
        right={
          <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1">
            {(
              [
                ['categories', `Categories (${s.categories.length})`],
                ['products', `Products (${s.topProducts.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setProductView(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold text-center transition-all ${productView === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {productView === 'categories' ? (
          <SimpleTable
            rows={s.categories}
            columns={[
              {
                header: 'Category',
                cell: (r) => (
                  <span className="font-bold text-slate-900" title={r.category}>
                    {ShortCategory(r.category)}
                  </span>
                ),
              },
              { header: 'Net Sales', cell: (r) => <span className="font-mono font-bold">{Money(r.net)}</span> },
              { header: 'Share', cell: (r) => `${r.share.toFixed(1)}%` },
              { header: 'Products', cell: (r) => Whole(r.products) },
              { header: 'Last Year', cell: (r) => <span className="font-mono">{Money(r.previous)}</span> },
              { header: 'Growth', cell: (r) => <GrowthText value={r.growth} /> },
            ]}
            footer={['TOTAL', Money(s.cur.netSales), '100%', '', Money(s.prev.netSales), <GrowthText key="g" value={Change(s.cur.netSales, s.prev.netSales)} />]}
          />
        ) : (
          <SimpleTable
            rows={s.topProducts}
            columns={[
              { header: '#', cell: (_, i) => <span className="text-slate-400">{i + 1}</span> },
              { header: 'Product ID', cell: (r) => <span className="font-mono text-xs">{r.id || '-'}</span> },
              { header: 'Barcode', cell: (r) => <span className="font-mono text-xs">{r.barcode || '-'}</span> },
              { header: 'Product', cell: (r) => <span className="font-bold text-slate-900">{r.name}</span> },
              {
                header: 'Category',
                cell: (r) => <span title={r.category}>{ShortCategory(r.category)}</span>,
              },
              { header: 'Net Sales', cell: (r) => <span className="font-mono font-bold">{Money(r.net)}</span> },
              { header: 'Share', cell: (r) => `${r.share.toFixed(1)}%` },
              { header: 'Qty', cell: (r) => <span className="font-mono">{Whole(r.qty)}</span> },
              { header: 'Last Year', cell: (r) => <span className="font-mono">{Money(r.previous)}</span> },
              { header: 'Growth', cell: (r) => <GrowthText value={r.growth} /> },
            ]}
            footer={(() => {
              const net = s.topProducts.reduce((t, r) => t + r.net, 0);
              const qty = s.topProducts.reduce((t, r) => t + r.qty, 0);
              const prev = s.topProducts.reduce((t, r) => t + r.previous, 0);
              return [
                '', '', '', 'TOTAL', '',
                Money(net),
                '100%',
                Whole(qty),
                Money(prev),
                <GrowthText key="g" value={Change(net, prev)} />,
              ];
            })()}
          />
        )}
      </Panel>
    </div>
  );
}
