'use client';

// Product details: who buys the product in the sales period, at what price, and each one's share of its sales.
// The price follows the Selling Price picked in Filters (highest / average / lowest).

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import NoData from '@/app/Components/DataState/NoDataTab';
import { UseValueChain } from '../Context/ValueChainContext';
import { GetProductCustomers, GetProductSuppliers } from '../Service/ValueChainService';
import ProductSuppliers from './ProductSuppliers';
import { CostDateLabel, FormatDate, Margin, Money, PRICE_MODES, PassProfit, SalePrice, type ProductCustomerRow, type ProductSupplierRow } from '../Utils/Types';

/** one row of the table: a group (main name / tag) or a single customer */
type ViewRow = {
  key: string;
  name: string;
  kind: 'main' | 'tag' | 'customer';
  count: number;
  city: string;
  max: number;
  min: number;
  avg: number;
  amount: number;
  qty: number;
  share: number;
  lastDate: string;
  /** the customers inside a group (empty for a single customer) */
  children: ProductCustomerRow[];
};

const same = (a: string, b: string) => !a || !b || a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * Grouped view: main name ≠ sub name → by MAIN NAME; main = sub → by CUSTOMER TAG;
 * main = sub and no tag → the customer on his own.
 */
function GroupCustomers(rows: ProductCustomerRow[]): ViewRow[] {
  const map = new Map<string, ViewRow & { cities: Set<string> }>();
  for (const r of rows) {
    const g: { key: string; name: string; kind: ViewRow['kind'] } = !same(r.mainName, r.subName)
      ? { key: `M|${r.mainName.trim().toUpperCase()}`, name: r.mainName, kind: 'main' }
      : r.tag
        ? { key: `T|${r.tag.trim().toUpperCase()}`, name: r.tag, kind: 'tag' }
        : { key: `C|${r.customerId}`, name: r.name, kind: 'customer' };
    const v =
      map.get(g.key) ||
      { ...g, count: 0, city: '', cities: new Set<string>(), max: -Infinity, min: Infinity, avg: 0, amount: 0, qty: 0, share: 0, lastDate: '', children: [] as ProductCustomerRow[] };
    v.count += 1;
    if (g.kind !== 'customer') v.children.push(r);
    if (r.city) v.cities.add(r.city);
    v.max = Math.max(v.max, r.max);
    v.min = Math.min(v.min, r.min);
    v.amount += r.amount;
    v.qty += r.qty;
    v.share += r.share;
    if (r.lastDate > v.lastDate) v.lastDate = r.lastDate;
    map.set(g.key, v);
  }
  return [...map.values()]
    .map(({ cities, ...v }) => ({
      ...v,
      city: [...cities].sort().join(', '),
      avg: v.qty ? v.amount / v.qty : 0,
      children: [...v.children].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] px-5 py-4 text-center">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function ProductDetails() {
  const { selected, setSelected, periods, priceMode, priceBasis, profitFilter } = UseValueChain();
  const [rows, setRows] = useState<ProductCustomerRow[] | null>(null);
  const [supplierRows, setSupplierRows] = useState<ProductSupplierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<'customers' | 'suppliers'>('customers');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setRows(null);
    setSupplierRows(null);
    setError(null);
    // customers + suppliers together → one loading screen, switching tabs never loads again
    Promise.all([GetProductCustomers(selected.productId, periods.saleFrom, periods.saleTo), GetProductSuppliers(selected.productId)])
      .then(([c, s]) => {
        if (!alive) return;
        setSupplierRows(s);
        setRows(c);
      })
      .catch((e: any) => alive && setError(e?.message || 'Could not load the product details'));
    return () => {
      alive = false;
    };
  }, [selected, periods.saleFrom, periods.saleTo, reload]);


  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = GroupCustomers(rows || []);
    const hit = (name: string, city: string) => name.toLowerCase().includes(q) || city.toLowerCase().includes(q);
    return q ? list.filter((r) => hit(r.name, r.city) || r.children.some((c) => hit(c.name, c.city))) : list;
  }, [rows, query]);

  useEffect(() => {
    setOpen(new Set());
    setTab('customers');
  }, [selected]);

  if (!selected) return null;
  // loading: centred in the page (the content area starts 1.5rem down, so 100vh - 3rem puts it in the middle)
  if (!rows && !error) return <TabLoader className="!min-h-[calc(100vh-3rem)]" />;
  const m = Margin(selected, priceMode);
  const modeLabel = PRICE_MODES.find((x) => x.id === priceMode)?.label || 'Highest';
  // Overall: every row shows the product's price from all customers; Per Customer: each customer's own price
  const overall = priceBasis === 'overall' ? SalePrice(selected, priceMode) : null;
  const priceOf = (r: { max: number; min: number; avg: number }) =>
    overall !== null ? overall : priceMode === 'max' ? r.max : priceMode === 'min' ? r.min : r.avg;
  const cost = selected.newCost?.price ?? null;
  // Profit filter (Filters popup): groups / customers whose own profit passes; inside an open group, only the passing customers
  const passes = (r: { max: number; min: number; avg: number }) => PassProfit(cost === null ? null : priceOf(r) - cost, profitFilter);
  const visible = shown.filter(passes);

  /** one table row: a group / single customer, or (child) a customer inside an open group */
  const renderRow = (key: string, no: string, nameCell: React.ReactNode, city: string, price: number, share: number, lastDate: string, child: boolean) => {
    const profit = cost === null ? null : price - cost;
    const pct = profit === null || !(price > 0) ? null : (profit / price) * 100;
    return (
      <tr key={key} className={`border-b border-slate-100 text-center ${child ? 'bg-amber-50/30 text-[13px]' : 'odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40'}`}>
        <td className="px-3 py-2.5 text-slate-400 tabular-nums">{no}</td>
        <td className="px-3 py-2.5">{nameCell}</td>
        <td className="px-3 py-2.5 text-slate-600 max-w-[260px] whitespace-normal">{city || <span className="text-slate-300">-</span>}</td>
        <td className="px-3 py-2.5 font-mono font-bold text-slate-800 tabular-nums">{Money(price, 3)}</td>
        <td className="px-3 py-2.5">
          {cost === null ? (
            <span className="text-slate-300">-</span>
          ) : (
            <div className="leading-tight">
              <div className="font-mono font-bold text-slate-800 tabular-nums">{Money(cost, 3)}</div>
              <div className="text-[11px] text-slate-400">{CostDateLabel(selected.newCost)}</div>
            </div>
          )}
        </td>
        <td className={`px-3 py-2.5 font-mono tabular-nums ${profit !== null && profit < 0 ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
          {profit === null ? <span className="text-slate-300">-</span> : Money(profit, 3)}
        </td>
        <td className="px-3 py-2.5">
          {pct === null ? (
            <span className="text-slate-300">-</span>
          ) : (
            <span
              className={`inline-block min-w-[64px] px-2 py-1 rounded-lg text-xs font-black tabular-nums ${
                pct < 0 ? 'bg-red-100 text-red-700' : pct < 15 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {pct.toFixed(1)}%
            </span>
          )}
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center justify-center gap-2">
            <div className="w-24 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B]" style={{ width: `${Math.min(100, share)}%` }} />
            </div>
            <span className="font-bold tabular-nums text-slate-700 w-14 text-left">{share.toFixed(1)}%</span>
          </div>
        </td>
        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{lastDate ? FormatDate(lastDate) : <span className="text-slate-300">-</span>}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center"
          title="Back to products"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{selected.name}</h2>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200" role="tablist" aria-label="Product view">
              {(
                [
                  ['customers', 'Customers'],
                  ['suppliers', 'Suppliers'],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`w-24 h-8 px-2 rounded-lg text-xs font-bold text-center transition-all whitespace-nowrap ${
                    tab === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm text-slate-400 font-mono">
            {selected.productId}
            {selected.barcode ? ` · ${selected.barcode}` : ''}
            {selected.newCost?.supplierName ? ` · ${selected.newCost.supplierName}` : ''}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat label="New Cost" value={selected.newCost ? Money(selected.newCost.price, 3) : '-'} sub={selected.newCost ? CostDateLabel(selected.newCost) : 'No purchases'} />
        <Stat label={`${modeLabel} Price`} value={m.price === null ? '-' : Money(m.price, 3)} sub={`${FormatDate(periods.saleFrom)} → ${FormatDate(periods.saleTo)}`} />
        <Stat label="Margin" value={m.pct === null ? '-' : `${m.pct.toFixed(1)}%`} sub={m.profit === null ? undefined : `${Money(m.profit, 3)} per unit`} />
        <Stat label="Customers" value={rows ? rows.length.toLocaleString() : '...'} sub={rows ? `${Money(rows.reduce((s, r) => s + r.amount, 0))} AED sold` : undefined} />
      </div>

      {/* both tabs stay mounted: switching never reloads (the suppliers load in the background on open) */}
      <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-4 ${tab === 'suppliers' ? '' : 'hidden'}`}>
        <ProductSuppliers rows={supplierRows || []} />
      </div>
      <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-4 space-y-4 ${tab === 'customers' ? '' : 'hidden'}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer or city..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        {error ? (
          <TabFetchError message={error} onRetry={() => setReload((n) => n + 1)} />
        ) : !rows ? (
          <TabLoader className="!min-h-[240px]" />
        ) : visible.length === 0 ? (
          <NoData message={!rows.length ? 'No sales of this product in the sales period' : shown.length ? 'No customers match the Profit filter' : 'No customers match the search'} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-white text-center">
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">#</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">Customer</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">City</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">
                    {modeLabel} Selling Price{priceBasis === 'overall' ? ' (Overall)' : ''}
                  </th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">New Cost</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">Gross Profit</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">Margin %</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">Share of Sales</th>
                  <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">Last Sale</th>
                </tr>
              </thead>
              <tbody>
                {(
                  visible.flatMap((r, i) => {
                    const isOpen = open.has(r.key);
                    const nameCell =
                      r.kind === 'customer' ? (
                        <div className="font-semibold text-slate-800">{r.name}</div>
                      ) : (
                        <button type="button" onClick={() => toggle(r.key)} className="group inline-flex flex-col items-center" title={isOpen ? 'Hide the customers' : 'Show the customers'}>
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800 group-hover:text-[#B8860B]">
                            <ChevronRight className={`w-4 h-4 text-[#B8860B] transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            {r.name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {r.kind === 'tag' ? 'Tag' : 'Main name'} · {r.count} customer{r.count === 1 ? '' : 's'}
                          </span>
                        </button>
                      );
                    const out = [renderRow(r.key, String(i + 1), nameCell, r.city, priceOf(r), r.share, r.lastDate, false)];
                    if (isOpen) {
                      for (const c of r.children.filter(passes)) {
                        out.push(renderRow(`${r.key}|${c.customerId}`, '', <div className="text-slate-600">{c.name}</div>, c.city, priceOf(c), c.share, c.lastDate, true));
                      }
                    }
                    return out;
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
