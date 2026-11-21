'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export type AnalyticReportsAuditTabId = 'upload' | 'regions' | 'hq' | 'accounts';

export const ANALYTIC_REPORTS_TAB_LABELS: Record<AnalyticReportsAuditTabId, string> = {
  upload: 'Upload Report',
  regions: 'Regions Analysis',
  hq: 'HQ / Central',
  accounts: 'Analytic Accounts',
};

export function useAnalyticReportsTabAudit(activeTab: AnalyticReportsAuditTabId) {
  useModuleTabAudit(ANALYTIC_REPORTS_TAB_LABELS[activeTab]);
}
