'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchICSessionData, fetchICSessions, type ICSession, type ICSessionData } from './ICSessionsService';
import { useICTabInitialLoading } from '../Utils/ICPageLoading';

const STORAGE_KEY = 'ic_selected_session';

type ICSessionContextValue = {
  sessions: ICSession[];
  selectedId: number | null;
  setSelectedId: (id: number) => void;
  data: ICSessionData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ICSessionContext = createContext<ICSessionContextValue | null>(null);

/** Shares the chosen count session (and its data) between Total Count, User Comparison and Record. */
export function ICSessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<ICSession[]>([]);
  const [selectedId, setSelectedIdState] = useState<number | null>(null);
  const [data, setData] = useState<ICSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const loadData = useCallback(async (id: number | null) => {
    const mySeq = ++seq.current;
    if (id === null) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchICSessionData(id);
      if (mySeq !== seq.current) return;
      setData(result);
    } catch (e) {
      if (mySeq !== seq.current) return;
      setError(e instanceof Error ? e.message : 'Could not load the count session.');
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, []);

  const loadSessions = useCallback(async (): Promise<number | null> => {
    const list = await fetchICSessions();
    setSessions(list);
    let stored: number | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      stored = raw ? Number(raw) : null;
    } catch {
      stored = null;
    }
    const pick =
      list.find((s) => s.id === stored)?.id ??
      list.find((s) => s.status === 'OPEN')?.id ??
      list[0]?.id ??
      null;
    return pick;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const pick = await loadSessions();
        setSelectedIdState(pick);
        await loadData(pick);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the count sessions.');
        setLoading(false);
      }
    })();
  }, [loadSessions, loadData]);

  const setSelectedId = useCallback(
    (id: number) => {
      setSelectedIdState(id);
      try {
        sessionStorage.setItem(STORAGE_KEY, String(id));
      } catch {
        // storage not available
      }
      void loadData(id);
    },
    [loadData],
  );

  const refresh = useCallback(async () => {
    try {
      await loadSessions();
    } catch {
      // keep the current list
    }
    await loadData(selectedId);
  }, [loadSessions, loadData, selectedId]);

  return (
    <ICSessionContext.Provider value={{ sessions, selectedId, setSelectedId, data, loading, error, refresh }}>
      {children}
    </ICSessionContext.Provider>
  );
}

export function useICSession(): ICSessionContextValue {
  const ctx = useContext(ICSessionContext);
  if (!ctx) throw new Error('useICSession must be used inside ICSessionProvider');
  return ctx;
}

/** Wires the sidebar Refresh button + spinner to this context for one tab. */
export function useICTabRefresh(tabId: string) {
  const { refresh, loading, data } = useICSession();
  // first load of the session data -> the page shows only the loader (no title / search / dropdowns)
  useICTabInitialLoading(tabId, loading && !data);

  useEffect(() => {
    const onTrigger = (e: Event) => {
      if ((e as CustomEvent).detail?.activeTab === tabId) void refresh();
    };
    window.addEventListener('inventory-counting-trigger-refresh', onTrigger);
    return () => window.removeEventListener('inventory-counting-trigger-refresh', onTrigger);
  }, [tabId, refresh]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('inventory-counting-refresh-state', { detail: { activeTab: tabId, isRefreshing: loading } }),
    );
  }, [tabId, loading]);
}
