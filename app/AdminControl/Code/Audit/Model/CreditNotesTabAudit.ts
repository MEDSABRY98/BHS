'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export type CreditNotesAuditTabId = 'new' | 'notes';

export const CREDIT_NOTES_TAB_LABELS: Record<CreditNotesAuditTabId, string> = {
  new: 'New Credit Note',
  notes: 'Credit Notes',
};

export function useCreditNotesTabAudit(activeTab: CreditNotesAuditTabId) {
  useModuleTabAudit(CREDIT_NOTES_TAB_LABELS[activeTab]);
}
