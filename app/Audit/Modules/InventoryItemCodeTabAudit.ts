'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';

export const INVENTORY_ITEM_CODE_VIEW = 'Inventory Item Code';

export function useInventoryItemCodeTabAudit() {
  useEffect(() => {
    TrackModuleSubTab(INVENTORY_ITEM_CODE_VIEW);
  }, []);
}
