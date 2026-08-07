'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';
import type { InventoryCountingTabId } from '@/app/InventoryCounting/Utils/Sidebar';

export const INVENTORY_COUNTING_TAB_LABELS: Record<InventoryCountingTabId, string> = {
  total_count: 'Total Count',
  reconciliation: 'Count Reconciliation',
  user_comparison: 'User Comparison',
  record: 'Record',
  archives: 'Archives',
};

export function useInventoryCountingTabAudit(activeTab: InventoryCountingTabId) {
  useModuleTabAudit(INVENTORY_COUNTING_TAB_LABELS[activeTab] ?? activeTab);
}
