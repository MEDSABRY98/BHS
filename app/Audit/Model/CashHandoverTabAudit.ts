'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export type CashHandoverTabId = 'new' | 'saved';

export const CASH_HANDOVER_TAB_LABELS: Record<CashHandoverTabId, string> = {
  new: 'New Handover',
  saved: 'Saved Handovers',
};

export function useCashHandoverTabAudit(activeTab: CashHandoverTabId) {
  useModuleTabAudit(CASH_HANDOVER_TAB_LABELS[activeTab]);
}
