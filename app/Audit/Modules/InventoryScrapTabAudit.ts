'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export type InventoryScrapTabId = 'record' | 'sessions' | 'report' | 'history';

export const INVENTORY_SCRAP_TAB_LABELS: Record<InventoryScrapTabId, string> = {
  record: 'Log Scrap',
  sessions: 'View Sessions',
  report: 'Scrap Report',
  history: 'Saved Reports',
};

export function useInventoryScrapTabAudit(activeSubTab: InventoryScrapTabId) {
  useModuleTabAudit(INVENTORY_SCRAP_TAB_LABELS[activeSubTab]);
}
