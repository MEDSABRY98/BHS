'use client';

import React, { useEffect, useState } from 'react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { useInventoryCountingArchive } from '../Archives/InventoryCountingArchiveContext';
import { clearICPrefetch, prefetchICBootstrap } from './ICPrefetchCache';

type ICDataBootstrapProps = {
  children: React.ReactNode;
  onReady?: () => void;
};

/** Loads Total Count + User Comparison + Record once, then reveals tabs. */
export default function ICDataBootstrap({ children, onReady }: ICDataBootstrapProps) {
  const { archiveId, sessionVersion } = useInventoryCountingArchive();
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    setReady(false);
    setFadeOut(false);
    clearICPrefetch();

    (async () => {
      try {
        await prefetchICBootstrap(archiveId);
      } catch (e) {
        console.error('Inventory Counting bootstrap failed', e);
      }
      if (cancelled) return;
      setFadeOut(true);
      fadeTimer = setTimeout(() => {
        if (cancelled) return;
        onReady?.();
        setReady(true);
      }, 350);
    })();

    return () => {
      cancelled = true;
      if (fadeTimer) clearTimeout(fadeTimer);
    };
    // onReady is expected to be stable (useCallback) from the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveId, sessionVersion]);

  if (!ready) {
    return (
      <div className={`w-full transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
        <TabLoader />
      </div>
    );
  }

  return <>{children}</>;
}
