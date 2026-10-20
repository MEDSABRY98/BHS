'use client';

import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';

export const INVENTORY_ITEM_CODE_VIEW = 'Inventory Item Code';

export function useInventoryItemCodeTabAudit(isReady: boolean = true) {
  useModuleTabAudit(isReady ? INVENTORY_ITEM_CODE_VIEW : null);
}
