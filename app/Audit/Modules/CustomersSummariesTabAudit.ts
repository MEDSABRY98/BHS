'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export const CUSTOMERS_SUMMARIES_VIEW = 'Customers Summaries';

export function useCustomersSummariesTabAudit() {
  useEffect(() => {
    TrackModuleSubTab(CUSTOMERS_SUMMARIES_VIEW);
  }, []);
}
