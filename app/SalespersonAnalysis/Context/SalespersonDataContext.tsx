'use client';

// Selected salesperson + period + loaded data, shared by the three sections.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
  data: SalespersonData | null;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const SalespersonDataContext = createContext<SalespersonDataContextValue | null>(null);

export function SalespersonDataProvider({ children }: { children: React.ReactNode }) {
  const [salespersons, setSalespersons] = useState<SalespersonOption[]>([]);
  const [canChoose, setCanChoose] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [period, setPeriod] = useState<Period>(DefaultPeriod);
  const [agingMode, setAgingMode] = useState<AgingMode>('days');
  const [data, setData] = useState<SalespersonData | null>(null);
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
