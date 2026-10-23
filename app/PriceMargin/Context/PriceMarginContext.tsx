'use client';

// Data + filters shared by the sidebar (Filters / Refresh) and the table.
// Periods reload the data from the server; price mode and supplier filter on the page only.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { GetPriceMarginData } from '../Service/PriceMarginService';
import { DefaultPeriods, type PriceMarginData, type PriceMarginPeriods, type PriceMarginRow, type PriceMode, type ProfitFilter, type PriceMarginTab, type PriceBasis } from '../Utils/Types';

type PriceMarginContextValue = {
  data: PriceMarginData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  periods: PriceMarginPeriods;
  setPeriods: (p: PriceMarginPeriods) => void;
  tab: PriceMarginTab;
  setTab: (t: PriceMarginTab) => void;
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
  selected: PriceMarginRow | null;
  setSelected: (r: PriceMarginRow | null) => void;
  filtersOpen: boolean;
  setFiltersOpen: (v: boolean) => void;
};

// kept on globalThis so a hot reload of this file in dev doesn't create a second context
// (that is what throws "UsePriceMargin must be used within PriceMarginProvider" after an edit)
const g = globalThis as unknown as { __PriceMarginCtx?: React.Context<PriceMarginContextValue | null> };
const Ctx = g.__PriceMarginCtx ?? (g.__PriceMarginCtx = createContext<PriceMarginContextValue | null>(null));

export function PriceMarginProvider({ children }: { children: React.ReactNode }) {
  const [periods, setPeriods] = useState<PriceMarginPeriods>(DefaultPeriods);
  const [tab, setTab] = useState<PriceMarginTab>('products');
  const [priceBasis, setPriceBasis] = useState<PriceBasis>('customer');
  const [priceMode, setPriceMode] = useState<PriceMode>('max');
  const [profitFilter, setProfitFilter] = useState<ProfitFilter>('all');
  const [supplier, setSupplier] = useState('');
  const [category, setCategory] = useState('');
  const [countableOnly, setCountableOnly] = useState(false);
  const [selected, setSelectedState] = useState<PriceMarginRow | null>(null);
  // where the products list was scrolled when a product was opened → restored on Back
  const listScroll = useRef(0);
  const setSelected = useCallback((r: PriceMarginRow | null) => {
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
  const [data, setData] = useState<PriceMarginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent: boolean) => {
      if (silent) setIsRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await GetPriceMarginData(periods));
      } catch (e: any) {
        setError(e?.message || 'Failed to load the price margin data');
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

export function UsePriceMargin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('UsePriceMargin must be used within PriceMarginProvider');
  return ctx;
}
