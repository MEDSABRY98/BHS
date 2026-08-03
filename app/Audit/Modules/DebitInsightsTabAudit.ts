'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export const DEBIT_INSIGHTS_VIEW = 'Debit Insights Dashboard';

export function useDebitInsightsTabAudit() {
  useEffect(() => {
    TrackModuleSubTab(DEBIT_INSIGHTS_VIEW);
  }, []);
}
