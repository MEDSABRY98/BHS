'use client';

// Data + filters shared by the sidebar (Filters / Refresh) and the table.
// Periods reload the data from the server; price mode and supplier filter on the page only.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GetValueChainData } from '../Service/ValueChainService';
import { DefaultPeriods, type ValueChainData, type ValueChainPeriods, type ValueChainRow, type PriceMode, type ProfitFilter, type ValueChainTab, type PriceBasis } from '../Utils/Types';

type ValueChainContextValue = {
  data: ValueChainData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  periods: ValueChainPeriods;
  setPeriods: (p: ValueChainPeriods) => void;
  tab: ValueChainTab;
  setTab: (t: ValueChainTab) => void;
  priceBasis: PriceBasis;
  setPriceBasis: (b: PriceBasis) => void;
  priceMode: PriceMode;
  setPriceMode: (m: PriceMode) => void;
  profitFilter: ProfitFilter;
  setProfitFilter: (f: ProfitFilter) => void;
  supplier: string;
  setSupplier: (s: string) => void;
  category: string;
  setCategory: (c: string) => void;
  /** true = only the countable products */
  countableOnly: boolean;
  setCountableOnly: (v: boolean) => void;
  /** product details view (null = the products table) */
  selected: ValueChainRow | null;
  setSelected: (r: ValueChainRow | null) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
};

// kept on globalThis so a hot reload of this file in dev doesn't create a second context
// (that is what throws "UseValueChain must be used within ValueChainProvider" after an edit)
const g = globalThis as unknown as { __ValueChainCtx?: React.Context<ValueChainContextValue | null> };
const Ctx = g.__ValueChainCtx ?? (g.__ValueChainCtx = createContext<ValueChainContextValue | null>(null));

export function ValueChainProvider({ children }: { children: React.ReactNode }) {
  const [periods, setPeriods] = useState<ValueChainPeriods>(DefaultPeriods);
  const [tab, setTab] = useState<ValueChainTab>('products');
  const [priceBasis, setPriceBasis] = useState<PriceBasis>('customer');
  const [priceMode, setPriceMode] = useState<PriceMode>('max');
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>('all');
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('');
  const [countableOnly, setCountableOnly] = useState(false);
  const [selected, setSelectedState] = useState<ValueChainRow | null>(null);
  // where the products list was scrolled when a product was opened → restored on Back
  const listScroll = useRef(0);
  const setSelected = useCallback((r: ValueChainRow | null) => {
    setSelectedState((prev) => {
      if (r && !prev) listScroll.current = window.scrollY;
      return r;
    });
  }, []);
  useEffect(() => {
    if (selected) {
      window.scrollTo({ top: 0 });
      return;
    }
    const y = listScroll.current;
    if (!y) return;
    // after the table is shown again
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: y })));
  }, [selected]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<ValueChainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      if (silent) setIsRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await GetValueChainData(periods));
      } catch (e: any) {
        setError(e?.message || 'Failed to load the value chain data');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [periods],
  );

  // first load, and again whenever the periods change
  useEffect(() => {
    void load(!!data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return (
    <Ctx.Provider
      value={{
        data,
        loading,
        isRefreshing,
        error,
        refresh: () => load(true),
        periods,
        setPeriods,
        tab,
        setTab,
        priceBasis,
        setPriceBasis,
        priceMode,
        setPriceMode,
        profitFilter,
        setProfitFilter,
        supplier,
        setSupplier,
        category,
        setCategory,
        countableOnly,
        setCountableOnly,
        selected,
        setSelected,
        filtersOpen,
        setFiltersOpen,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function UseValueChain() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('UseValueChain must be used within ValueChainProvider');
  return ctx;
}
