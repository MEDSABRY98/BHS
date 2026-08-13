'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { bhs_supabas, fetchAllData } from '@/lib/supabase';

export type LpoDataContextValue = {
  users: any[];
  customers: any[];
  drivers: any[];
  assignedDrivers: any[];
  orders: any[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const LpoDataContext = createContext<LpoDataContextValue | null>(null);

export function useLpoData(): LpoDataContextValue {
  const context = useContext(LpoDataContext);
  if (!context) {
    throw new Error('useLpoData must be used within LpoDataProvider');
  }
  return context;
}

function buildAssignedDrivers(drivers: any[], users: any[]) {
  const driverIds = [
    ...new Set(drivers.map((d) => d.DRIVERS_NAME).filter(Boolean)),
  ] as string[];
  const userById = new Map(users.map((u) => [u.ID, u]));

  return driverIds
    .map((id) => userById.get(id) || { ID: id, NAME: id })
    .sort((a, b) => String(a.NAME || '').localeCompare(String(b.NAME || '')));
}

const ORDERS_SELECT = `
  *,
  bhs_CUSTOMERS ( "CUSTOMER NAME":"CUSTOMER SUB NAME", "CUSTOMER CITY" ),
  app_lpos_DRIVERS (
    ID,
    DRIVERS_NAME,
    OFFICE_HANDOVER_ID,
    OFFICE_HANDOVER_STATUS,
    OFFICE_HANDOVER_TIME,
    DELIVERY_TIME,
    TRACKING_NOTES,
    STATUS
  )
`;

export function LpoDataProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const [usersData, customersData, driversData, ordersData] = await Promise.all([
        fetchAllData(() => bhs_supabas.from('bhs_USERS').select('*').order('NAME')),
        fetchAllData(() =>
          bhs_supabas
            .from('bhs_CUSTOMERS')
            .select('*, "CUSTOMER NAME":"CUSTOMER SUB NAME"')
            .order('CUSTOMER SUB NAME'),
        ),
        fetchAllData(() =>
          bhs_supabas.from('app_lpos_DRIVERS').select('*').order('ID', { ascending: false }),
        ),
        fetchAllData(() =>
          bhs_supabas
            .from('app_lpos_ORDERS')
            .select(ORDERS_SELECT)
            .order('CREATED_AT', { ascending: false }),
        ),
      ]);

      setUsers(usersData || []);
      setCustomers(customersData || []);
      setDrivers(driversData || []);
      setOrders(ordersData || []);
    } catch (err) {
      console.error('Failed to preload LPO data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load LPO data');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll(true);
  }, [loadAll]);

  const assignedDrivers = useMemo(
    () => buildAssignedDrivers(drivers, users),
    [drivers, users],
  );

  const refresh = useCallback(() => loadAll(false), [loadAll]);

  const value = useMemo<LpoDataContextValue>(
    () => ({
      users,
      customers,
      drivers,
      assignedDrivers,
      orders,
      loading,
      error,
      refresh,
    }),
    [users, customers, drivers, assignedDrivers, orders, loading, error, refresh],
  );

  return <LpoDataContext.Provider value={value}>{children}</LpoDataContext.Provider>;
}
