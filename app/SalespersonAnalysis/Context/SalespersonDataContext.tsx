'use client';

// Selected salesperson + period + loaded data, shared by the three sections.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { GetSalespersonData, ListSalespersons } from '../Service/SalespersonService';
import { DefaultPeriod } from '../Utils/SalespersonAggregations';
import type { AgingMode, Period, SalespersonData, SalespersonOption } from '../Utils/Types';

type SalespersonDataContextValue = {
  salespersons: SalespersonOption[];
  canChoose: boolean;
  listLoading: boolean;
  selectedId: string;
  setSelectedId: (id: string) => void;
  period: Period;
  setPeriod: (p: Period) => void;
  agingMode: AgingMode;
  setAgingMode: (m: AgingMode) => void;
  /** the loaded data with the Tag / Class filters applied (what every tab shows) */
  data: SalespersonData | null;
  /** tags / classes of the salesperson's customers (filter options) */
  tagOptions: string[];
  classOptions: string[];
  /** '' = all, NO_VALUE = customers without a tag / class */
  tagFilter: string;
  setTagFilter: (v: string) => void;
  classFilter: string;
  setClassFilter: (v: string) => void;
  /** Debit tab: only customers with open debit older than this many days (0 = all) */
  minDays: number;
  setMinDays: (v: number) => void;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const SalespersonDataContext = createContext<SalespersonDataContextValue | null>(null);

/** filter value for "customers without a tag / class" */
export const NO_VALUE = '__NONE__';

const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
const sortAz = (list: string[]) => [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export function SalespersonDataProvider({ children }: { children: React.ReactNode }) {
  const [salespersons, setSalespersons] = useState<SalespersonOption[]>([]);
  const [canChoose, setCanChoose] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [period, setPeriod] = useState<Period>(DefaultPeriod);
  const [agingMode, setAgingMode] = useState<AgingMode>('days');
  const [rawData, setData] = useState<SalespersonData | null>(null);
  const [tagFilter, setTagFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [minDays, setMinDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await ListSalespersons();
        if (cancelled) return;
        setSalespersons(res.salespersons);
        setCanChoose(res.canChoose);
        // users who can only see themselves start on their own analysis
        if (!res.canChoose && res.salespersons[0]) setSelectedId(res.salespersons[0].id);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load salespersons');
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(
    async (silent: boolean) => {
      if (!selectedId) return;
      const id = ++requestId.current;
      if (silent) setIsRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await GetSalespersonData({ salespersonId: selectedId, period });
        if (id === requestId.current) setData(res);
      } catch (e: any) {
        if (id === requestId.current) setError(e?.message || 'Failed to load the salesperson data');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [selectedId, period],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  // another salesperson → the filters start again
  useEffect(() => {
    setTagFilter('');
    setClassFilter('');
  }, [selectedId]);

  const tagOptions = useMemo(() => sortAz([...new Set(Object.values(rawData?.customerMeta || {}).map((m) => m.tag).filter(Boolean))]), [rawData]);
  const classOptions = useMemo(() => sortAz([...new Set(Object.values(rawData?.customerMeta || {}).map((m) => m.cls).filter(Boolean))]), [rawData]);

  // Tag / Class filters: keep only the sales lines and ledger rows of the matching customers
  const data = useMemo(() => {
    if (!rawData || (!tagFilter && !classFilter)) return rawData;
    const meta = rawData.customerMeta || {};
    const match = (value: string, filter: string) => !filter || (filter === NO_VALUE ? !value : value === filter);
    const keep = (customerId: string) => {
      const m = meta[norm(customerId)] || { tag: '', cls: '' };
      return match(m.tag, tagFilter) && match(m.cls, classFilter);
    };
    return { ...rawData, sales: rawData.sales.filter((l) => keep(l.customerId)), ledger: rawData.ledger.filter((r) => keep(r.customerId)) };
  }, [rawData, tagFilter, classFilter]);

  return (
    <SalespersonDataContext.Provider
      value={{
        salespersons,
        canChoose,
        listLoading,
        selectedId,
        setSelectedId,
        period,
        setPeriod,
        agingMode,
        setAgingMode,
        data,
        tagOptions,
        classOptions,
        tagFilter,
        setTagFilter,
        classFilter,
        setClassFilter,
        minDays,
        setMinDays,
        loading,
        isRefreshing,
        error,
        refresh: () => load(true),
      }}
    >
      {children}
    </SalespersonDataContext.Provider>
  );
}

export function UseSalespersonData() {
  const ctx = useContext(SalespersonDataContext);
  if (!ctx) throw new Error('UseSalespersonData must be used within SalespersonDataProvider');
  return ctx;
}
