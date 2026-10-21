'use client';

import React, { useEffect, useState } from 'react';
import { getFinancialModelTabs } from './Service/FinancialService';
import { Sidebar } from './Utils/Sidebar';
import { DashboardTab } from './PL/Dashboard/DashboardTab';
import { IncomeStatementTab } from './PL/IncomeStatementTab';
import { BreakEvenPointTab } from './BreakEvenPoint/BreakEvenPointTab';
import { DataEntryTab } from './PL/DataEntry/DataEntryTab';
import { CashFlowDataEntryTab } from './CashFlow/CashFlowDataEntryTab';
import { CashFlowStatementTab } from './CashFlow/CashFlowStatementTab';
import { FinancialModelProvider } from './Context/FinancialModelContext';

export default function FinancialModelWrapper() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  // tabs allowed in Admin Control (null = still loading)
  const [allowedTabs, setAllowedTabs] = useState<string[] | null>(null);

  useEffect(() => {
    getFinancialModelTabs()
      .then((tabs) => {
        setAllowedTabs(tabs);
        setActiveTab((cur) => (tabs.includes(cur) ? cur : tabs[0] || ''));
      })
      .catch(() => setAllowedTabs([]));
  }, []);

  const can = (id: string) => !!allowedTabs?.includes(id);

  return (
    <FinancialModelProvider>
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isCollapsed={isSidebarCollapsed} 
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          allowedTabs={allowedTabs ?? []}
        />
        <main 
          className="flex-1 min-w-0 flex flex-col relative transition-all duration-300 pt-[24px] lg:pt-[24px]"
        >
          <div className={`${['income_statement', 'break_even', 'cf_statement', 'dashboard'].includes(activeTab) ? 'max-w-[95%] 2xl:max-w-[1800px]' : 'max-w-[90%] 2xl:max-w-[1400px]'} mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex-1 w-full flex flex-col transition-all duration-300`}>
            {allowedTabs !== null && !allowedTabs.length && (
              <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use the Financial Model.</div>
            )}
            {can('dashboard') && (
              <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                <DashboardTab />
              </div>
            )}
            {can('income_statement') && (
              <div className={activeTab === 'income_statement' ? 'block' : 'hidden'}>
                <IncomeStatementTab />
              </div>
            )}
            {can('break_even') && (
              <div className={activeTab === 'break_even' ? 'block' : 'hidden'}>
                <BreakEvenPointTab />
              </div>
            )}
            {can('data_entry') && (
              <div className={activeTab === 'data_entry' ? 'block' : 'hidden'}>
                <DataEntryTab />
              </div>
            )}
            {can('cf_statement') && (
              <div className={activeTab === 'cf_statement' ? 'block' : 'hidden'}>
                <CashFlowStatementTab />
              </div>
            )}
            {can('cf_data_entry') && (
              <div className={activeTab === 'cf_data_entry' ? 'block' : 'hidden'}>
                <CashFlowDataEntryTab />
              </div>
            )}
          </div>
        </main>
      </div>
    </FinancialModelProvider>
  );
}
