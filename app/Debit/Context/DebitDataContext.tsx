'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getCustomerEmails, getLuluCustomerEmails } from '@/app/Emails/Service/email_service';
import { getDebitData, getDebitMetadata } from '../Service/debit_service';
import { buildInvoicesByCustomer } from '../Utils/debitIndexes';
import { InvoiceRow } from '@/types';

export type LuluEmailRecord = {
  customerId: string;
  customerCode?: string;
  to?: string;
  cc?: string;
};

export interface DebitDataContextValue {
  data: InvoiceRow[];
  loading: boolean;
  isRefreshing: boolean;
  dataReady: boolean;
  dataLoading: boolean;
  error: string | null;
  lastUpdated: string | null;
  dataVersion: number;
  invoicesByCustomer: Map<string, InvoiceRow[]>;
  customersWithEmails: Map<string, string>;
  luluEmails: LuluEmailRecord[];
  emailsReady: boolean;
  refresh: (silent?: boolean) => Promise<void>;
  ensureFullData: () => Promise<void>;
  getCustomerInvoices: (customerName: string) => InvoiceRow[];
}

const DebitDataContext = createContext<DebitDataContextValue | null>(null);

function formatLastUpdated(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function lastUpdatedFromRows(rows: InvoiceRow[]): string | null {
  let max = 0;
  for (const row of rows) {
    if (!row.date) continue;
    const t = new Date(row.date).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max > 0 ? formatLastUpdated(new Date(max).toISOString()) : null;
}

export function DebitDataProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [customersWithEmails, setCustomersWithEmails] = useState<Map<string, string>>(new Map());
  const [luluEmails, setLuluEmails] = useState<LuluEmailRecord[]>([]);
  const [emailsReady, setEmailsReady] = useState(false);
  const metaRequestId = useRef(0);
  const fullDataRequestId = useRef(0);
  const fullDataPromiseRef = useRef<Promise<void> | null>(null);
  const emailsLoadedRef = useRef(false);

  const invoicesByCustomer = useMemo(() => buildInvoicesByCustomer(data), [data]);

  const loadEmailsOnce = useCallback(async () => {
    if (emailsLoadedRef.current) return;
    emailsLoadedRef.current = true;
    try {
      const [emailsData, luluData] = await Promise.all([
        getCustomerEmails(),
        getLuluCustomerEmails(),
      ]);

      if (luluData?.customers) {
        setLuluEmails(luluData.customers);
      }

      if (emailsData?.customers) {
        const normalizeId = (id: unknown) =>
          String(id || '').toLowerCase().trim().replace(/\s+/g, ' ');
        const emailMap = new Map<string, string>();
        emailsData.customers.forEach((item: { customerId?: string; email?: string }) => {
          if (item?.customerId && item.email) {
            emailMap.set(normalizeId(item.customerId), item.email);
          }
        });
        setCustomersWithEmails(emailMap);
      }
    } catch (err) {
      console.error('Error loading debit email maps:', err);
      emailsLoadedRef.current = false;
    } finally {
      setEmailsReady(true);
    }
  }, []);

  const loadFullData = useCallback(async () => {
    const requestId = ++fullDataRequestId.current;
    setDataLoading(true);
    try {
      const debitResult = await getDebitData();
      if (requestId !== fullDataRequestId.current) return;
      const rows = Array.isArray(debitResult?.data) ? debitResult.data : [];
      setData(rows);
      setDataVersion((v) => v + 1);
      setDataReady(true);
      setError(null);
      if (!lastUpdated) {
        setLastUpdated(lastUpdatedFromRows(rows));
      }
    } catch (err) {
      if (requestId !== fullDataRequestId.current) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching debit data:', err);
      throw err;
    } finally {
      if (requestId === fullDataRequestId.current) {
        setDataLoading(false);
      }
    }
  }, [lastUpdated]);

  const ensureFullData = useCallback(async () => {
    if (dataReady) return;
    if (fullDataPromiseRef.current) {
      await fullDataPromiseRef.current;
      return;
    }
    const promise = loadFullData().finally(() => {
      fullDataPromiseRef.current = null;
    });
    fullDataPromiseRef.current = promise;
    await promise;
  }, [dataReady, loadFullData]);

  const refresh = useCallback(async (silent = false) => {
    const requestId = ++metaRequestId.current;
    try {
      if (silent) setIsRefreshing(true);
      else setMetaLoading(true);

      const metaResult = await getDebitMetadata().catch(() => null);
      if (requestId !== metaRequestId.current) return;

      const metaLast = metaResult?.success ? formatLastUpdated(metaResult.lastUpdated) : null;
      if (metaLast) setLastUpdated(metaLast);

      void loadEmailsOnce();

      if (dataReady) {
        const requestFullId = ++fullDataRequestId.current;
        setDataLoading(true);
        try {
          const debitResult = await getDebitData();
          if (requestFullId !== fullDataRequestId.current) return;
          const rows = Array.isArray(debitResult?.data) ? debitResult.data : [];
          setData(rows);
          setDataVersion((v) => v + 1);
          setLastUpdated(metaLast || lastUpdatedFromRows(rows));
          setError(null);
        } finally {
          if (requestFullId === fullDataRequestId.current) {
            setDataLoading(false);
          }
        }
      } else {
        setData([]);
        setDataVersion((v) => v + 1);
      }
    } catch (err) {
      if (requestId !== metaRequestId.current) return;
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error refreshing debit metadata:', err);
    } finally {
      if (requestId === metaRequestId.current) {
        setMetaLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [dataReady, loadEmailsOnce]);

  useEffect(() => {
    if (enabled) {
      void refresh(false);
    }
  }, [enabled, refresh]);

  const getCustomerInvoices = useCallback(
    (customerName: string) => invoicesByCustomer.get(customerName) || [],
    [invoicesByCustomer],
  );

  const loading = metaLoading || dataLoading;

  const value = useMemo<DebitDataContextValue>(
    () => ({
      data,
      loading,
      isRefreshing,
      dataReady,
      dataLoading,
      error,
      lastUpdated,
      dataVersion,
      invoicesByCustomer,
      customersWithEmails,
      luluEmails,
      emailsReady,
      refresh,
      ensureFullData,
      getCustomerInvoices,
    }),
    [
      data,
      loading,
      isRefreshing,
      dataReady,
      dataLoading,
      error,
      lastUpdated,
      dataVersion,
      invoicesByCustomer,
      customersWithEmails,
      luluEmails,
      emailsReady,
      refresh,
      ensureFullData,
      getCustomerInvoices,
    ],
  );

  return <DebitDataContext.Provider value={value}>{children}</DebitDataContext.Provider>;
}

export function useDebitData(): DebitDataContextValue {
  const ctx = useContext(DebitDataContext);
  if (!ctx) {
    throw new Error('useDebitData must be used within DebitDataProvider');
  }
  return ctx;
}
