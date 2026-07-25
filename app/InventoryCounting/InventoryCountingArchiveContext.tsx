'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchInventoryCountArchives,
  type ICArchiveHeader,
} from './Service/inventory_counting_service';

const STORAGE_KEY = 'ic_archive_id';

type InventoryCountingArchiveContextValue = {
  archiveId: string | null;
  archiveMeta: ICArchiveHeader | null;
  archives: ICArchiveHeader[];
  setArchiveId: (id: string | null) => void;
  refreshArchives: () => Promise<void>;
  isArchiveView: boolean;
  isReadOnly: boolean;
  loadingArchives: boolean;
  sessionVersion: number;
  notifySessionClosed: (resetLive: boolean) => void;
};

const InventoryCountingArchiveContext =
  createContext<InventoryCountingArchiveContextValue | null>(null);

export function InventoryCountingArchiveProvider({ children }: { children: React.ReactNode }) {
  const [archiveId, setArchiveIdState] = useState<string | null>(null);
  const [archives, setArchives] = useState<ICArchiveHeader[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(true);
  const [sessionVersion, setSessionVersion] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setArchiveIdState(stored);
    }
  }, []);

  const refreshArchives = useCallback(async () => {
    setLoadingArchives(true);
    try {
      const result = await fetchInventoryCountArchives();
      if (result.success) {
        setArchives(result.data);
      }
    } catch (err) {
      console.error('Failed to load inventory count archives', err);
    } finally {
      setLoadingArchives(false);
    }
  }, []);

  useEffect(() => {
    refreshArchives();
  }, [refreshArchives]);

  const setArchiveId = useCallback((id: string | null) => {
    setArchiveIdState(id);
    if (id) {
      sessionStorage.setItem(STORAGE_KEY, id);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const notifySessionClosed = useCallback((resetLive: boolean) => {
    setSessionVersion((v) => v + 1);
    if (resetLive) {
      setArchiveId(null);
    }
    void refreshArchives();
  }, [refreshArchives, setArchiveId]);

  const archiveMeta = useMemo(
    () => archives.find((a) => a.archiveId === archiveId) || null,
    [archives, archiveId]
  );

  const isArchiveView = archiveId !== null;

  const value = useMemo(
    () => ({
      archiveId,
      archiveMeta,
      archives,
      setArchiveId,
      refreshArchives,
      isArchiveView,
      isReadOnly: isArchiveView,
      loadingArchives,
      sessionVersion,
      notifySessionClosed,
    }),
    [
      archiveId,
      archiveMeta,
      archives,
      setArchiveId,
      refreshArchives,
      isArchiveView,
      loadingArchives,
      sessionVersion,
      notifySessionClosed,
    ]
  );

  return (
    <InventoryCountingArchiveContext.Provider value={value}>
      {children}
    </InventoryCountingArchiveContext.Provider>
  );
}

export function useInventoryCountingArchive() {
  const ctx = useContext(InventoryCountingArchiveContext);
  if (!ctx) {
    throw new Error(
      'useInventoryCountingArchive must be used within InventoryCountingArchiveProvider'
    );
  }
  return ctx;
}

export function canCloseInventoryCountSession(): boolean {
  try {
    const savedUser = localStorage.getItem('currentUser');
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    if (currentUser?.name?.toLowerCase() === 'med sabry') return true;

    const perms = JSON.parse(currentUser?.role || '{}');
    const countingTabs = perms['inventory-counting'];
    if (Array.isArray(countingTabs) && countingTabs.length > 0) {
      if (countingTabs.includes('close_session')) return true;
      if (countingTabs.includes('total_count')) return true;
      return false;
    }

    return true;
  } catch {
    return true;
  }
}
