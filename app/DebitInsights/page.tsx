'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { DebitDataProvider, useDebitData } from '@/app/Debit/Context/DebitDataContext';
import { toast } from '@/app/Components/Notification';
import DebitInsightsDashboard, {
  type DebitInsightsChromeState,
} from './DebitInsightsDashboard';
import DebitInsightsSidebar from './Utils/Sidebar';
import { useDebitInsightsTabAudit } from '@/app/Audit/Modules/DebitInsightsTabAudit';

function isInsightsAllowed(currentUser: any): boolean {
  const userName = currentUser?.name?.toLowerCase() || '';
  if (userName === 'med sabry') return true;

  try {
    const perms = JSON.parse(currentUser?.role || '{}');
    if (Array.isArray(perms.systems)) {
      if (perms.systems.includes('debit_insights')) return true;
      return perms.systems.includes('debit');
    }
  } catch {
    // default allow
  }
  return true;
}

function DebitInsightsContent({ currentUser }: { currentUser: any }) {
  const { data, loading, isRefreshing, error, lastUpdated, refresh, ensureFullData } = useDebitData();
  useDebitInsightsTabAudit();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [chrome, setChrome] = useState<DebitInsightsChromeState>({
    filtersActive: false,
    filtersPending: false,
    exportingPdf: false,
    canExportPdf: false,
    onExportPdf: () => {},
  });

  useEffect(() => {
    const stored = localStorage.getItem('debitInsightsSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    void ensureFullData();
  }, [ensureFullData]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('debitInsightsSidebarCollapsed', String(next));
      return next;
    });
  };

  const handleRefresh = async () => {
    const loadingId = toast.loading('Refreshing debit data...');
    await refresh(true);
    toast.dismiss(loadingId);
    toast.success('Debit data refreshed.');
  };

  const handleChromeChange = useCallback((state: DebitInsightsChromeState) => {
    setChrome(state);
  }, []);

  if (!isInsightsAllowed(currentUser)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-gray-600 font-medium">You do not have access to Debit Insights.</p>
      </div>
    );
  }

  const sidebarProps = {
    isCollapsed: isSidebarCollapsed,
    onToggleCollapse: toggleSidebar,
    onRefresh: () => void handleRefresh(),
    isRefreshing: loading || isRefreshing,
    onOpenFilters: () => setFiltersOpen(true),
    filtersActive: chrome.filtersActive,
    filtersPending: chrome.filtersPending,
    onExportPdf: chrome.onExportPdf,
    isExportingPdf: chrome.exportingPdf,
    canExportPdf: chrome.canExportPdf,
    lastUpdated: lastUpdated || null,
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside
        className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}
      >
        <DebitInsightsSidebar {...sidebarProps} />
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
        <DebitInsightsSidebar
          {...sidebarProps}
          isCollapsed={false}
          onToggleCollapse={() => {}}
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
            className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="ml-3 font-bold text-slate-800">Debit Insights</span>
        </div>

        <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-4 sm:p-6 lg:p-8">
              {error ? (
                <TabFetchError
                  message={error}
                  onRetry={async () => {
                    toast.info('Retrying data load...');
                    await refresh();
                  }}
                />
              ) : (
                <DebitInsightsDashboard
                  data={data}
                  loading={loading}
                  filtersOpen={filtersOpen}
                  onFiltersOpenChange={setFiltersOpen}
                  onChromeChange={handleChromeChange}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DebitInsightsPageInner() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
        setIsAuthenticated(true);
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
    setIsChecking(false);
  }, []);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  if (isChecking) return <Loading />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  return (
    <DebitDataProvider enabled={isAuthenticated}>
      <DebitInsightsContent currentUser={currentUser} />
    </DebitDataProvider>
  );
}

export default function DebitInsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <DebitInsightsPageInner />
    </Suspense>
  );
}
