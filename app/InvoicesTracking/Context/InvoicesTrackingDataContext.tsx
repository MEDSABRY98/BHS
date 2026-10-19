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
import { listInvoicesTrackingUsers } from '../Service/invoices_tracking_users_service';
import { bhs_supabas, fetchAllData } from '@/lib/secureDb';
import { TRACKING_TABLE, withDeliveries } from '../Utils/TrackingTable';

export type InvoicesTrackingFilters = {
  dateFrom: string;
  dateTo: string;
  createdBy: string; // user ID of who entered the order, or 'ALL'
  driver: string;
  status: string;
};

export type InvoicesTrackingDataContextValue = {
  users: any[];
  customers: any[];
  drivers: any[];
  assignedDrivers: any[];
  /** users who entered at least one order (for the Created By filter) */
  creators: any[];
  orders: any[];
  /** orders of the Created By filter (all orders when it is ALL) */
  scopedOrders: any[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  filters: InvoicesTrackingFilters;
  setFilters: React.Dispatch<React.SetStateAction<InvoicesTrackingFilters>>;
};

const InvoicesTrackingDataContext = createContext<InvoicesTrackingDataContextValue | null>(null);

export function useInvoicesTrackingData(): InvoicesTrackingDataContextValue {
  const context = useContext(InvoicesTrackingDataContext);
  if (!context) {
    throw new Error('useInvoicesTrackingData must be used within InvoicesTrackingDataProvider');
  }
  return context;
}

export const DEFAULT_INVOICES_TRACKING_FILTERS: InvoicesTrackingFilters = {
  dateFrom: '',
  dateTo: '',
  createdBy: 'ALL',
  driver: 'ALL',
  status: 'ALL',
};

function buildCreators(orders: any[], users: any[]) {
  const ids = [...new Set(orders.map((o) => String(o.CREATED_BY ?? '').trim()).filter(Boolean))];
  const userById = new Map(users.map((u) => [String(u.ID), u]));
  return ids
    .map((id) => ({ ID: id, NAME: userById.get(id)?.NAME || id }))
    .sort((a, b) => String(a.NAME || '').localeCompare(String(b.NAME || '')));
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
  bhs_CUSTOMERS ( "CUSTOMER NAME":"CUSTOMER SUB NAME", "CUSTOMER CITY" )
`;

export function InvoicesTrackingDataProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoicesTrackingFilters>(DEFAULT_INVOICES_TRACKING_FILTERS);

  const loadAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const [usersData, customersData, ordersData] = await Promise.all([
        listInvoicesTrackingUsers(),
        fetchAllData(() =>
          bhs_supabas
            .from('bhs_CUSTOMERS')
            .select('*, "CUSTOMER NAME":"CUSTOMER SUB NAME"')
            .order('CUSTOMER SUB NAME')
            .order('CUSTOMER ID'),
        ),
        fetchAllData(() =>
          bhs_supabas
            .from(TRACKING_TABLE)
            .select(ORDERS_SELECT)
            .order('CREATED_AT', { ascending: false })
            .order('ID', { ascending: false }),
        ),
      ]);

      setUsers(usersData || []);
      setCustomers(customersData || []);
      // one row = order + its delivery; `drivers` = the deliveries (newest first, like before)
      const rows = (ordersData || []).map(withDeliveries);
      setOrders(rows);
      setDrivers(
        rows
          .map((o: any) => o.deliveries[0])
          .filter(Boolean)
          .sort((a: any, b: any) => String(b.ID).localeCompare(String(a.ID), undefined, { numeric: true })),
      );
    } catch (err) {
      console.error('Failed to preload Invoices Tracking data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Invoices Tracking data');
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

  const creators = useMemo(() => buildCreators(orders, users), [orders, users]);

  const scopedOrders = useMemo(
    () =>
      filters.createdBy && filters.createdBy !== 'ALL'
        ? orders.filter((o) => String(o.CREATED_BY ?? '').trim() === filters.createdBy)
        : orders,
    [orders, filters.createdBy],
  );

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await loadAll(false);
      window.dispatchEvent(new Event('lpo-data-refresh'));
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [loadAll]);

  const value = useMemo<InvoicesTrackingDataContextValue>(
    () => ({
      users,
      customers,
      drivers,
      assignedDrivers,
      creators,
      orders,
      scopedOrders,
      loading,
      refreshing,
      error,
      refresh,
      filters,
      setFilters,
    }),
    [users, customers, drivers, assignedDrivers, creators, orders, scopedOrders, loading, refreshing, error, refresh, filters],
  );

  return <InvoicesTrackingDataContext.Provider value={value}>{children}</InvoicesTrackingDataContext.Provider>;
}
