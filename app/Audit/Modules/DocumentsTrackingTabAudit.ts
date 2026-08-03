'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export type DocumentsTrackingTabId = 'register' | 'list' | 'receivers';

export const DOCUMENTS_TRACKING_TAB_LABELS: Record<DocumentsTrackingTabId, string> = {
  register: 'Register New Check',
  list: 'View Checks',
  receivers: 'Office Receivers',
};

export function useDocumentsTrackingTabAudit(activeSubTab: DocumentsTrackingTabId) {
  useModuleTabAudit(DOCUMENTS_TRACKING_TAB_LABELS[activeSubTab]);
}
