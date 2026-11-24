'use client';

// Expected Cash — one place for the two forecasts:
//   • collections: what customers are expected to pay (customers ledger, same data as Customers Analysis)
//   • payments:    what we are expected to pay suppliers (suppliers ledger)
// Each dataset is loaded the first time its tab opens (ensure) and can be refreshed on its own.

import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import type { InvoiceRow } from '@/types';
import { getDebitData } from '@/app/CustomersAnalysis/Service/debit_service';
import {
  fetchSuppliersList,
  fetchSupplierTransactions,
  type SupplierRecord,
  type SupplierTransaction,
} from '@/app/SuppliersAnalysis/Service/suppliers_service';

export type ExpectedCashTab = 'collections' | 'payments';
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface ExpectedCashContextType {
  collections: { data: InvoiceRow[]; status: LoadStatus; error: string | null; refreshing: boolean };
  payments: { suppliers: SupplierRecord[]; transactions: SupplierTransaction[]; status: LoadStatus; error: string | null; refreshing: boolean };
  /** Loads the tab's data the first time (does nothing when it is already loaded / loading). */
  ensure: (tab: ExpectedCashTab) => void;
  /** Reloads the tab's data (the old numbers stay on screen meanwhile). */
  refresh: (tab: ExpectedCashTab) => Promise<void>;
  /** Filters of the Expected Collections tab. */
  selectedTags: string[];
  setSelectedTags: (v: string[]) => void;
  selectedClasses: string[];
  setSelectedClasses: (v: string[]) => void;
  selectedCities: string[];
  setSelectedCities: (v: string[]) => void;
}

const Ctx = createContext<ExpectedCashContextType | undefined>(undefined);

export function ExpectedCashProvider({ children }: { children: ReactNode }) {
  const [collectionsData, setCollectionsData] = useState<InvoiceRow[]>([]);
  const [collectionsStatus, setCollectionsStatus] = useState<LoadStatus>('idle');
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [collectionsRefreshing, setCollectionsRefreshing] = useState(false);

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [paymentsStatus, setPaymentsStatus] = useState<LoadStatus>('idle');
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentsRefreshing, setPaymentsRefreshing] = useState(false);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const started = useRef<Record<ExpectedCashTab, boolean>>({ collections: false, payments: false });

  const loadCollections = useCallback(async (silent: boolean) => {
    if (silent) setCollectionsRefreshing(true);
    else {
      setCollectionsStatus('loading');
      setCollectionsError(null);
    }
    try {
      const res = await getDebitData();
      setCollectionsData(res?.data || []);
      setCollectionsStatus('ready');
      setCollectionsError(null);
    } catch (err: any) {
      if (silent) console.error('Refresh failed:', err);
      else {
        setCollectionsError(err?.message || 'Failed to load the customers data');
        setCollectionsStatus('error');
      }
    } finally {
      setCollectionsRefreshing(false);
    }
  }, []);

  const loadPayments = useCallback(async (silent: boolean) => {
    if (silent) setPaymentsRefreshing(true);
    else {
      setPaymentsStatus('loading');
      setPaymentsError(null);
    }
    try {
      const [supps, trans] = await Promise.all([fetchSuppliersList(), fetchSupplierTransactions()]);
      setSuppliers(supps);
      setTransactions(trans);
      setPaymentsStatus('ready');
      setPaymentsError(null);
    } catch (err: any) {
      if (silent) console.error('Refresh failed:', err);
      else {
        setPaymentsError(err?.message || 'Failed to load the suppliers data');
        setPaymentsStatus('error');
      }
    } finally {
      setPaymentsRefreshing(false);
    }
  }, []);

  const ensure = useCallback(
    (tab: ExpectedCashTab) => {
      if (started.current[tab]) return;
      started.current[tab] = true;
      void (tab === 'collections' ? loadCollections(false) : loadPayments(false));
    },
    [loadCollections, loadPayments],
  );

  const refresh = useCallback(
    async (tab: ExpectedCashTab) => {
      started.current[tab] = true;
      // after an error there is nothing on screen yet: reload with the loader; otherwise refresh quietly
      if (tab === 'collections') await loadCollections(collectionsStatus === 'ready');
      else await loadPayments(paymentsStatus === 'ready');
    },
    [loadCollections, loadPayments, collectionsStatus, paymentsStatus],
  );

  const value = useMemo<ExpectedCashContextType>(
    () => ({
      collections: { data: collectionsData, status: collectionsStatus, error: collectionsError, refreshing: collectionsRefreshing },
      payments: { suppliers, transactions, status: paymentsStatus, error: paymentsError, refreshing: paymentsRefreshing },
      ensure,
      refresh,
      selectedTags,
      setSelectedTags,
      selectedClasses,
      setSelectedClasses,
      selectedCities,
      setSelectedCities,
    }),
    [collectionsData, collectionsStatus, collectionsError, collectionsRefreshing, suppliers, transactions, paymentsStatus, paymentsError, paymentsRefreshing, ensure, refresh, selectedTags, selectedClasses, selectedCities],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExpectedCash() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useExpectedCash must be used within an ExpectedCashProvider');
  return ctx;
}
