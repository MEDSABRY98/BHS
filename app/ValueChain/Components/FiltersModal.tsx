'use client';

// Filters popup (opened from the sidebar):
// old-cost range → selling price (highest / average / lowest) → sales period → supplier → category → products (all / countable).

import { useEffect, useMemo, useState } from 'react';
import { Boxes, CalendarDays, History, Layers, Scale, Tag, Truck, X } from 'lucide-react';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';
import { UseValueChain } from '../Context/ValueChainContext';
import { PRICE_BASES, PRICE_MODES, PROFIT_FILTERS, type PriceBasis, type ValueChainPeriods, type PriceMode, type ProfitFilter } from '../Utils/Types';

const label = 'text-[10px] font-black uppercase tracking-[0.18em] text-slate-400';
const dateCls =
  'flex-1 min-w-[140px] px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#D4AF37]';

function Range({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className={dateCls} />
      <span className={label}>to</span>
      <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className={dateCls} />
    </div>
  );
}

export default function FiltersModal() {
  const { filtersOpen, setFiltersOpen, periods, setPeriods, priceBasis, setPriceBasis, priceMode, setPriceMode, profitFilter, setProfitFilter, supplier, setSupplier, category, setCategory, countableOnly, setCountableOnly, data } = UseValueChain();
  const [draft, setDraft] = useState<ValueChainPeriods>(periods);
  const [mode, setMode] = useState<PriceMode>(priceMode);
  const [basis, setBasis] = useState<PriceBasis>(priceBasis);
  const [profit, setProfit] = useState<ProfitFilter>(profitFilter);
  const [supp, setSupp] = useState(supplier);
  const [cat, setCat] = useState(category);
  const [countable, setCountable] = useState(countableOnly ? 'countable' : '');
  // the two lists filter each other: a chosen supplier limits the categories, a chosen category limits the suppliers
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  const categories = useMemo(
    () =>
      [...new Set((data?.rows || []).filter((r) => !supp || r.newCost?.supplierName === supp).map((r) => r.category).filter(Boolean))].sort(byName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, supp],
  );
  const supplierList = useMemo(
    () =>
      [...new Set((data?.rows || []).filter((r) => !cat || r.category === cat).map((r) => r.newCost?.supplierName || '').filter(Boolean))].sort(byName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, cat],
  );
  // a choice that is no longer in its list goes back to "All"
  useEffect(() => {
    if (data && cat && !categories.includes(cat)) setCat('');
  }, [data, categories, cat]);
  useEffect(() => {
    if (data && supp && !supplierList.includes(supp)) setSupp('');
  }, [data, supplierList, supp]);

  useEffect(() => {
    if (!filtersOpen) return;
    setDraft(periods);
    setMode(priceMode);
    setBasis(priceBasis);
    setProfit(profitFilter);
    setSupp(supplier);
    setCat(category);
    setCountable(countableOnly ? 'countable' : '');
  }, [filtersOpen, periods, priceMode, priceBasis, profitFilter, supplier, category, countableOnly]);

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFiltersOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtersOpen, setFiltersOpen]);

  if (!filtersOpen) return null;

  const valid = !!draft.oldFrom && !!draft.oldTo && draft.oldFrom <= draft.oldTo && !!draft.saleFrom && !!draft.saleTo && draft.saleFrom <= draft.saleTo;

  const apply = () => {
    if (!valid) return;
    if (
      draft.oldFrom !== periods.oldFrom ||
      draft.oldTo !== periods.oldTo ||
      draft.saleFrom !== periods.saleFrom ||
      draft.saleTo !== periods.saleTo
    ) {
      setPeriods(draft);
    }
    setPriceMode(mode);
    setPriceBasis(basis);
    setProfitFilter(profit);
    setSupplier(supp);
    setCategory(cat);
    setCountableOnly(countable === 'countable');
    setFiltersOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setFiltersOpen(false)}>
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-900">Filters</h3>
          <button type="button" onClick={() => setFiltersOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 1 · old cost range */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#B8860B]" />
              <span className={label}>Old Cost Range</span>
            </div>
            <Range from={draft.oldFrom} to={draft.oldTo} onChange={(oldFrom, oldTo) => setDraft((d) => ({ ...d, oldFrom, oldTo }))} />
            <p className="text-xs text-slate-400">The old cost is the oldest purchase price inside this range. The new cost is always the latest purchase price.</p>
          </div>

          {/* 2 · selling price: basis (overall / per customer) + type (highest / average / lowest) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#B8860B]" />
              <span className={label}>Selling Price</span>
            </div>
            <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1 gap-1">
              {PRICE_BASES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBasis(b.id)}
                  title={b.hint}
                  className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    basis === b.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 bg-slate-100 rounded-xl p-1 gap-1">
              {PRICE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    mode === m.id ? 'bg-slate-900 text-[#D4AF37]' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3 · sales period */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#B8860B]" />
              <span className={label}>Sales Period</span>
            </div>
            <Range from={draft.saleFrom} to={draft.saleTo} onChange={(saleFrom, saleTo) => setDraft((d) => ({ ...d, saleFrom, saleTo }))} />
          </div>

          {/* 4 · profit / loss */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#B8860B]" />
              <span className={label}>Profit</span>
            </div>
            <NiceSelect value={profit} onChange={(v) => setProfit(v as ProfitFilter)} options={PROFIT_FILTERS.map((f) => ({ value: f.id, label: f.label }))} />
          </div>

          {/* 5 · supplier */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#B8860B]" />
              <span className={label}>Supplier (latest purchase)</span>
            </div>
            <NiceSelect
              value={supp}
              onChange={setSupp}
              searchPlaceholder="Search supplier..."
              options={[{ value: '', label: 'All suppliers' }, ...supplierList.map((s) => ({ value: s, label: s }))]}
            />
          </div>

          {/* 6 · category */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#B8860B]" />
              <span className={label}>Category</span>
            </div>
            <NiceSelect
              value={cat}
              onChange={setCat}
              searchPlaceholder="Search category..."
              options={[{ value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </div>

          {/* 7 · all / countable products */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#B8860B]" />
              <span className={label}>Products</span>
            </div>
            <NiceSelect
              value={countable}
              onChange={setCountable}
              options={[
                { value: '', label: 'All products' },
                { value: 'countable', label: 'Countable products only' },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <button type="button" onClick={() => setFiltersOpen(false)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={apply}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-[#D4AF37] text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
