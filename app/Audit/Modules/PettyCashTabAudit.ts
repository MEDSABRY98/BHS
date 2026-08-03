'use client';

import { useEffect } from 'react';
import { TrackModuleSubTab } from '@/app/Audit/Utils/ActivityQueue';
import { tabs } from '@/app/PettyCash/Utils/Sidebar';

export function usePettyCashTabAudit(
  activeTab: 'receipts' | 'expenses' | 'stats' | 'voucher' | 'history',
  voucherSubTab: 'add' | 'reprint',
) {
  useEffect(() => {
    const tabName = tabs.find((tab) => tab.id === activeTab)?.name ?? activeTab;
    if (activeTab === 'voucher') {
      const voucherLabel = voucherSubTab === 'add' ? 'Add Voucher' : 'Reprint';
      TrackModuleSubTab(`${tabName} · ${voucherLabel}`);
      return;
    }
    TrackModuleSubTab(tabName);
  }, [activeTab, voucherSubTab]);
}
