'use client';

import { useState, Suspense } from 'react';
import { Menu } from 'lucide-react';
import SuppliersSidebar from './Utils/Sidebar';
import SuppliersTab from './SuppliersTab/SuppliersTab';
import AgingTab from './AgingTab/AgingTab';
import ExpectedPaymentsTab from './ExpectedPaymentsTab/ExpectedPaymentsTab';
import { SuppliersDataProvider, useSuppliersData } from './Context/SuppliersDataContext';
import TabLoader from '../Components/Loading/TabLoader';
import MainLoader from '../Components/Loading/MainLoader';

function SuppliersPageShell({
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  toggleSidebar,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
}: {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
}) {
  const { loading } = useSuppliersData();

  const renderBody = () => {
    if (loading) {
      return <TabLoader className="!min-h-full flex-1" />;
    }

    return (
      <div className="max-w-[92%] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full relative">
        {activeTab === 'suppliers' && <SuppliersTab />}
        {activeTab === 'aging' && <AgingTab />}
        {activeTab === 'expected' && <ExpectedPaymentsTab />}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-200 text-slate-800 shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}
      >
        <SuppliersSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 text-slate-800 transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      >
        <SuppliersSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={false}
          onToggleCollapse={() => { }}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}
      >
        <div className="lg:hidden p-4 flex items-center bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2.5 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-900 tracking-wide">Suppliers Analysis</span>
        </div>

        {renderBody()}
      </div>
    </div>
  );
}

function SuppliersPageContent() {
  const [activeTab, setActiveTab] = useState('suppliers');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <SuppliersDataProvider>
      <SuppliersPageShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
      />
    </SuppliersDataProvider>
  );
}

export default function SuppliersPage() {
  return (
    <Suspense
      fallback={
        <MainLoader />
      }
    >
      <SuppliersPageContent />
    </Suspense>
  );
}
