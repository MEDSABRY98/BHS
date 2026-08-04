'use client';

import { useModuleTabAudit } from '@/app/Audit/Utils/useModuleTabAudit';

export const INVENTORY_ITEM_CODE_VIEW = 'Inventory Item Code';

export function useInventoryItemCodeTabAudit(isReady: boolean = true) {
  useModuleTabAudit(isReady ? INVENTORY_ITEM_CODE_VIEW : null);
}
