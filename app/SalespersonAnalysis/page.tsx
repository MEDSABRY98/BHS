'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLiveCurrentUser } from '../Components/Auth/AppSessionProvider';
import TabLoader from '../Components/Loading/TabLoader';
import MainLoader from '../Components/Loading/MainLoader';
import NoData from '../Components/DataState/NoDataTab';
import TabFetchError from '../Components/DataState/TabFetchError';
import { SalespersonDataProvider, UseSalespersonData } from './Context/SalespersonDataContext';
import SalespersonSidebar, { SALESPERSON_TABS, type SalespersonTabId } from './Utils/Sidebar';
import SalespersonPicker from './Utils/SalespersonPicker';
import SalesTab from './Sales/SalesTab';
import DebitTab from './Debit/DebitTab';
import CollectionsTab from './Collections/CollectionsTab';

const ALL_TABS = SALESPERSON_TABS.map((t) => t.id) as SalespersonTabId[];

/** Tabs allowed by Admin Control ('salesperson-analysis' sub tabs); no list = all tabs. */
function AllowedTabs(user: any): SalespersonTabId[] {
  try {
    const name = String(user?.name || '').trim().toLowerCase();
    if (name === 'med sabry' || String(user?.userAdmin || '').toLowerCase() === 'admin') return ALL_TABS;
    const roleStr = String(user?.role || '').trim();
    if (!roleStr || roleStr === 'Admin') return ALL_TABS;
    const perms = JSON.parse(roleStr);
    const list = perms?.['salesperson-analysis'];
    if (Array.isArray(list) && list.length > 0) {
      const allowed = ALL_TABS.filter((t) => list.includes(t));
      return allowed.length ? allowed : ALL_TABS;
    }
  } catch {
    // full access by default
  }
  return ALL_TABS;
}

function SalespersonShell() {
  const user = useLiveCurrentUser();
  const allowedTabs = useMemo(() => AllowedTabs(user), [user]);
  const [activeTab, setActiveTab] = useState<SalespersonTabId>(allowedTabs[0]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { data, loading, error, selectedId, listLoading, refresh } = UseSalespersonData();

  useEffect(() => {
    if (!allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0]);
  }, [allowedTabs, activeTab]);

  const renderBody = () => {
    if (error && !data) {
      return <TabFetchError message={error} onRetry={() => void refresh()} />;
    }
    if (!selectedId) {
      return (
        <div className="flex items-center justify-center min-h-[55vh]">
          <NoData title="PICK A SALESPERSON" />
        </div>
      );
    }
    if (!data) return null;
    if (activeTab === 'sales') return <SalesTab />;
    if (activeTab === 'debit') return <DebitTab />;
    return <CollectionsTab />;
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-200 shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}
      >
        <SalespersonSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allowedTabs={allowedTabs}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      >
        <SalespersonSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          allowedTabs={allowedTabs}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <div className="lg:hidden p-4 flex items-center bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2.5 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-900 tracking-wide">Salesperson Analysis</span>
        </div>

        {(listLoading || loading) && !(error && !data) ? (
          <TabLoader className="!min-h-full flex-1" />
        ) : (
          <div className="max-w-[92%] 2xl:max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 space-y-6">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {SALESPERSON_TABS.find((t) => t.id === activeTab)?.label}
              </h2>
            </div>
            <SalespersonPicker />
            {renderBody()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SalespersonAnalysisPage() {
  return (
    <Suspense fallback={<MainLoader />}>
      <SalespersonDataProvider>
        <SalespersonShell />
      </SalespersonDataProvider>
    </Suspense>
  );
}
