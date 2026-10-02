'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export type InventoryScrapTabId = 'record' | 'history';

export const INVENTORY_SCRAP_TAB_LABELS: Record<InventoryScrapTabId, string> = {
  record: 'Log Scrap',
  history: 'Scrap History',
};

export function useInventoryScrapTabAudit(activeSubTab: InventoryScrapTabId) {
  useModuleTabAudit(INVENTORY_SCRAP_TAB_LABELS[activeSubTab]);
}
