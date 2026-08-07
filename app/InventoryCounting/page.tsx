'use client';

import { useState, useEffect, useMemo } from 'react';
import { Menu, Lock, ArrowLeft, X } from 'lucide-react';
import InventoryCountingTab from './InventoryCountingTab';
import Sidebar, {
  getAllowedCountingTabs,
  getCountingTabLabel,
  type InventoryCountingTabId,
} from './Utils/Sidebar';
import { useInventoryCountingTabAudit } from '@/app/Audit/Modules/InventoryCountingTabAudit';
import { InventoryCountingArchiveProvider, useInventoryCountingArchive } from './InventoryCountingArchiveContext';
import { InventoryCountingFiltersProvider } from './InventoryCountingFiltersContext';
import FiltersModal from './Utils/FiltersModal';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';

function hasInventoryCountingAccess(user: any): boolean {
  const userName = user?.name?.toLowerCase() || '';
  if (userName === 'med sabry') return true;

  try {
    const perms = JSON.parse(user?.role || '{}');

    if (perms.systems && Array.isArray(perms.systems)) {
      if (perms.systems.includes('inventory-counting')) return true;
    }

    const countingTabs = perms['inventory-counting'];
    if (Array.isArray(countingTabs) && countingTabs.length > 0) return true;

    const inventoryTabs = perms.inventory;
    if (Array.isArray(inventoryTabs)) {
      const legacyCountingIds = [
        'counting',
        'total_count',
        'reconciliation',
        'inventory_count',
        'user_comparison',
        'record',
        'archives',
        'normal_record',
        'damage_record',
        'count',
        'normal_total',
        'damage_total',
      ];
      if (inventoryTabs.some((tabId: string) => legacyCountingIds.includes(tabId))) {
        return true;
      }
    }

    if (!perms.systems) return true;
  } catch {
    return true;
  }

  return false;
}

export default function InventoryCountingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<InventoryCountingTabId>('total_count');
  const [visitedTabs, setVisitedTabs] = useState<Set<InventoryCountingTabId>>(new Set(['total_count']));

  const allowedTabs = useMemo(() => getAllowedCountingTabs(), [isAuthenticated, isAllowed]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setIsAuthenticated(true);
        setIsAllowed(hasInventoryCountingAccess(parsed));
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
    const stored = localStorage.getItem('inventoryCountingSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  useEffect(() => {
    const tabs = getAllowedCountingTabs();
    if (tabs.length === 0) return;

    const allowedIds = tabs.map((t) => t.id);
    if (!allowedIds.includes(activeTab)) {
      const firstTab = allowedIds[0];
      setActiveTab(firstTab);
      setVisitedTabs(new Set([firstTab]));
    }
  }, [activeTab, isAuthenticated, isAllowed]);

  useEffect(() => {
    setVisitedTabs((prev) => new Set([...prev, activeTab]));
  }, [activeTab]);

  useInventoryCountingTabAudit(activeTab);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('inventoryCountingSidebarCollapsed', String(nextState));
  };

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    localStorage.setItem('currentUser', JSON.stringify(user));
    setIsAllowed(hasInventoryCountingAccess(user));
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-slate-200/60 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mb-6 text-red-500 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-slate-500 mt-2 font-medium">You do not have permission to access Inventory Counting.</p>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="mt-8 w-full flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <InventoryCountingArchiveProvider>
      <InventoryCountingFiltersProvider>
        <InventoryCountingPageContent
          isSidebarCollapsed={isSidebarCollapsed}
          isMobileSidebarOpen={isMobileSidebarOpen}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          toggleSidebar={toggleSidebar}
          allowedTabs={allowedTabs}
          visitedTabs={visitedTabs}
        />
      </InventoryCountingFiltersProvider>
    </InventoryCountingArchiveProvider>
  );
}

function InventoryCountingPageContent({
  isSidebarCollapsed,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  activeTab,
  setActiveTab,
  toggleSidebar,
  allowedTabs,
  visitedTabs,
}: {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (open: boolean) => void;
  activeTab: InventoryCountingTabId;
  setActiveTab: (tab: InventoryCountingTabId) => void;
  toggleSidebar: () => void;
  allowedTabs: ReturnType<typeof getAllowedCountingTabs>;
  visitedTabs: Set<InventoryCountingTabId>;
}) {
  const { isArchiveView, archiveMeta, setArchiveId } = useInventoryCountingArchive();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const pageTitle = getCountingTabLabel(activeTab);

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0f172a] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </aside>

      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onOpenFilters={() => setFiltersOpen(true)}
        />
      </aside>

      <FiltersModal open={filtersOpen} onClose={() => setFiltersOpen(false)} />

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <div className="lg:hidden bg-white border-b border-slate-200">
          <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2.5 -ml-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all shrink-0"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-bold text-slate-800 shrink-0">{pageTitle}</span>
                {isArchiveView && archiveMeta && (
                  <>
                    <span className="text-slate-300 shrink-0">·</span>
                    <span className="text-xs font-bold text-amber-800 truncate">
                      Viewing archive {archiveMeta.archiveId} (read-only)
                      {archiveMeta.label ? ` — ${archiveMeta.label}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setArchiveId(null)}
                      title="Back to current session"
                      className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-[95%] 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          <div className="hidden lg:flex items-center gap-4 pb-4 min-w-0">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight shrink-0">
              {pageTitle}
            </h1>
            {isArchiveView && archiveMeta && (
              <>
                <span className="text-slate-300 shrink-0">·</span>
                <p className="text-sm font-bold text-amber-800 truncate min-w-0">
                  Viewing archive {archiveMeta.archiveId} (read-only)
                  {archiveMeta.label ? ` — ${archiveMeta.label}` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => setArchiveId(null)}
                  title="Back to current session"
                  className="p-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {allowedTabs.length > 0 ? (
            <InventoryCountingTab
              activeTab={activeTab}
              visitedTabs={visitedTabs}
              onTabChange={setActiveTab}
            />
          ) : (
            <div className="bg-white rounded-3xl p-8 text-center border border-slate-100 shadow-sm">
              <p className="text-slate-500 font-bold">No counting tabs are enabled for your account.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
