'use client';

// Supports + sales lines + computed results, shared by the sections.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { GetRoiData } from '../Service/RoiService';
import { ComputeAll, ComputeMonthly, GroupBySalesperson, type MonthGroup, type SalespersonGroup } from '../Utils/RoiCalc';
import type { RoiData, RoiResult } from '../Utils/Types';

type RoiContextValue = {
  data: RoiData | null;
  /** full-period result per support (customers A-Z) */
  results: RoiResult[];
  /** the same supports grouped under their salesperson */
  salespersons: SalespersonGroup[];
  /** one single-month result per support and month, newest month first */
  months: MonthGroup[];
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectedId: string;
  setSelectedId: (id: string) => void;
};

const RoiContext = createContext<RoiContextValue | null>(null);

export function RoiProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<RoiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState('');

  const load = useCallback(async (silent: boolean) => {
    if (silent) setIsRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await GetRoiData());
    } catch (e: any) {
      setError(e?.message || 'Failed to load the ROI data');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const results = useMemo(() => (data ? ComputeAll(data) : []), [data]);
  const salespersons = useMemo(() => (data ? GroupBySalesperson(data) : []), [data]);
  const months = useMemo(() => (data ? ComputeMonthly(data) : []), [data]);

  // keep the selection valid after add / delete
  useEffect(() => {
    if (!results.length) {
      if (selectedId) setSelectedId('');
    } else if (!results.some((r) => r.support.id === selectedId)) {
      setSelectedId(results[0].support.id);
    }
  }, [results, selectedId]);

  return (
    <RoiContext.Provider
      value={{ data, results, salespersons, months, loading, isRefreshing, error, refresh: () => load(true), selectedId, setSelectedId }}
    >
      {children}
    </RoiContext.Provider>
  );
}

export function UseRoi() {
  const ctx = useContext(RoiContext);
  if (!ctx) throw new Error('UseRoi must be used within RoiProvider');
  return ctx;
}
