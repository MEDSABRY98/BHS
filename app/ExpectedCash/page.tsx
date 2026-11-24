'use client';

// Expected Cash — what is expected to come in and go out, by month:
//   • Expected Collections (customers)   • Expected Payments (suppliers)
// Which tabs a user sees: Admin Control → Expected Cash (the tab ids are in Utils/ExpectedCashTabs.ts).

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import { isAdminRole } from '@/lib/AdminRole';
import { ExpectedCashProvider, useExpectedCash, type ExpectedCashTab } from './Context/ExpectedCashContext';
import ExpectedCashSidebar from './Utils/Sidebar';
import FiltersModal from './Utils/FiltersModal';
import { EXPECTED_CASH_SYSTEM_ID, EXPECTED_CASH_TABS } from './Utils/ExpectedCashTabs';
import ExpectedCollectionsTab from './ExpectedCollectionsTab/ExpectedCollectionsTab';
import ExpectedPaymentsTab from './ExpectedPaymentsTab/ExpectedPaymentsTab';

/** The tabs this user may open (role JSON: perms['expected-cash'] = the allowed tab ids). */
function allowedTabs(user: any): ExpectedCashTab[] {
  const all = EXPECTED_CASH_TABS.map((t) => t.id);
  if (isAdminRole(user)) return all;
  const raw = String(user?.role || '').trim();
  if (!raw) return all;
  try {
    const perms = JSON.parse(raw);
    if (Array.isArray(perms.systems) && !perms.systems.includes(EXPECTED_CASH_SYSTEM_ID)) return [];
    const list = perms[EXPECTED_CASH_SYSTEM_ID];
    return Array.isArray(list) ? all.filter((id) => list.includes(id)) : all;
  } catch {
    return all;
  }
}

function Shell({ visibleTabs }: { visibleTabs: ExpectedCashTab[] }) {
  const { collections, payments, ensure, refresh, selectedTags, selectedClasses, selectedCities } = useExpectedCash();
  const [activeTab, setActiveTab] = useState<ExpectedCashTab>(visibleTabs[0]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const tabTitle = EXPECTED_CASH_TABS.find((t) => t.id === activeTab)?.label || 'Expected Cash';
  useModuleTabAudit(`Expected Cash · ${tabTitle}`);

  useEffect(() => {
    try {
      if (localStorage.getItem('expectedCashSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);
  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('expectedCashSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  // each tab loads its own data the first time it opens
  useEffect(() => {
    ensure(activeTab);
  }, [activeTab, ensure]);

  const state = activeTab === 'collections' ? collections : payments;
  const hasRows = activeTab === 'collections' ? collections.data.length > 0 : payments.suppliers.length > 0 || payments.transactions.length > 0;
  const filtersActive = activeTab === 'collections' && (selectedTags.length > 0 || selectedClasses.length > 0 || selectedCities.length > 0);

  const body = () => {
    if (state.status === 'idle' || state.status === 'loading') return <TabLoader className="!min-h-full flex-1" />;
    if (state.status === 'error') {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[70vh]">
          <TabFetchError message={state.error || 'Could not load the data'} onRetry={() => void refresh(activeTab)} isRetrying={state.refreshing} />
        </div>
      );
    }
    if (!hasRows) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[70vh]">
          <NoData title="NO DATA FOUND" message="No data available. Please ensure data is uploaded in the main modules." />
        </div>
      );
    }
    return (
      <>
        {activeTab === 'collections' && <ExpectedCollectionsTab />}
        {activeTab === 'payments' && <ExpectedPaymentsTab />}
      </>
    );
  };

  const sidebarProps = {
    activeTab,
    onTabChange: setActiveTab,
    visibleTabs,
    onRefresh: () => void refresh(activeTab),
    refreshing: state.refreshing,
    onOpenFilters: activeTab === 'collections' ? () => setFiltersOpen(true) : undefined,
    filtersActive,
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-200 text-slate-800 shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <ExpectedCashSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 text-slate-800 transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <ExpectedCashSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <div className="lg:hidden p-4 flex items-center bg-white border-b border-slate-200">
          <button type="button" onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-900 tracking-wide">Expected Cash</span>
        </div>

        <div className="max-w-[92%] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full relative flex flex-col">{body()}</div>
      </div>

      {filtersOpen && <FiltersModal onClose={() => setFiltersOpen(false)} />}
    </div>
  );
}

function ExpectedCashContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Error validating user:', error);
      } finally {
        setIsChecking(false);
      }
    })();
  }, []);

  const visibleTabs = useMemo(() => allowedTabs(currentUser), [currentUser]);

  if (isChecking) return <MainLoader message="Loading Expected Cash..." />;
  if (!isAuthenticated) {
    return (
      <Login
        onLogin={(user: any) => {
          setCurrentUser(user);
          setIsAuthenticated(true);
          localStorage.setItem('currentUser', JSON.stringify(user));
        }}
      />
    );
  }
  if (visibleTabs.length === 0) {
    return <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Expected Cash.</div>;
  }

  return (
    <ExpectedCashProvider>
      {/* key: if the allowed tabs change while open, start again on the first allowed tab */}
      <Shell key={visibleTabs.join(',')} visibleTabs={visibleTabs} />
    </ExpectedCashProvider>
  );
}

export default function ExpectedCashPage() {
  return (
    <Suspense fallback={<MainLoader />}>
      <ExpectedCashContent />
    </Suspense>
  );
}
