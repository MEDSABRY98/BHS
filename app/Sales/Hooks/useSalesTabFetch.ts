'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SalesCommonFilters } from '@/app/Sales/Model/SalesFilters';
import { buildSalesFetchKey } from '@/app/Sales/Utils/SalesFetchKeys';
import { useTabActive } from '@/app/Components/Layout/TabPanel';

const inFlightRequests = new Map<string, Promise<unknown>>();

// ── Results already loaded in this browser tab (same key = same tab + user + filters + data version).
//    Going back to a filter you used a minute ago is instant. Refresh changes the data version.
const RESULT_CACHE_MAX = 60;
const RESULT_CACHE_TTL_MS = 10 * 60_000;
const resultCache = new Map<string, { value: unknown; at: number }>();

function readCache<T>(key: string): T | undefined {
  const hit = resultCache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > RESULT_CACHE_TTL_MS) {
    resultCache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function writeCache(key: string, value: unknown) {
  resultCache.delete(key);
  resultCache.set(key, { value, at: Date.now() });
  if (resultCache.size > RESULT_CACHE_MAX) {
    const oldest = resultCache.keys().next().value;
    if (oldest !== undefined) resultCache.delete(oldest);
  }
}

export function useSalesTabFetch<T>(options: {
  tabKey: string;
  userId: string;
  filters: SalesCommonFilters;
  fetcher: () => Promise<T>;
  enabled?: boolean;
  dataVersion?: number;
  extraKey?: string;
  initialData?: T | null;
}) {
  const {
    tabKey,
    userId,
    filters,
    fetcher,
    enabled = true,
    dataVersion = 0,
    extraKey = '',
    initialData = null,
  } = options;

  // Hidden (kept-alive) tabs don't fetch on every filter change; they catch up when shown.
  // Next.js runs server actions one after another, so hidden tabs would delay the visible one.
  const isActive = useTabActive();

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(enabled && !!userId);
  const [error, setError] = useState<string | null>(null);
  const fetchRequestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  const hasLoadedOnceRef = useRef(false);
  const loadedKeyRef = useRef<string | null>(null);
  fetcherRef.current = fetcher;

  const cacheKey = buildSalesFetchKey(tabKey, userId, filters, dataVersion, extraKey);

  const reload = useCallback(async () => {
    if (!userId) return;
    const requestId = ++fetchRequestId.current;
    const key = buildSalesFetchKey(tabKey, userId, filters, dataVersion, extraKey);

    setLoading(true);
    try {
      let promise = inFlightRequests.get(key) as Promise<T> | undefined;
      if (!promise) {
        promise = fetcherRef.current();
        inFlightRequests.set(key, promise);
        promise
          .finally(() => {
            if (inFlightRequests.get(key) === promise) inFlightRequests.delete(key);
          })
          .catch(() => {});
      }

      const result = await promise;
      writeCache(key, result);
      if (requestId !== fetchRequestId.current) return;
      loadedKeyRef.current = key;
      setData(result);
      setError(null);
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error(`Error fetching ${tabKey}:`, err);
    } finally {
      if (requestId === fetchRequestId.current) {
        hasLoadedOnceRef.current = true;
        setLoading(false);
      }
    }
  }, [tabKey, userId, filters, dataVersion, extraKey]);

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false);
      return;
    }
    if (loadedKeyRef.current === cacheKey) return; // already showing this result

    const cached = readCache<T>(cacheKey);
    if (cached !== undefined) {
      fetchRequestId.current++; // drop any older request still running
      loadedKeyRef.current = cacheKey;
      hasLoadedOnceRef.current = true;
      setData(cached);
      setError(null);
      setLoading(false);
      return;
    }

    if (!isActive) return; // load when the tab is opened
    void reload();
  }, [enabled, userId, cacheKey, isActive, reload]);

  const isInitialLoading = loading && !hasLoadedOnceRef.current;
  const isRefreshing = loading && hasLoadedOnceRef.current;

  return {
    data,
    setData,
    loading,
    isInitialLoading,
    isRefreshing,
    error,
    reload,
  };
}
