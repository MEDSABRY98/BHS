'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export type DebitNotesAuditTabId = 'new' | 'notes';

export const DEBIT_NOTES_TAB_LABELS: Record<DebitNotesAuditTabId, string> = {
  new: 'New Debit Note',
  notes: 'Debit Notes',
};

export function useDebitNotesTabAudit(activeTab: DebitNotesAuditTabId) {
  useModuleTabAudit(DEBIT_NOTES_TAB_LABELS[activeTab]);
}
