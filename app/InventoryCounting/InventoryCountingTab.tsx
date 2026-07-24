'use client';

import React from 'react';
import TabPanel from '@/app/Components/TabPanel';
import TotalCountTab from './TotalCountTab';
import UserComparisonTab from './UserComparisonTab';
import NormalCountTab from './NormalCountTab';
import DamageExpireCountTab from './DamageExpireCountTab';
import RecordTab from './RecordTab';
import CountReconciliationTab from './CountReconciliationTab';
import { InventoryCountingFiltersProvider } from './InventoryCountingFiltersContext';
import UserWarehouseDropdowns from './Utils/UserWarehouseDropdowns';
import { usesWarehouseFilters, type InventoryCountingTabId } from './Utils/Sidebar';

interface InventoryCountingTabProps {
  activeTab: InventoryCountingTabId;
  visitedTabs: Set<InventoryCountingTabId>;
}

export default function InventoryCountingTab({ activeTab, visitedTabs }: InventoryCountingTabProps) {
  return (
    <InventoryCountingFiltersProvider>
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {usesWarehouseFilters(activeTab) && (
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-xl shadow-slate-200/50">
            <UserWarehouseDropdowns />
          </div>
        )}

        <div className="min-h-[400px]">
          <TabPanel tabId="total_count" activeTab={activeTab} isVisited={visitedTabs.has('total_count')}>
            <TotalCountTab />
          </TabPanel>
          <TabPanel tabId="reconciliation" activeTab={activeTab} isVisited={visitedTabs.has('reconciliation')}>
            <CountReconciliationTab />
          </TabPanel>
          <TabPanel tabId="user_comparison" activeTab={activeTab} isVisited={visitedTabs.has('user_comparison')}>
            <UserComparisonTab />
          </TabPanel>
          <TabPanel tabId="normal_total" activeTab={activeTab} isVisited={visitedTabs.has('normal_total')}>
            <NormalCountTab />
          </TabPanel>
          <TabPanel tabId="damage_total" activeTab={activeTab} isVisited={visitedTabs.has('damage_total')}>
            <DamageExpireCountTab />
          </TabPanel>
          <TabPanel tabId="record" activeTab={activeTab} isVisited={visitedTabs.has('record')}>
            <RecordTab />
          </TabPanel>
        </div>
      </div>
    </InventoryCountingFiltersProvider>
  );
}
