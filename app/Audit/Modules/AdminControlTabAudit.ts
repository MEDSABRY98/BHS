'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export const ADMIN_TAB_LABELS: Record<string, string> = {
  'by-user': 'By User',
  'by-module': 'By Module',
  'user-activity': 'User Activity',
};

export function useAdminControlTabAudit(activeTab: string) {
  useModuleTabAudit(ADMIN_TAB_LABELS[activeTab] ?? activeTab);
}
