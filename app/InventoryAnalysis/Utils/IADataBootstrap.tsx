'use client';

import React, { useEffect } from 'react';
import { iaDb } from '../Cache/InventoryAnalysisIndexedDB';
import { syncInventoryAnalysisData } from '../Cache/InventoryAnalysisSyncService';
import { enableCacheMode, disableCacheMode } from '../Service/inventory_service';

type IADataBootstrapProps = {
  children: React.ReactNode;
};

export default function IADataBootstrap({ children }: IADataBootstrapProps) {
  useEffect(() => {
    let cancelled = false;
    let syncTimer: ReturnType<typeof setInterval> | null = null;

    const initialize = async () => {
      try {
        // 1. Check if we have a complete cache
        const meta = await iaDb.sync_metadata.get('main');
        const cacheComplete = meta?.fullSyncComplete === true;

        if (cacheComplete) {
          // Cache is ready → tell the service to read from IndexedDB
          enableCacheMode();
          console.log('[IA Cache] Cache-first mode ON — loading from local DB');

          // Delta sync silently in the background (no blocking)
          syncInventoryAnalysisData().catch(console.error);
        } else {
          // Cache not ready yet → service reads from Supabase (normal)
          disableCacheMode();
          console.log('[IA Cache] No complete cache — filling in background');

          // Fill cache in background without blocking the UI
          syncInventoryAnalysisData().catch(console.error);
        }

        // Periodic background sync every 2 minutes
        syncTimer = setInterval(() => {
          syncInventoryAnalysisData().catch(console.error);
        }, 120_000);

      } catch (err) {
        console.error('[IA Cache] Init error:', err);
        disableCacheMode(); // Fallback to Supabase
      }
    };

    initialize();

    return () => {
      cancelled = true;
      if (syncTimer) clearInterval(syncTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Always show content immediately — no loading screen
  return <>{children}</>;
}

