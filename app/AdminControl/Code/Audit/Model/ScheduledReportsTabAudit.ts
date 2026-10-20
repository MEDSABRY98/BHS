'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export type ScheduledReportsAuditTabId = 'reports' | 'log';

export const SCHEDULED_REPORTS_TAB_LABELS: Record<ScheduledReportsAuditTabId, string> = {
  reports: 'Reports',
  log: 'Send Log',
};

export function useScheduledReportsTabAudit(activeTab: ScheduledReportsAuditTabId) {
  useModuleTabAudit(SCHEDULED_REPORTS_TAB_LABELS[activeTab]);
}
