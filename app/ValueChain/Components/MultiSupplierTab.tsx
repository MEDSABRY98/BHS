'use client';

// Multi Supplier: products bought from 2+ suppliers. Grouped by category (A-Z), products A-Z;
// the product is written once, its suppliers under it (newest purchase first) with their last price,
// the difference from the cheapest one, the margin on that price and the last purchase date.
// A thicker line separates one product from the next. Filters (supplier, category, countable, profit) apply.

import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Loader2, Search, Star } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { toast } from '@/app/Components/Notification';
import { exportStyledExcel } from '@/app/Components/Export/ExcelExport';
import { UseValueChain } from '../Context/ValueChainContext';
import { FormatDate, Money, PassProfit, PRICE_MODES, SalePrice, round2, round3, type ValueChainRow } from '../Utils/Types';

const th = 'px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-center whitespace-nowrap';
const COLS = 10;

function Kpi({ label, value, hint, tone = 'slate' }: { label: string; value: string; hint?: string; tone?: 'slate' | 'gold' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] px-5 py-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-black tabular-nums ${tone === 'gold' ? 'text-[#B8860B]' : 'text-slate-900'}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export default function MultiSupplierTab() {
  const { data, priceMode, profitFilter, supplier, category, countableOnly, setSelected } = UseValueChain();
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const modeLabel = PRICE_MODES.find((m) => m.id === priceMode)?.label || 'Highest';

  const products = useMemo(() => {
    let list = (data?.rows || []).filter((r) => (r.supplierCosts?.length || 0) >= 2);
    if (supplier) list = list.filter((r) => r.supplierCosts!.some((s) => s.name === supplier));
    if (category) list = list.filter((r) => r.category === category);
    if (countableOnly) list = list.filter((r) => r.countable);
    if (profitFilter !== 'all') {
      // a product stays when at least one of its suppliers passes the Profit filter
      list = list.filter((r) => {
        const sale = SalePrice(r, priceMode);
        return r.supplierCosts!.some((s) => PassProfit(sale === null ? null : sale - s.price, profitFilter));
      });
    }
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || r.productId.toLowerCase().includes(q) || r.barcode.toLowerCase().includes(q));
    const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    return [...list].sort((a, b) => byName(a.category, b.category) || byName(a.name, b.name));
  }, [data, supplier, category, countableOnly, profitFilter, priceMode, query]);

  const kpis = useMemo(() => {
    let gapSum = 0;
    let gapN = 0;
    let notCheapest = 0;
    for (const r of products) {
      const prices = r.supplierCosts!.map((s) => s.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min > 0) {
        gapSum += ((max - min) / min) * 100;
        gapN++;
      }
      // the latest purchase is not from the cheapest supplier
      if (r.supplierCosts![0].price > min + 0.0005) notCheapest++;
    }
    return { gap: gapN ? gapSum / gapN : null, notCheapest };
  }, [products]);

  const exportExcel = async () => {
    if (!products.length) return;
    setExporting(true);
    try {
      const priceCol = `${modeLabel} Selling Price`;
      const out: Record<string, unknown>[] = [];
      products.forEach((r, i) => {
        const sale = SalePrice(r, priceMode);
        const min = Math.min(...r.supplierCosts!.map((s) => s.price));
        r.supplierCosts!.forEach((s, j) => {
          const pct = sale === null || !(sale > 0) ? null : ((sale - s.price) / sale) * 100;
          out.push({
            '#': j === 0 ? i + 1 : '',
            Category: r.category,
            ID: r.productId,
            Barcode: r.barcode,
            Description: r.name,
            Unit: r.unit,
            [priceCol]: sale === null ? '' : round3(sale),
            Supplier: s.name,
            'Last Price': round3(s.price),
            'vs Cheapest %': min > 0 ? round2(((s.price - min) / min) * 100) : '',
            'Margin %': pct === null ? '' : round2(pct),
            'Last Purchase': FormatDate(s.date),
          });
        });
      });
      await exportStyledExcel(out, 'Multi_Supplier_Products', {
        sheetName: 'Multi Supplier',
        columnWidth: 16,
        numericColumns: [priceCol, 'Last Price', 'vs Cheapest %', 'Margin %'],
        highlightNegativeInColumns: ['Margin %'],
        numericDecimalPlaces: 3,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the Excel file');
    } finally {
      setExporting(false);
    }
  };

  if (!data) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        <Kpi label="Products" value={products.length.toLocaleString()} hint="Bought from 2 or more suppliers" />
        <Kpi label="Average Price Gap" value={kpis.gap === null ? '-' : `${kpis.gap.toFixed(1)}%`} hint="Dearest vs cheapest supplier" tone="gold" />
        <Kpi label="Not From Cheapest" value={kpis.notCheapest.toLocaleString()} hint="Latest purchase was not the cheapest supplier" />
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
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || !products.length}
            className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 disabled:opacity-50"
            title="Export Excel"
            aria-label="Export Excel"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          </button>
        </div>

        {products.length === 0 ? (
          <NoData message="No products bought from more than one supplier match the filters" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-center">
                  <th className={th}>#</th>
                  <th className={th}>ID</th>
                  <th className={th}>Product</th>
                  <th className={th}>Unit</th>
                  <th className={th}>{modeLabel} Selling Price</th>
                  <th className={th}>Supplier</th>
                  <th className={th}>Last Price</th>
                  <th className={th}>vs Cheapest</th>
                  <th className={th}>Margin</th>
                  <th className={th}>Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {products.map((r, i) => {
                  const sale = SalePrice(r, priceMode);
                  const list = r.supplierCosts!;
                  const min = Math.min(...list.map((s) => s.price));
                  const n = list.length;
                  const catStart = i === 0 || products[i - 1].category !== r.category;
                  return (
                    <React.Fragment key={r.productId}>
                      {catStart && (
                        <tr className="bg-slate-100">
                          <td colSpan={COLS} className="px-4 py-2.5 text-left border-y border-slate-200">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mr-2">Category</span>
                            <span className="text-sm font-black text-slate-800">{r.category}</span>
                            <span className="ml-2 text-xs font-bold text-slate-400">({products.filter((x) => x.category === r.category).length})</span>
                          </td>
                        </tr>
                      )}
                      {list.map((s, j) => {
                        const cheapest = s.price <= min + 0.0005;
                        const gap = min > 0 ? ((s.price - min) / min) * 100 : null;
                        const pct = sale === null || !(sale > 0) ? null : ((sale - s.price) / sale) * 100;
                        // thicker line above the first supplier of every product (not under a category row)
                        const top = j === 0 && !catStart ? 'border-t-[3px] border-t-slate-300' : j > 0 ? 'border-t border-t-slate-100' : '';
                        return (
                          <tr key={s.supplierId || j} className={`text-center ${top} ${cheapest ? 'bg-emerald-50/50' : 'bg-white'} hover:bg-amber-50/40`}>
                            {j === 0 && (
                              <>
                                <td rowSpan={n} className="px-3 py-2.5 text-slate-400 tabular-nums align-middle bg-white">{i + 1}</td>
                                <td rowSpan={n} className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap align-middle bg-white">{r.productId}</td>
                                <td rowSpan={n} className="px-3 py-2.5 min-w-[220px] align-middle bg-white">
                                  <button
                                    type="button"
                                    onClick={() => setSelected(r as ValueChainRow)}
                                    className="font-semibold text-slate-800 hover:text-[#B8860B] hover:underline underline-offset-4 decoration-[#D4AF37]"
                                    title="Show the product details"
                                  >
                                    {r.name}
                                  </button>
                                  {r.barcode && <div className="text-[11px] text-slate-400 font-mono">{r.barcode}</div>}
                                </td>
                                <td rowSpan={n} className="px-3 py-2.5 text-slate-600 whitespace-nowrap align-middle bg-white">{r.unit || <span className="text-slate-300">-</span>}</td>
                                <td rowSpan={n} className="px-3 py-2.5 font-mono font-bold tabular-nums text-slate-800 align-middle bg-white">
                                  {sale === null ? <span className="text-slate-300">-</span> : Money(sale, 3)}
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2 text-slate-700 max-w-[220px] truncate" title={s.name}>
                              {s.name}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold tabular-nums text-slate-800 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                {Money(s.price, 3)}
                                {cheapest && <Star className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500" />}
                              </span>
                            </td>
                            <td className={`px-3 py-2 font-mono tabular-nums ${cheapest ? 'text-emerald-600 font-bold' : 'text-red-600'}`}>
                              {cheapest || gap === null ? 'Cheapest' : `+${gap.toFixed(1)}%`}
                            </td>
                            <td className="px-3 py-2">
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
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{FormatDate(s.date)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
