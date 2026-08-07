'use client';

import React from 'react';
import TabPanel from '@/app/Components/Layout/TabPanel';
import TotalCountTab from './TotalCount/TotalCountTab';
import UserComparisonTab from './UserComparison/UserComparisonTab';
import RecordTab from './Record/RecordTab';
import CountReconciliationTab from './CountReconciliation/CountReconciliationTab';
import ArchivesTab from './Archives/ArchivesTab';
import CountingToolbar from './Utils/CountingToolbar';
import { type InventoryCountingTabId } from './Utils/Sidebar';

interface InventoryCountingTabProps {
  activeTab: InventoryCountingTabId;
  visitedTabs: Set<InventoryCountingTabId>;
  onTabChange: (tab: InventoryCountingTabId) => void;
}

export default function InventoryCountingTab({
  activeTab,
  visitedTabs,
  onTabChange,
}: InventoryCountingTabProps) {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CountingToolbar showReconciliationToolbar={activeTab === 'reconciliation'} />

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
        <TabPanel tabId="record" activeTab={activeTab} isVisited={visitedTabs.has('record')}>
          <RecordTab />
        </TabPanel>
        <TabPanel tabId="archives" activeTab={activeTab} isVisited={visitedTabs.has('archives')}>
          <ArchivesTab onViewArchive={onTabChange} />
        </TabPanel>
      </div>
    </div>
  );
}
