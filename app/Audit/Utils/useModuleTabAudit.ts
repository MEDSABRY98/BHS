'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from './ActivityQueue';

export function useModuleTabAudit(tabLabel: string | null | undefined) {
  useEffect(() => {
    TrackModuleSubTab(tabLabel?.trim() || null);
  }, [tabLabel]);
}
