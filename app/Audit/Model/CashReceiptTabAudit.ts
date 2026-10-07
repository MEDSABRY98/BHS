'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export type CashReceiptTabId = 'new' | 'saved' | 'stats';

export const CASH_RECEIPT_TAB_LABELS: Record<CashReceiptTabId, string> = {
  new: 'New Receipt',
  saved: 'Saved Receipts',
  stats: 'Statistics',
};

export function useCashReceiptTabAudit(activeTab: CashReceiptTabId) {
  useModuleTabAudit(CASH_RECEIPT_TAB_LABELS[activeTab]);
}
