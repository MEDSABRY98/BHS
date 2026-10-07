'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { 
  SupplierRecord, 
  SupplierTransaction, 
  fetchSuppliersList, 
  fetchSupplierTransactions 
} from '../Service/suppliers_service';

interface SuppliersContextType {
  suppliers: SupplierRecord[];
  transactions: SupplierTransaction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  selectedSupplierId: string | null;
  setSelectedSupplierId: (id: string | null) => void;
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
}

const SuppliersContext = createContext<SuppliersContextType | undefined>(undefined);

export function SuppliersDataProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [supps, trans] = await Promise.all([
        fetchSuppliersList(),
        fetchSupplierTransactions(),
      ]);
      setSuppliers(supps);
      setTransactions(trans);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      loadData();
    }
  }, [enabled]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.DATE) return true;
      const tDateStr = String(t.DATE).split('T')[0];
      if (dateRange.start && tDateStr < dateRange.start) return false;
      if (dateRange.end && tDateStr > dateRange.end) return false;
      return true;
    });
  }, [transactions, dateRange]);

  return (
    <SuppliersContext.Provider value={{ 
      suppliers, 
      transactions: filteredTransactions, 
      loading, 
      error, 
      refresh: loadData,
      selectedSupplierId,
      setSelectedSupplierId,
      dateRange,
      setDateRange
    }}>
      {children}
    </SuppliersContext.Provider>
  );
}

export function useSuppliersData() {
  const context = useContext(SuppliersContext);
  if (context === undefined) {
    throw new Error('useSuppliersData must be used within a SuppliersDataProvider');
  }
  return context;
}
