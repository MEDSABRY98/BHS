'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { InvoiceRow } from '@/types';
import { getDebitData } from '@/app/CustomersAnalysis/Service/debit_service';
import { getInvoiceType } from '@/app/CustomersAnalysis/Utils/InvoiceType';

interface PaymentAnalysisContextType {
  data: InvoiceRow[];
  paymentsData: InvoiceRow[]; // ONLY payments and r-payments
  loading: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getDebitData();
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
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

  return (
    <PaymentAnalysisContext.Provider value={{ 
      data,
      paymentsData,
      loading, 
      error, 
      refresh: loadData,
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
