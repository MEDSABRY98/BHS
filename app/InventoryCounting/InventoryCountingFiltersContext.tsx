'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  fetchICFilterOptions,
  fetchArchivedICFilterOptions,
} from './Service/inventory_counting_service';
import { useInventoryCountingArchive } from './InventoryCountingArchiveContext';

type InventoryCountingFiltersContextValue = {
  selectedUsers: string[];
  selectedWarehouses: string[];
  setSelectedUsers: (users: string[]) => void;
  setSelectedWarehouses: (warehouses: string[]) => void;
  toggleUser: (user: string) => void;
  toggleWarehouse: (warehouse: string) => void;
  users: string[];
  warehouses: string[];
  loadingOptions: boolean;
};

const InventoryCountingFiltersContext = createContext<InventoryCountingFiltersContextValue | null>(null);

export function matchesICUser(user: string, selectedUsers: string[]): boolean {
  return selectedUsers.length === 0 || selectedUsers.includes(user);
}

export function matchesICWarehouse(warehouse: string, selectedWarehouses: string[]): boolean {
  return selectedWarehouses.length === 0 || selectedWarehouses.includes(warehouse);
}

export function hasICScopeFilter(selectedUsers: string[], selectedWarehouses: string[]): boolean {
  return selectedUsers.length > 0 || selectedWarehouses.length > 0;
}

export function InventoryCountingFiltersProvider({ children }: { children: React.ReactNode }) {
  const { archiveId, sessionVersion } = useInventoryCountingArchive();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const toggleUser = (user: string) => {
    setSelectedUsers((prev) =>
      prev.includes(user) ? prev.filter((name) => name !== user) : [...prev, user]
    );
  };

  const toggleWarehouse = (warehouse: string) => {
    setSelectedWarehouses((prev) =>
      prev.includes(warehouse) ? prev.filter((name) => name !== warehouse) : [...prev, warehouse]
    );
  };

  useEffect(() => {
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const result = archiveId
          ? await fetchArchivedICFilterOptions(archiveId)
          : await fetchICFilterOptions();
        if (cancelled || !result.success) return;
        setUsers(result.users || []);
        setWarehouses(result.warehouses || []);
      } catch (err) {
        console.error('Failed to load IC filter options', err);
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [archiveId, sessionVersion]);

  return (
    <InventoryCountingFiltersContext.Provider
      value={{
        selectedUsers,
        selectedWarehouses,
        setSelectedUsers,
        setSelectedWarehouses,
        toggleUser,
        toggleWarehouse,
        users,
        warehouses,
        loadingOptions,
      }}
    >
      {children}
    </InventoryCountingFiltersContext.Provider>
  );
}

export function useInventoryCountingFilters() {
  const ctx = useContext(InventoryCountingFiltersContext);
  if (!ctx) {
    throw new Error('useInventoryCountingFilters must be used within InventoryCountingFiltersProvider');
  }
  return ctx;
}
