'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SalesCommonFilters } from '@/app/Sales/Model/SalesFilters';
import { getSalesRawDataBundle } from '@/app/Sales/Service/SalesRawBundle';
import { buildSalesFetchKey } from '@/app/Sales/Utils/SalesFetchKeys';
import { useSalesDataContext } from '@/app/Sales/Context/SalesDataContext';

export type SalesDailySalesBundle = {
  dailySalesData: any[];
  salesByDayData: any[];
  avgSalesByDayData: any[];
};

export type SalesStatisticsBundle = {
  areaStats: { stats: any[]; monthlyData: Record<string, any> };
  marketStats: { stats: any[]; monthlyData: Record<string, any> };
  merchandiserStats: { stats: any[]; monthlyData: Record<string, any> };
  salesRepStats: { stats: any[]; monthlyData: Record<string, any> };
};

export type SalesStockReportBundle = {
  customersData: any[];
  subCustomersData: any[];
  productList: any[];
};

export interface SalesRawDataContextValue {
  dailySales: SalesDailySalesBundle | null;
  statistics: SalesStatisticsBundle | null;
  stockReport: SalesStockReportBundle | null;
  loading: boolean;
  isRefreshing: boolean;
  isInitialLoading: boolean;
  error: string | null;
  ensureRawData: () => Promise<void>;
  invalidateRawData: () => void;
}

const EMPTY_DAILY: SalesDailySalesBundle = {
  dailySalesData: [],
  salesByDayData: [],
  avgSalesByDayData: [],
};

const EMPTY_STATS: SalesStatisticsBundle = {
  areaStats: { stats: [], monthlyData: {} },
  marketStats: { stats: [], monthlyData: {} },
  merchandiserStats: { stats: [], monthlyData: {} },
  salesRepStats: { stats: [], monthlyData: {} },
};

const EMPTY_STOCK: SalesStockReportBundle = {
  customersData: [],
  subCustomersData: [],
  productList: [],
};

const SalesRawDataContext = createContext<SalesRawDataContextValue | null>(null);

export function SalesRawDataProvider({
  children,
  userId,
  filters,
  invoiceTypeFilter,
}: {
  children: React.ReactNode;
  userId: string;
  filters: SalesCommonFilters;
  invoiceTypeFilter: string;
}) {
  const { dataVersion } = useSalesDataContext();
  const [dailySales, setDailySales] = useState<SalesDailySalesBundle | null>(null);
  const [statistics, setStatistics] = useState<SalesStatisticsBundle | null>(null);
  const [stockReport, setStockReport] = useState<SalesStockReportBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRequestId = useRef(0);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const cacheKeyRef = useRef('');

  const currentKey = useMemo(
    () => buildSalesFetchKey('raw-bundle', userId, filters, dataVersion, invoiceTypeFilter),
    [userId, filters, dataVersion, invoiceTypeFilter]
  );

  const loadRawData = useCallback(async () => {
    if (!userId) return;

    const requestId = ++fetchRequestId.current;
    const hasExisting = cacheKeyRef.current !== '' && (dailySales !== null || statistics !== null || stockReport !== null);
    setLoading(true);

    try {
      const bundle = await getSalesRawDataBundle(userId, filters, invoiceTypeFilter);
      if (requestId !== fetchRequestId.current) return;

      setDailySales(bundle.dailySales);
      setStatistics(bundle.statistics);
      setStockReport(bundle.stockReport);
      cacheKeyRef.current = currentKey;
      setError(null);
    } catch (err) {
      if (requestId !== fetchRequestId.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load sales raw data');
      if (!hasExisting) {
        setDailySales(EMPTY_DAILY);
        setStatistics(EMPTY_STATS);
        setStockReport(EMPTY_STOCK);
      }
    } finally {
      if (requestId === fetchRequestId.current) {
        setLoading(false);
      }
    }
  }, [userId, filters, invoiceTypeFilter, currentKey]);

  const ensureRawData = useCallback(async () => {
    if (!userId) return;
    if (cacheKeyRef.current === currentKey && dailySales !== null) return;
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return;
    }
    const promise = loadRawData().finally(() => {
      loadPromiseRef.current = null;
    });
    loadPromiseRef.current = promise;
    await promise;
  }, [userId, currentKey, dailySales, loadRawData]);

  const invalidateRawData = useCallback(() => {
    cacheKeyRef.current = '';
    setDailySales(null);
    setStatistics(null);
    setStockReport(null);
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (cacheKeyRef.current === currentKey && dailySales !== null) return;
    void loadRawData();
  }, [userId, currentKey, loadRawData, dailySales]);

  const isRefreshing = loading && (dailySales !== null || statistics !== null || stockReport !== null);
  const isInitialLoading = loading && dailySales === null && statistics === null && stockReport === null;

  const value = useMemo(
    () => ({
      dailySales,
      statistics,
      stockReport,
      loading,
      isRefreshing,
      isInitialLoading,
      error,
      ensureRawData,
      invalidateRawData,
    }),
    [dailySales, statistics, stockReport, loading, isRefreshing, isInitialLoading, error, ensureRawData, invalidateRawData]
  );

  return <SalesRawDataContext.Provider value={value}>{children}</SalesRawDataContext.Provider>;
}

export function useSalesRawData(): SalesRawDataContextValue {
  const context = useContext(SalesRawDataContext);
  if (!context) {
    throw new Error('useSalesRawData must be used within SalesRawDataProvider');
  }
  return context;
}

export function useSalesRawDataOptional(): SalesRawDataContextValue | null {
  return useContext(SalesRawDataContext);
}
