'use client';

// The one table: cost (old / new, each with its date) vs the selling price picked in Filters.

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet, Loader2, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import { UseValueChain } from '../Context/ValueChainContext';
import { ExportValueChainExcel } from '../Utils/ValueChainExcel';
import { CostChange, CostDateLabel, FormatDate, Margin, Money, PRICE_MODES, type ParentView, type ValueChainRow } from '../Utils/Types';

const PAGE = 250;
type SortKey = 'code' | 'barcode' | 'name' | 'unit' | 'supplier' | 'oldCost' | 'newCost' | 'change' | 'price' | 'profit' | 'pct';

function Kpi({ label, value, hint, tone = 'slate' }: { label: string; value: string; hint?: string; tone?: 'slate' | 'gold' | 'red' | 'green' }) {
  const color = tone === 'gold' ? 'text-[#B8860B]' : tone === 'red' ? 'text-red-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] px-5 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

function CostCell({ point, change }: { point: ValueChainRow['oldCost']; change?: number | null }) {
  if (!point) return <span className="text-slate-300">-</span>;
  const up = change !== undefined && change !== null && change > 0.005;
  const down = change !== undefined && change !== null && change < -0.005;
  return (
    <div className="leading-tight">
      <div className="font-mono font-bold text-slate-800 inline-flex items-center gap-1">
        {Money(point.price, 3)}
        {up && <TrendingUp className="w-3.5 h-3.5 text-red-500" />}
        {down && <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />}
      </div>
      <div className={`text-[11px] ${point.source === 'products' ? 'text-sky-500' : 'text-slate-400'}`}>{CostDateLabel(point)}</div>
    </div>
  );
}

export default function ProductsTable() {
  const { data, priceMode, profitFilter, supplier, category, countableOnly, periods, setFiltersOpen, setSelected } = UseValueChain();
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [parentView, setParentView] = useState<ParentView>('all');

  const priceLabel = `${PRICE_MODES.find((m) => m.id === priceMode)?.label} Price`;

  const filtered = useMemo(() => {
    let list = data?.rows || [];
    if (supplier) list = list.filter((r) => r.newCost?.supplierName === supplier);
    if (category) list = list.filter((r) => r.category === category);
    if (countableOnly) list = list.filter((r) => r.countable);
    if (profitFilter !== 'all') {
      // profit on the new cost with the chosen selling price; rounded to fils so 0.0001 counts as zero
      list = list.filter((r) => {
        const p = Margin(r, priceMode).profit;
        if (p === null) return false;
        const v = Math.round(p * 100) / 100;
        return profitFilter === 'profit' ? v > 0 : profitFilter === 'loss' ? v < 0 : v === 0;
      });
    }
    if (parentView === 'noParent') list = list.filter((r) => !r.parentId);
    else if (parentView === 'withParent') list = list.filter((r) => !!r.parentId);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || r.productId.toLowerCase().includes(q) || r.barcode.toLowerCase().includes(q));

    const val = (r: ValueChainRow): number | string | null => {
      const m = Margin(r, priceMode);
      switch (sortKey) {
        case 'code':
          return r.productId.toLowerCase();
        case 'barcode':
          return r.barcode || null;
        case 'name':
          return r.name.toLowerCase();
        case 'unit':
          return r.unit.toLowerCase() || null;
        case 'supplier':
          return (r.newCost?.supplierName || '').toLowerCase();
        case 'oldCost':
          return r.oldCost?.price ?? null;
        case 'newCost':
          return r.newCost?.price ?? null;
        case 'change':
          return CostChange(r);
        case 'price':
          return m.price;
        case 'profit':
          return m.profit;
        case 'pct':
          return m.pct;
      }
    };
    const sorted = [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // empty values always last
      if (y === null) return -1;
      const c = typeof x === 'string' ? x.localeCompare(String(y)) : (x as number) - (y as number);
      return asc ? c : -c;
    });
    if (parentView !== 'withParent') {
      // Normal / No Parent: grouped by product category, categories A-Z, the chosen sort inside each one
      const byCat = new Map<string, ValueChainRow[]>();
      for (const r of sorted) byCat.set(r.category, [...(byCat.get(r.category) || []), r]);
      return [...byCat].sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' })).flatMap(([, rs]) => rs);
    }
    // With Parent: grouped by PRODUCT PARENT ID, groups A-Z by the parent's name, the chosen sort inside each group
    const groups = new Map<string, ValueChainRow[]>();
    for (const r of sorted) groups.set(r.parentId, [...(groups.get(r.parentId) || []), r]);
    const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
    return [...groups.values()]
      .sort((a, b) => byName(a[0].parentName || a[0].parentId, b[0].parentName || b[0].parentId))
      .flat();
  }, [data, supplier, category, countableOnly, profitFilter, query, sortKey, asc, priceMode, parentView]);

  useEffect(() => setPage(1), [query, supplier, category, countableOnly, profitFilter, sortKey, asc, priceMode, data, parentView]);

  const kpis = useMemo(() => {
    let sumPct = 0;
    let n = 0;
    let noCost = 0;
    let noPrice = 0;
    let costUp = 0;
    for (const r of filtered) {
      const m = Margin(r, priceMode);
      if (m.pct !== null) {
        sumPct += m.pct;
        n++;
      }
      if (!r.newCost) noCost++;
      if (!r.sale) noPrice++;
      const ch = CostChange(r);
      if (ch !== null && ch > 0.005) costUp++;
    }
    return { avg: n ? sumPct / n : null, noCost, noPrice, costUp };
  }, [filtered, priceMode]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);

  const sortBy = (k: SortKey) => {
    if (sortKey === k) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(k === 'name' || k === 'supplier' || k === 'code' || k === 'barcode' || k === 'unit');
    }
  };
  const Th = ({ k, children, className = '' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th onClick={() => sortBy(k)} className={`px-3 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none text-center ${className}`}>
      <span className="inline-flex items-center justify-center gap-1">
        {children}
        {sortKey !== k ? <ArrowUpDown className="w-3.5 h-3.5 opacity-30" /> : asc ? <ArrowUp className="w-3.5 h-3.5 text-[#D4AF37]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#D4AF37]" />}
      </span>
    </th>
  );

  const exportExcel = async () => {
    setExporting(true);
    try {
      await ExportValueChainExcel(filtered, priceMode, periods, parentView);
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the Excel file');
    } finally {
      setExporting(false);
    }
  };

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi label="Products" value={filtered.length.toLocaleString()} hint={[supplier || 'All suppliers', category, countableOnly ? 'Countable' : ''].filter(Boolean).join(' · ')} />
        <Kpi label="Average Margin" value={kpis.avg === null ? '-' : `${kpis.avg.toFixed(1)}%`} hint={`On the new cost · ${priceLabel.toLowerCase()}`} tone="gold" />
        <Kpi label="Cost Increased" value={kpis.costUp.toLocaleString()} hint="New cost above the old cost" tone="red" />
        <Kpi label="Missing Data" value={`${kpis.noCost} / ${kpis.noPrice}`} hint="No purchase cost / no sales in the period" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ID, barcode or description..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200" role="tablist" aria-label="Products view">
            {(
              [
                ['all', 'Normal'],
                ['noParent', 'No Parent'],
                ['withParent', 'With Parent'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={parentView === value}
                onClick={() => setParentView(value)}
                className={`w-24 h-8 px-2 rounded-lg text-xs font-bold text-center transition-all whitespace-nowrap ${
                  parentView === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100"
            title="Change in Filters"
          >
            Old cost {FormatDate(periods.oldFrom)} → {FormatDate(periods.oldTo)} · Sales {FormatDate(periods.saleFrom)} → {FormatDate(periods.saleTo)}
          </button>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || !filtered.length}
            className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
            title="Export Excel"
            aria-label="Export Excel"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          </button>
        </div>

        {filtered.length === 0 ? (
          <NoData message={data.rows.length ? 'No products match the search or the filters' : 'No purchases or sales in the selected periods'} />
        ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-white text-center">
                <th className="px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center">#</th>
                <Th k="code">ID</Th>
                <Th k="barcode">Barcode</Th>
                <Th k="name">Product</Th>
                <Th k="unit">Unit</Th>
                <Th k="supplier">Supplier</Th>
                <Th k="oldCost" className="text-center">Old Cost</Th>
                <Th k="newCost" className="text-center">New Cost</Th>
                <Th k="change" className="text-center">Change</Th>
                <Th k="price" className="text-center">{priceLabel}</Th>
                <Th k="profit" className="text-center">Gross Profit</Th>
                <Th k="pct" className="text-center">Margin</Th>
              </tr>
            </thead>
            <tbody>
              {(
                shown.map((r, i) => {
                  const m = Margin(r, priceMode);
                  const change = CostChange(r);
                  const groupStart = parentView === 'withParent' && (i === 0 || shown[i - 1].parentId !== r.parentId);
                  const groupSize = groupStart ? filtered.filter((x) => x.parentId === r.parentId).length : 0;
                  const catStart = parentView !== 'withParent' && (i === 0 || shown[i - 1].category !== r.category);
                  const catSize = catStart ? filtered.filter((x) => x.category === r.category).length : 0;
                  return (
                    <React.Fragment key={r.productId}>
                    {catStart && (
                      <tr className="bg-slate-100">
                        <td colSpan={12} className="px-4 py-2.5 text-left border-y border-slate-200">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">Category</span>
                          <span className="text-sm font-black text-slate-800">{r.category}</span>
                          <span className="ml-2 text-xs font-bold text-slate-400">({catSize})</span>
                        </td>
                      </tr>
                    )}
                    {groupStart && (
                      <tr className="bg-slate-100">
                        <td colSpan={12} className="px-4 py-2.5 text-left border-y border-slate-200">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">Parent</span>
                          <span className="font-mono text-xs font-bold text-slate-700">{r.parentId}</span>
                          {r.parentName && <span className="ml-2 text-sm font-black text-slate-800">{r.parentName}</span>}
                          <span className="ml-2 text-xs font-bold text-slate-400">({groupSize})</span>
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-slate-100 odd:bg-white even:bg-slate-50/60 hover:bg-amber-50/40 align-middle text-center">
                      <td className="px-3 py-2.5 text-slate-400 tabular-nums">{(page - 1) * PAGE + i + 1}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap">{r.productId}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap">{r.barcode || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2.5 text-center min-w-[240px]">
                        <button
                          type="button"
                          onClick={() => setSelected(r)}
                          className="font-semibold text-slate-800 hover:text-[#B8860B] hover:underline underline-offset-4 decoration-[#D4AF37]"
                          title="Show the customers of this product"
                        >
                          {r.name}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600 whitespace-nowrap">{r.unit || <span className="text-slate-300">-</span>}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600 max-w-[220px] truncate" title={r.newCost?.supplierName || ''}>
                        {r.newCost?.supplierName || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <CostCell point={r.oldCost} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <CostCell point={r.newCost} change={change} />
                      </td>
                      <td className={`px-3 py-2.5 text-center font-mono tabular-nums ${change === null ? 'text-slate-300' : change > 0.005 ? 'text-red-600' : change < -0.005 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {change === null ? '-' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {m.price === null ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <div className="leading-tight">
                            <div className="font-mono font-bold text-slate-800">{Money(m.price, 3)}</div>
                            <div className="text-[11px] text-slate-400">{r.sale?.lines} lines</div>
                          </div>
                        )}
                      </td>
                      <td className={`px-3 py-2.5 text-center font-mono tabular-nums ${m.profit !== null && m.profit < 0 ? 'text-red-600 font-bold' : 'text-slate-700'}`}>
                        {m.profit === null ? <span className="text-slate-300">-</span> : Money(m.profit, 3)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {m.pct === null ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <span
                            className={`inline-block min-w-[64px] px-2 py-1 rounded-lg text-xs font-black tabular-nums ${
                              m.pct < 0 ? 'bg-red-100 text-red-700' : m.pct < 15 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {m.pct.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {(page - 1) * PAGE + 1}-{Math.min(page * PAGE, filtered.length)} of {filtered.length.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" title="Previous">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold tabular-nums">
                {page} / {pages}
              </span>
              <button type="button" disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg border border-slate-200 disabled:opacity-40" title="Next">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
