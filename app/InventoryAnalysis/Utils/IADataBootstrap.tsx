'use client';

import React, { useEffect, useState } from 'react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { clearIAPrefetch, prefetchIABootstrap } from './IAPrefetchCache';

type IADataBootstrapProps = {
  children: React.ReactNode;
};

/** Loads Products Balance + locations, then reveals tabs; other tabs warm in background. */
export default function IADataBootstrap({ children }: IADataBootstrapProps) {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    setReady(false);
    setFadeOut(false);
    clearIAPrefetch();

    (async () => {
      try {
        await prefetchIABootstrap();
      } catch (e) {
        console.error('Inventory Analysis bootstrap failed', e);
      }
      if (cancelled) return;
      setFadeOut(true);
      fadeTimer = setTimeout(() => {
        if (cancelled) return;
        setReady(true);
      }, 350);
    })();

    return () => {
      cancelled = true;
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, []);

  if (!ready) {
    return (
      <div className={`w-full transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
        <TabLoader />
      </div>
    );
  }

  return <>{children}</>;
}
