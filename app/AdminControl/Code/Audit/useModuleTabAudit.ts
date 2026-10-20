'use client';

import { useEffect } from 'react';
import { EnsureCurrentModuleSession, RefreshCurrentModuleAudit } from './ActivityQueue';

export function useModuleTabAudit(tabLabel: string | null | undefined) {
  const normalized = tabLabel?.trim() || null;

  useEffect(() => {
    RefreshCurrentModuleAudit(normalized);
  }, [normalized]);

  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      void EnsureCurrentModuleSession().then((ready) => {
        if (ready && normalized) {
          RefreshCurrentModuleAudit(normalized);
        }
      });
      if (attempts >= 12) {
        clearInterval(timer);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [normalized]);
}

/** Call after module auth finishes so visit/tabs record even if audit ran before login. */
export function useAuditAfterAuth(isReady: boolean, tabLabel?: string | null) {
  const normalized = tabLabel?.trim() || null;

  useEffect(() => {
    if (!isReady) return;
    void EnsureCurrentModuleSession().then((ready) => {
      if (!ready) return;
      if (normalized) {
        RefreshCurrentModuleAudit(normalized);
      }
    });
  }, [isReady, normalized]);
}
