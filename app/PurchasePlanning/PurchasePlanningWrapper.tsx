'use client';

import React, { useState } from 'react';
import { PurchaseDataProvider } from './Context/PurchaseDataContext';
import { Sidebar } from './Utils/Sidebar';
import { PlanningTab } from './Tabs/PlanningTab';

function TabContent({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'planning':
      return <PlanningTab />;
    default:
      return null;
  }
}

export default function PurchasePlanningWrapper() {
  const [activeTab, setActiveTab] = useState('planning');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <PurchaseDataProvider>
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isCollapsed={isSidebarCollapsed} 
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main 
          className={`flex-1 w-full max-w-[100vw] flex flex-col relative transition-all duration-300 pt-[24px] lg:pt-[24px]
            ${isSidebarCollapsed ? 'lg:max-w-[calc(100vw-80px)]' : 'lg:max-w-[calc(100vw-80px)] xl:max-w-[calc(100vw-280px)]'}
          `}
        >
          <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex-1 w-full flex flex-col">
            <TabContent activeTab={activeTab} />
          </div>
        </main>
      </div>
    </PurchaseDataProvider>
  );
}
