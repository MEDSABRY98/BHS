'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef, useCallback } from 'react';
import { InvoiceRow } from '@/types';
import { getDebitData, getPaymentRepAllocation } from '@/app/CustomersAnalysis/Service/debit_service';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';

/** How each payment / refund row is split between sales reps (same rules as Salesperson Analysis). */
export type RepAllocation = Awaited<ReturnType<typeof getPaymentRepAllocation>>;

interface PaymentAnalysisContextType {
  data: InvoiceRow[];
  paymentsData: InvoiceRow[]; // ONLY payments and r-payments
  /** Same as paymentsData but WITHOUT the date filter (tags/classes/cities still applied) — used for year-over-year comparison. */
  paymentsAllDates: InvoiceRow[];
  /** Loaded on demand by the Salespersons tab (null until loaded). */
  repAllocation: RepAllocation | null;
  repAllocationLoading: boolean;
  repAllocationError: string | null;
  loadRepAllocation: () => Promise<void>;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
  selectedTags: string[];
  setSelectedTags: (tags: string[]) => void;
  selectedClasses: string[];
  setSelectedClasses: (classes: string[]) => void;
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
}

const PaymentAnalysisContext = createContext<PaymentAnalysisContextType | undefined>(undefined);

export function PaymentAnalysisProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [data, setData] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  // Rep allocation (loaded the first time the Salespersons tab opens, reset on refresh)
  const [repAllocation, setRepAllocation] = useState<RepAllocation | null>(null);
  const [repAllocationLoading, setRepAllocationLoading] = useState(false);
  const [repAllocationError, setRepAllocationError] = useState<string | null>(null);
  const repAllocationRequest = useRef<Promise<void> | null>(null);

  const loadRepAllocation = useCallback(async () => {
    if (repAllocationRequest.current) return repAllocationRequest.current;
    const request = (async () => {
      setRepAllocationLoading(true);
      setRepAllocationError(null);
      try {
        setRepAllocation(await getPaymentRepAllocation());
      } catch (err: any) {
        setRepAllocationError(err?.message || 'Failed to load the sales reps split');
      } finally {
        setRepAllocationLoading(false);
        repAllocationRequest.current = null;
      }
    })();
    repAllocationRequest.current = request;
    return request;
  }, []);

  const loadData = async (silent = false) => {
    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }
      const res = await getDebitData();
      if (res && res.data) {
        setData(res.data);
      }
      setError(null);
    } catch (err: any) {
      if (silent) {
        // Silent refresh: keep current data on screen, just log the failure
        console.error('Silent refresh failed:', err);
      } else {
        setError(err.message || 'Failed to load payment data');
      }
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const silentRefresh = async () => {
    if (isRefreshing) return;
    await loadData(true);
    setRepAllocation(null); // the split depends on the data: load it again when needed
  };

  useEffect(() => {
    if (enabled) {
      loadData();
    }
  }, [enabled]);

  const paymentsData = useMemo(() => {
    return data.filter(row => {
      const t = getInvoiceType(row);
      // We only care about payments and return payments (refunds/bounced)
      if (t !== 'Payment' && t !== 'R-Payment') return false;

      // Apply global date filter
      if (row.date) {
        const tDateStr = String(row.date).split('T')[0];
        if (dateRange.start && tDateStr < dateRange.start) return false;
        if (dateRange.end && tDateStr > dateRange.end) return false;
      }

      // Apply tags filter
      if (selectedTags.length > 0) {
        if (!row.customerTag) return false;
        const rowTags = row.customerTag.split(',').map(t => t.trim()).filter(Boolean);
        if (!rowTags.some(tag => selectedTags.includes(tag))) return false;
      }

      // Apply classes filter
      if (selectedClasses.length > 0) {
        if (!row.customerClass) return false;
        if (!selectedClasses.includes(row.customerClass.trim())) return false;
      }

      // Apply cities filter
      if (selectedCities.length > 0) {
        if (!row.city) return false;
        if (!selectedCities.includes(row.city.trim())) return false;
      }

      return true;
    });
  }, [data, dateRange, selectedTags, selectedClasses, selectedCities]);

  const paymentsAllDates = useMemo(() => {
    return data.filter(row => {
      const t = getInvoiceType(row);
      if (t !== 'Payment' && t !== 'R-Payment') return false;

      if (selectedTags.length > 0) {
        if (!row.customerTag) return false;
        const rowTags = row.customerTag.split(',').map(t => t.trim()).filter(Boolean);
        if (!rowTags.some(tag => selectedTags.includes(tag))) return false;
      }
      if (selectedClasses.length > 0) {
        if (!row.customerClass) return false;
        if (!selectedClasses.includes(row.customerClass.trim())) return false;
      }
      if (selectedCities.length > 0) {
        if (!row.city) return false;
        if (!selectedCities.includes(row.city.trim())) return false;
      }
      return true;
    });
  }, [data, selectedTags, selectedClasses, selectedCities]);

  return (
    <PaymentAnalysisContext.Provider value={{ 
      data,
      paymentsData,
      paymentsAllDates,
      repAllocation,
      repAllocationLoading,
      repAllocationError,
      loadRepAllocation,
      loading, 
      isRefreshing,
      error, 
      refresh: silentRefresh,
      dateRange,
      setDateRange,
      selectedTags,
      setSelectedTags,
      selectedClasses,
      setSelectedClasses,
      selectedCities,
      setSelectedCities
    }}>
      {children}
    </PaymentAnalysisContext.Provider>
  );
}

export function usePaymentAnalysis() {
  const context = useContext(PaymentAnalysisContext);
  if (context === undefined) {
    throw new Error('usePaymentAnalysis must be used within a PaymentAnalysisProvider');
  }
  return context;
}
