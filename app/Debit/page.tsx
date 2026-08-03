'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Menu } from 'lucide-react';

import CustomersLandingTab from './CustomersTab/CustomersSwitchsTab';
import CreditLimitTab from './CreditLimitTab/CreditLimitTab';
import CustomersGroupTab from './CustomersGroupTab/CustomersGroupTab';
import OpenTransactionsTab from './OpenTransactionsTab/OpenTransactionsTab';
import AllTransactionsTab from './AllTransactionsTab/AllTransactionsTab';
import PaymentReconciliationTab from './PaymentReconciliationTab/PaymentReconciliationTab';
import PaymentTrackerTab from './PaymentTrackerTab/PaymentTrackerTab';
import SalesRepsTab from './SalesRepsTab/SalesRepsTab';
import HistoryTab from './HistoryTab/HistoryTab';
import AgesTab from './AgesTab/AgesTab';
import CustomersTab from './CustomersTab/CustomersTab';
import Loading from '@/app/Components/Loading';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import Login from '@/app/Components/Auth/Login';
import TabPanel from '@/app/Components/Layout/TabPanel';
import DebitSidebar from './Utils/Sidebar';
import { useDebitTabAudit } from '@/app/Audit/Modules/DebitTabAudit';
import { DebitDataProvider, useDebitData } from './Context/DebitDataContext';

const TABS_NEEDING_FULL_DATA = new Set([
  'customers',
  'credit-limit',
  'customers-group',
  'payment-reconciliation',
  'all-transactions',
  'customers-open-matches',
  'payment-tracker',
  'salesreps',
  'history',
  'ages',
]);

function DebitPageShell({
  initialCustomer,
  currentUser,
  activeTab,
  setActiveTab,
  isSidebarCollapsed,
  toggleSidebar,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
}: {
  initialCustomer?: string;
  currentUser: any;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
}) {
  const { data, loading, isRefreshing, error, lastUpdated, refresh, dataVersion, dataReady, dataLoading, ensureFullData } = useDebitData();
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['customers']));
  const mainContentRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const isAutoDownload = initialCustomer && searchParams?.get('action') === 'download_report';

  useDebitTabAudit(activeTab);

  useEffect(() => {
    setVisitedTabs((prev) => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (TABS_NEEDING_FULL_DATA.has(activeTab) && visitedTabs.has(activeTab)) {
      void ensureFullData();
    }
  }, [activeTab, visitedTabs, ensureFullData]);

  useEffect(() => {
    if (isAutoDownload) {
      void ensureFullData();
    }
  }, [isAutoDownload, ensureFullData]);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const tabAllowed = () => {
    try {
      const perms = JSON.parse(currentUser?.role || '{}');
      const allowedTabs = perms.debit || perms.debit_tabs;
      if (allowedTabs && Array.isArray(allowedTabs) && currentUser?.name !== 'MED Sabry') {
        return allowedTabs.includes(activeTab);
      }
    } catch {
      // full access
    }
    return true;
  };

  const renderBody = () => {
    const needsFullData = TABS_NEEDING_FULL_DATA.has(activeTab);

    if (needsFullData && !dataReady) {
      if (error && !dataLoading) {
        return (
          <TabFetchError
            message={error}
            onRetry={() => void refresh()}
            isRetrying={dataLoading}
            className="min-h-[40vh]"
          />
        );
      }
      return <TabLoader />;
    }

    if (!tabAllowed()) {
      return (
        <div className="p-20 text-center text-slate-400 font-bold">
          You don&apos;t have permission to view this section.
        </div>
      );
    }

    return (
      <>
        <TabPanel tabId="customers" activeTab={activeTab} isVisited={visitedTabs.has('customers') && dataReady}>
          <CustomersLandingTab data={data} initialCustomer={initialCustomer} />
        </TabPanel>
        <TabPanel tabId="credit-limit" activeTab={activeTab} isVisited={visitedTabs.has('credit-limit') && dataReady}>
          <CreditLimitTab data={data} />
        </TabPanel>
        <TabPanel tabId="customers-group" activeTab={activeTab} isVisited={visitedTabs.has('customers-group') && dataReady}>
          <CustomersGroupTab data={data} />
        </TabPanel>
        <TabPanel tabId="payment-reconciliation" activeTab={activeTab} isVisited={visitedTabs.has('payment-reconciliation') && dataReady}>
          <PaymentReconciliationTab data={data} />
        </TabPanel>
        <TabPanel tabId="all-transactions" activeTab={activeTab} isVisited={visitedTabs.has('all-transactions') && dataReady}>
          <AllTransactionsTab data={data} />
        </TabPanel>
        <TabPanel tabId="customers-open-matches" activeTab={activeTab} isVisited={visitedTabs.has('customers-open-matches') && dataReady}>
          <OpenTransactionsTab data={data} />
        </TabPanel>
        <TabPanel tabId="payment-tracker" activeTab={activeTab} isVisited={visitedTabs.has('payment-tracker') && dataReady}>
          <PaymentTrackerTab data={data} dataVersion={dataVersion} />
        </TabPanel>
        <TabPanel tabId="salesreps" activeTab={activeTab} isVisited={visitedTabs.has('salesreps') && dataReady}>
          <SalesRepsTab data={data} />
        </TabPanel>
        <TabPanel tabId="history" activeTab={activeTab} isVisited={visitedTabs.has('history') && dataReady}>
          <HistoryTab data={data} />
        </TabPanel>
        <TabPanel tabId="ages" activeTab={activeTab} isVisited={visitedTabs.has('ages') && dataReady}>
          <AgesTab data={data} />
        </TabPanel>
      </>
    );
  };

  if (isAutoDownload) {
    if (!dataReady && (dataLoading || loading)) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <TabLoader />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white">
        <CustomersLandingTab data={data} initialCustomer={initialCustomer} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside
        className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}
      >
        <DebitSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          lastUpdated={lastUpdated}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onRefresh={() => refresh(true)}
          isRefreshing={loading || isRefreshing}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}
      >
        <DebitSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          lastUpdated={lastUpdated}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onRefresh={() => refresh(true)}
          isRefreshing={loading || isRefreshing}
        />
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}
      >
        <div className="lg:hidden p-4 flex items-center bg-white border-b border-slate-200">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-800">Debit Analysis</span>
        </div>

        <div
          ref={mainContentRef}
          className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-4 sm:p-6 lg:p-8">
              {renderBody()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebitPageContent() {
  const searchParams = useSearchParams();
  const initialCustomer = searchParams?.get('customer') || undefined;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('customers');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('debitSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('currentUser');
      } finally {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.name !== 'MED Sabry') {
      try {
        const perms = JSON.parse(currentUser.role || '{}');
        const allowedTabs = perms.debit || perms.debit_tabs;
        if (allowedTabs && Array.isArray(allowedTabs) && !allowedTabs.includes(activeTab)) {
          if (allowedTabs.length > 0) {
            setActiveTab(allowedTabs[0]);
          }
        }
      } catch {
        // ignore
      }
    }
  }, [currentUser, activeTab]);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('debitSidebarCollapsed', String(nextState));
  };

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <DebitDataProvider enabled={isAuthenticated}>
      <DebitPageShell
        initialCustomer={initialCustomer}
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
      />
    </DebitDataProvider>
  );
}

export default function DebitPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <DebitPageContent />
    </Suspense>
  );
}
