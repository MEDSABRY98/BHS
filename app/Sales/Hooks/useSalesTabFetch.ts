'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SalesCommonFilters } from '@/app/Sales/Model/SalesFilters';
import { buildSalesFetchKey } from '@/app/Sales/Utils/SalesFetchKeys';

const inFlightRequests = new Map<string, Promise<unknown>>();

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

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(enabled && !!userId);
  const [error, setError] = useState<string | null>(null);
  const fetchRequestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    if (!userId) return;
    const requestId = ++fetchRequestId.current;
    const cacheKey = buildSalesFetchKey(tabKey, userId, filters, dataVersion, extraKey);

    setLoading(true);
    try {
      let promise = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
      if (!promise) {
        promise = fetcherRef.current();
        inFlightRequests.set(cacheKey, promise);
        promise.finally(() => {
          if (inFlightRequests.get(cacheKey) === promise) {
            inFlightRequests.delete(cacheKey);
          }
        });
      }

      const result = await promise;
      if (requestId !== fetchRequestId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load data');
      console.error(`Error fetching ${tabKey}:`, err);
    } finally {
      if (requestId === fetchRequestId.current) {
        setLoading(false);
      }
    }
  }, [tabKey, userId, filters, dataVersion, extraKey]);

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false);
      return;
    }
    reload();
  }, [enabled, userId, reload]);

  const isInitialLoading = loading && data === null;
  const isRefreshing = loading && data !== null;

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
