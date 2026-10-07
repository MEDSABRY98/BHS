'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export const DEBIT_INSIGHTS_VIEW = 'Debit Insights Dashboard';

export function useDebitInsightsTabAudit(isReady: boolean = true) {
  useModuleTabAudit(isReady ? DEBIT_INSIGHTS_VIEW : null);
}
