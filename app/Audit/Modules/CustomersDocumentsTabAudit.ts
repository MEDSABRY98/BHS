'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export const CUSTOMERS_DOCUMENTS_VIEW = 'Customers Documents';

export function useCustomersDocumentsTabAudit() {
  useEffect(() => {
    TrackModuleSubTab(CUSTOMERS_DOCUMENTS_VIEW);
  }, []);
}
