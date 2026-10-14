'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export type PettyCashAuditTabId = 'new' | 'records';

export const PETTY_CASH_TAB_LABELS: Record<PettyCashAuditTabId, string> = {
  new: 'New Petty Cash',
  records: 'My Petty Cash',
};

export function usePettyCashTabAudit(activeTab: PettyCashAuditTabId) {
  useModuleTabAudit(PETTY_CASH_TAB_LABELS[activeTab]);
}
