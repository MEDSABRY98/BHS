'use client';

import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

type ICPageLoadingValue = {
  loadingTabs: ReadonlySet<string>;
  setTabLoading: (tabId: string, loading: boolean) => void;
};

const ICPageLoadingContext = createContext<ICPageLoadingValue | null>(null);

/** Lets each tab tell the page "my first data load is still running", so the page shows only the loader. */
export function ICPageLoadingProvider({ children }: { children: React.ReactNode }) {
  const [loadingTabs, setLoadingTabs] = useState<ReadonlySet<string>>(new Set());

  const setTabLoading = useCallback((tabId: string, loading: boolean) => {
    setLoadingTabs((prev) => {
      if (prev.has(tabId) === loading) return prev;
      const next = new Set(prev);
      if (loading) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ loadingTabs, setTabLoading }), [loadingTabs, setTabLoading]);
  return <ICPageLoadingContext.Provider value={value}>{children}</ICPageLoadingContext.Provider>;
}

export function useICPageLoading(): ICPageLoadingValue {
  const ctx = useContext(ICPageLoadingContext);
  return ctx ?? { loadingTabs: new Set(), setTabLoading: () => {} };
}

/** Call inside a tab: while `loading` is true the page hides the title/toolbars and shows one full loader. */
export function useICTabInitialLoading(tabId: string, loading: boolean) {
  const { setTabLoading } = useICPageLoading();
  // layout effect = runs before paint, so the title/search never flash before the loader
  useLayoutEffect(() => {
    setTabLoading(tabId, loading);
  }, [tabId, loading, setTabLoading]);
  useLayoutEffect(() => () => setTabLoading(tabId, false), [tabId, setTabLoading]);
}
