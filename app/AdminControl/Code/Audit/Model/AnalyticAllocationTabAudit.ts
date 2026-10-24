'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export type AnalyticAllocationAuditTabId = 'accounts' | 'people' | 'allocate' | 'archive';

export const ANALYTIC_ALLOCATION_TAB_LABELS: Record<AnalyticAllocationAuditTabId, string> = {
  accounts: 'Analytic Accounts',
  people: 'People',
  allocate: 'Allocate',
  archive: 'Archive',
};

export function useAnalyticAllocationTabAudit(activeTab: AnalyticAllocationAuditTabId) {
  useModuleTabAudit(ANALYTIC_ALLOCATION_TAB_LABELS[activeTab]);
}
