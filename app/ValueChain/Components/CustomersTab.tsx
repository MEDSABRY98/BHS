'use client';

// Customers tab: pick a customer (grouped by main name, or by tag when main = sub) → every product sold to him
// in the sales period: his selling price (the type picked in Filters), the new cost, profit, margin, qty, sales and share.
// The product name opens the product details, like the Products tab.

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, FileSpreadsheet, Loader2, Search } from 'lucide-react';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { UseValueChain } from '../Context/ValueChainContext';
import { GetCustomerProducts } from '../Service/ValueChainService';
import { CostDateLabel, FormatDate, Money, PRICE_MODES, PassProfit, SalePrice, round2, round3, type CustomerProductRow, type ValueChainRow } from '../Utils/Types';

type Row = CustomerProductRow & { product: ValueChainRow; price: number; cost: number | null; profit: number | null; pct: number | null };
type SortKey = 'code' | 'name' | 'unit' | 'price' | 'cost' | 'profit' | 'pct' | 'qty' | 'amount' | 'share' | 'lastDate';

function Kpi({ label, value, hint, tone = 'slate' }: { label: string; value: string; hint?: string; tone?: 'slate' | 'gold' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] px-5 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${tone === 'gold' ? 'text-[#B8860B]' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

const COLS = 13;
const KIND_LABEL = { main: 'Main name', tag: 'Tag', customer: 'Customer' } as const;

export default function CustomersTab() {
  const { data, priceMode, priceBasis, profitFilter, periods, setSelected } = UseValueChain();
  const [groupKey, setGroupKey] = useState('');
  const [lines, setLines] = useState<CustomerProductRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [asc, setAsc] = useState(true);
  const [exporting, setExporting] = useState(false);

  const groups = data?.customerGroups || [];
  const group = groups.find((g) => g.key === groupKey) || null;
  const modeLabel = PRICE_MODES.find((m) => m.id === priceMode)?.label || 'Highest';
  const idsKey = group ? group.customerIds.join(',') : '';

  // the group left the list (other sales period) → back to "choose"
  useEffect(() => {
    if (groupKey && data && !group) setGroupKey('');
  }, [groupKey, data, group]);

  useEffect(() => {
    if (!group) {
      setLines(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    GetCustomerProducts(group.customerIds, periods.saleFrom, periods.saleTo)
      .then((r) => alive && setLines(r))
      .catch((e: any) => alive && setError(e?.message || 'Could not load the customer products'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, periods.saleFrom, periods.saleTo, reload]);

  // join with the Products data: only active / not-cancelled products, and their new cost
  const rows: Row[] = useMemo(() => {
    if (!lines || !data) return [];
    const byId = new Map(data.rows.map((r) => [r.productId, r]));
    const out: Row[] = [];
    for (const l of lines) {
      const product = byId.get(l.productId);
      if (!product) continue;
      // Overall: the product's price from all customers; Per Customer: this customer's own price
      const price = priceBasis === 'overall' ? SalePrice(product, priceMode) ?? 0 : priceMode === 'max' ? l.max : priceMode === 'min' ? l.min : l.avg;
      const cost = product.newCost?.price ?? null;
      const profit = cost === null ? null : price - cost;
      if (!PassProfit(profit, profitFilter)) continue;
      out.push({ ...l, product, price, cost, profit, pct: profit === null || !(price > 0) ? null : (profit / price) * 100 });
    }
    return out;
  }, [lines, data, priceMode, priceBasis, profitFilter]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter((r) => r.product.name.toLowerCase().includes(q) || r.productId.toLowerCase().includes(q) || r.product.barcode.toLowerCase().includes(q))
      : rows;
    const val = (r: Row): number | string | null => {
      switch (sortKey) {
        case 'code':
          return r.productId.toLowerCase();
        case 'name':
          return r.product.name.toLowerCase();
        case 'unit':
          return r.product.unit.toLowerCase() || null;
        case 'price':
          return r.price;
        case 'cost':
          return r.cost;
        case 'profit':
          return r.profit;
        case 'pct':
          return r.pct;
        case 'qty':
          return r.qty;
        case 'amount':
          return r.amount;
        case 'share':
          return r.share;
        case 'lastDate':
          return r.lastDate;
      }
    };
    const sorted = [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const c = typeof x === 'string' ? x.localeCompare(String(y)) : (x as number) - (y as number);
      return asc ? c : -c;
    });
    // grouped by product category, categories A-Z; inside each one the chosen sort (default: products A-Z)
    const byCat = new Map<string, Row[]>();
    for (const r of sorted) byCat.set(r.product.category, [...(byCat.get(r.product.category) || []), r]);
    return [...byCat]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .flatMap(([, rs]) => rs);
  }, [rows, query, sortKey, asc]);

  const kpis = useMemo(() => {
    const withPct = rows.filter((r) => r.pct !== null);
    return {
      amount: rows.reduce((s, r) => s + r.amount, 0),
      avgPct: withPct.length ? withPct.reduce((s, r) => s + (r.pct as number), 0) / withPct.length : null,
      losing: rows.filter((r) => r.profit !== null && Math.round(r.profit * 100) < 0).length,
    };
  }, [rows]);

  const sortBy = (k: SortKey) => {
    if (sortKey === k) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(k === 'name' || k === 'code' || k === 'unit');
    }
  };
  const Th = ({ k, children }: { k?: SortKey; children: React.ReactNode }) => (
    <th
      onClick={k ? () => sortBy(k) : undefined}
      className={`px-3 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap text-center ${k ? 'cursor-pointer select-none' : ''}`}
    >
      <span className="inline-flex items-center justify-center gap-1">
        {children}
        {k && (sortKey !== k ? <ArrowUpDown className="w-3.5 h-3.5 opacity-30" /> : asc ? <ArrowUp className="w-3.5 h-3.5 text-[#D4AF37]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#D4AF37]" />)}
      </span>
    </th>
  );

  const exportExcel = async () => {
    if (!shown.length || !group) return;
    setExporting(true);
    try {
      const priceCol = `${modeLabel} Selling Price`;
      await exportStyledExcel(
        shown.map((r, i) => ({
          '#': i + 1,
          ID: r.productId,
          Barcode: r.product.barcode,
          Description: r.product.name,
          Unit: r.product.unit,
          [priceCol]: round3(r.price),
          'New Cost': r.cost === null ? '' : round3(r.cost),
          'New Cost Date': CostDateLabel(r.product.newCost),
          'Gross Profit': r.profit === null ? '' : round3(r.profit),
          'Margin %': r.pct === null ? '' : round2(r.pct),
          Qty: r.qty,
          'Sales (AED)': round2(r.amount),
          'Share %': round2(r.share),
          'Last Sale': FormatDate(r.lastDate),
        })),
        `${group.name.replace(/[\\/:*?"<>|]+/g, '_') || 'Customer'}_Products`,
        {
          sheetName: 'Customer Products',
          columnWidth: 16,
          numericColumns: [priceCol, 'New Cost', 'Gross Profit', 'Margin %', 'Qty', 'Sales (AED)', 'Share %'],
          highlightNegativeInColumns: ['Gross Profit', 'Margin %'],
          numericDecimalPlaces: 3,
        },
      );
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the Excel file');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-4 flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-[380px]">
          <NiceSelect
            value={groupKey}
            onChange={(v) => {
              setGroupKey(v);
              setQuery('');
            }}
            searchPlaceholder="Search customer..."
            options={[
              { value: '', label: 'Choose a customer' },
              ...groups.map((g) => ({
                value: g.key,
                label: g.name,
                hint: g.kind === 'customer' ? undefined : `${KIND_LABEL[g.kind]} · ${g.customerIds.length} customer${g.customerIds.length === 1 ? '' : 's'}`,
              })),
            ]}
          />
        </div>
        {group && (
          <>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ID, barcode or description..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
              Sales {FormatDate(periods.saleFrom)} → {FormatDate(periods.saleTo)}
            </span>
            <button
              type="button"
              onClick={() => void exportExcel()}
              disabled={exporting || !shown.length}
              className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
              title="Export Excel"
              aria-label="Export Excel"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            </button>
          </>
        )}
      </div>

      {!group ? (
        <NoData title="CHOOSE A CUSTOMER" message="Pick a customer above to see every product sold to him in the sales period" />
      ) : error ? (
        <TabFetchError message={error} onRetry={() => setReload((n) => n + 1)} />
      ) : loading || !lines ? (
        <TabLoader className="!min-h-[50vh]" />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi
              label="Products"
              value={rows.length.toLocaleString()}
              hint={group.kind === 'customer' ? group.name : `${KIND_LABEL[group.kind]} · ${group.customerIds.length} customers`}
            />
            <Kpi label="Sales" value={`${Money(kpis.amount)} AED`} hint={`${FormatDate(periods.saleFrom)} → ${FormatDate(periods.saleTo)}`} />
            <Kpi
              label="Average Margin"
              value={kpis.avgPct === null ? '-' : `${kpis.avgPct.toFixed(1)}%`}
              hint={`${priceBasis === 'overall' ? 'overall ' : ''}${modeLabel.toLowerCase()} price on the new cost`}
              tone="gold"
            />
            <Kpi label="Losing Products" value={kpis.losing.toLocaleString()} hint="Selling price below the new cost" />
          </div>

          {shown.length === 0 ? (
            <NoData message={rows.length ? 'No products match the search' : 'No sales to this customer in the sales period'} />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-4">
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white text-center">
                      <Th>#</Th>
                      <Th k="code">ID</Th>
                      <Th>Barcode</Th>
                      <Th k="name">Product</Th>
                      <Th k="unit">Unit</Th>
                      <Th k="price">{modeLabel} Price{priceBasis === 'overall' ? ' (Overall)' : ''}</Th>
                      <Th k="cost">New Cost</Th>
                      <Th k="profit">Gross Profit</Th>
                      <Th k="pct">Margin</Th>
                      <Th k="qty">Qty</Th>
                      <Th k="amount">Sales</Th>
                      <Th k="share">Share of Sales</Th>
                      <Th k="lastDate">Last Sale</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r, i) => (
                      <React.Fragment key={r.productId}>
                      {(i === 0 || shown[i - 1].product.category !== r.product.category) && (
                        <tr className="bg-slate-100">
                          <td colSpan={COLS} className="px-4 py-2.5 text-left border-y border-slate-200">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">Category</span>
                            <span className="text-sm font-black text-slate-800">{r.product.category}</span>
                            <span className="ml-2 text-xs font-bold text-slate-400">({shown.filter((x) => x.product.category === r.product.category).length})</span>
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40 text-center">
                        <td className="px-3 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">{r.productId}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap">{r.product.barcode || <span className="text-slate-300">-</span>}</td>
                        <td className="px-3 py-2.5 min-w-[220px]">
                          <button
                            type="button"
                            onClick={() => setSelected(r.product)}
                            className="font-semibold text-slate-800 hover:text-[#B8860B] hover:underline underline-offset-4 decoration-[#D4AF37]"
                            title="Show the product details"
                          >
                            {r.product.name}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{r.product.unit || <span className="text-slate-300">-</span>}</td>
                        <td className="px-3 py-2.5 font-mono font-bold tabular-nums text-slate-800">{Money(r.price, 3)}</td>
                        <td className="px-3 py-2.5">
                          {r.cost === null ? (
                            <span className="text-slate-300">-</span>
                          ) : (
                            <div className="leading-tight">
                              <div className="font-mono font-bold text-slate-800 tabular-nums">{Money(r.cost, 3)}</div>
                              <div className={`text-[11px] ${r.product.newCost?.source === 'products' ? 'text-sky-500' : 'text-slate-400'}`}>{CostDateLabel(r.product.newCost)}</div>
                            </div>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 font-mono tabular-nums ${r.profit !== null && r.profit < 0 ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                          {r.profit === null ? <span className="text-slate-300">-</span> : Money(r.profit, 3)}
                        </td>
                        <td className="px-3 py-2.5">
                          {r.pct === null ? (
                            <span className="text-slate-300">-</span>
                          ) : (
                            <span
                              className={`inline-block min-w-[64px] px-2 py-1 rounded-lg text-xs font-black tabular-nums ${
                                r.pct < 0 ? 'bg-red-100 text-red-700' : r.pct < 15 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {r.pct.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-700">{r.qty.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700">{Money(r.amount)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B]" style={{ width: `${Math.min(100, r.share)}%` }} />
                            </div>
                            <span className="font-bold tabular-nums text-slate-700 w-14 text-left">{r.share.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{FormatDate(r.lastDate)}</td>
                      </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
