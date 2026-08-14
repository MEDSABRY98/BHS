'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export const CUSTOMERS_SUMMARIES_VIEW = 'Customers Summaries';

export function useCustomersSummariesTabAudit(isReady: boolean = true) {
  useModuleTabAudit(isReady ? CUSTOMERS_SUMMARIES_VIEW : null);
}
