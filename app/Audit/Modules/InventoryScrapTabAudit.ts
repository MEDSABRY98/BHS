'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export type InventoryScrapTabId = 'record' | 'sessions' | 'history';

export const INVENTORY_SCRAP_TAB_LABELS: Record<InventoryScrapTabId, string> = {
  record: 'Log Scrap',
  sessions: 'View Sessions',
  history: 'Saved Reports',
};

export function useInventoryScrapTabAudit(activeSubTab: InventoryScrapTabId) {
  useModuleTabAudit(INVENTORY_SCRAP_TAB_LABELS[activeSubTab]);
}
