'use client';

import React from 'react';
import TabPanel from '@/app/Components/Layout/TabPanel';
import ReportsTab from './Reports/ReportsTab';
import LotsStockTab from './LotsStock/LotsStockTab';
import TotalCountTab from './TotalCount/TotalCountTab';
import UserComparisonTab from './UserComparison/UserComparisonTab';
import RecordTab from './Record/RecordTab';
import ArchiveTab from './Archive/ArchiveTab';
import { ICSessionProvider } from './Sessions/ICSessionContext';
import { type InventoryCountingTabId } from './Utils/Sidebar';

interface InventoryCountingTabProps {
  activeTab: InventoryCountingTabId;
  visitedTabs: Set<InventoryCountingTabId>;
  onTabChange?: (tab: InventoryCountingTabId) => void;
}

export default function InventoryCountingTab({ activeTab, visitedTabs }: InventoryCountingTabProps) {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="min-h-[400px]">
        <ICSessionProvider>
          <TabPanel tabId="total_count" activeTab={activeTab} isVisited={visitedTabs.has('total_count')}>
            <TotalCountTab />
          </TabPanel>
          <TabPanel tabId="user_comparison" activeTab={activeTab} isVisited={visitedTabs.has('user_comparison')}>
            <UserComparisonTab />
          </TabPanel>
          <TabPanel tabId="record" activeTab={activeTab} isVisited={visitedTabs.has('record')}>
            <RecordTab />
          </TabPanel>
          <TabPanel tabId="archive" activeTab={activeTab} isVisited={visitedTabs.has('archive')}>
            <ArchiveTab />
          </TabPanel>
        </ICSessionProvider>
        <TabPanel tabId="lots_stock" activeTab={activeTab} isVisited={visitedTabs.has('lots_stock')}>
          <LotsStockTab active={activeTab === 'lots_stock'} />
        </TabPanel>
        <TabPanel tabId="reports" activeTab={activeTab} isVisited={visitedTabs.has('reports')}>
          <ReportsTab active={activeTab === 'reports'} />
        </TabPanel>
      </div>
    </div>
  );
}
