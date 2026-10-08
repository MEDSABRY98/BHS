'use client';

import React, { useState } from 'react';
import { Sidebar } from './Utils/Sidebar';
import { DashboardTab } from './PL/Dashboard/DashboardTab';
import { IncomeStatementTab } from './PL/IncomeStatementTab';
import { DataEntryTab } from './PL/DataEntry/DataEntryTab';
import { CashFlowDataEntryTab } from './CashFlow/CashFlowDataEntryTab';
import { CashFlowStatementTab } from './CashFlow/CashFlowStatementTab';
import { FinancialModelProvider } from './Context/FinancialModelContext';

export default function FinancialModelWrapper() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  return (
    <FinancialModelProvider>
      <div className="flex min-h-screen bg-gray-50/50">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isCollapsed={isSidebarCollapsed} 
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <main 
          className="flex-1 min-w-0 flex flex-col relative transition-all duration-300 pt-[24px] lg:pt-[24px]"
        >
          <div className={`${['income_statement', 'cf_statement', 'dashboard'].includes(activeTab) ? 'max-w-[95%] 2xl:max-w-[1800px]' : 'max-w-[90%] 2xl:max-w-[1400px]'} mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex-1 w-full flex flex-col transition-all duration-300`}>
            <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
              <DashboardTab />
            </div>
            <div className={activeTab === 'income_statement' ? 'block' : 'hidden'}>
              <IncomeStatementTab />
            </div>
            <div className={activeTab === 'data_entry' ? 'block' : 'hidden'}>
              <DataEntryTab />
            </div>
            <div className={activeTab === 'cf_statement' ? 'block' : 'hidden'}>
              <CashFlowStatementTab />
            </div>
            <div className={activeTab === 'cf_data_entry' ? 'block' : 'hidden'}>
              <CashFlowDataEntryTab />
            </div>
          </div>
        </main>
      </div>
    </FinancialModelProvider>
  );
}
