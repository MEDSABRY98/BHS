'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import type { InventoryCountingTabId } from '@/app/InventoryCounting/Utils/Sidebar';

export const INVENTORY_COUNTING_TAB_LABELS: Record<InventoryCountingTabId, string> = {
  total_count: 'Total Count',
  user_comparison: 'User Comparison',
  record: 'Record',
  archive: 'Archive',
  lots_stock: 'Lots Stock',
  reports: 'Reports',
};

export function useInventoryCountingTabAudit(activeTab: InventoryCountingTabId) {
  useModuleTabAudit(INVENTORY_COUNTING_TAB_LABELS[activeTab] ?? activeTab);
}
