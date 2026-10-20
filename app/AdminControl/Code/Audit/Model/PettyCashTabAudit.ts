'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export type PettyCashAuditTabId = 'new' | 'records' | 'analysis';

export const PETTY_CASH_TAB_LABELS: Record<PettyCashAuditTabId, string> = {
  new: 'New Petty Cash',
  records: 'My Petty Cash',
  analysis: 'Analysis',
};

export function usePettyCashTabAudit(activeTab: PettyCashAuditTabId) {
  useModuleTabAudit(PETTY_CASH_TAB_LABELS[activeTab]);
}
