'use client';

import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import IntercompanySidebar from './Utils/Sidebar';
import EntriesTab from './Components/EntriesTab';
import SummaryTab from './Components/SummaryTab';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { getIntercompanyPermissions, listIntercompanyEntries } from './Service/IntercompanyService';
import { compareEntries, type IntercompanyEntry, type IntercompanyPermissions, type IntercompanyTabId } from './Utils/IntercompanyTypes';

const NO_ACCESS: IntercompanyPermissions = { tabs: [], edit: false, delete: false };

export default function IntercompanyReconciliationPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [permissions, setPermissions] = useState<IntercompanyPermissions | null>(null);
  const [activeTab, setActiveTab] = useState<IntercompanyTabId>('entries');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [entries, setEntries] = useState<IntercompanyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem('intercompanySidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('intercompanySidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadPermissions = useCallback(async () => {
    try {
      setPermissions(await getIntercompanyPermissions());
    } catch {
      setPermissions(NO_ACCESS);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadPermissions();
        }
      } catch (error) {
        console.error('Error validating user:', error);
      } finally {
        setIsChecking(false);
      }
    })();
  }, [loadPermissions]);

  const loadEntries = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      setEntries(await listIntercompanyEntries());
      setLoadError(null);
    } catch (err: any) {
      const message = err?.message || 'Could not load the entries';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const canView = !!permissions && permissions.tabs.length > 0;
  useEffect(() => {
    if (canView) void loadEntries();
  }, [canView, loadEntries]);

  const visibleTabs = permissions?.tabs ?? [];
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs.join(','), activeTab]);

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await loadPermissions();
  };

  // Replace / remove one line without reloading everything
  const patchEntry = useCallback((entry: IntercompanyEntry) => {
    setEntries((prev) => prev.map((e) => (e.ID === entry.ID ? { ...e, ...entry, ATTACHMENTS_COUNT: e.ATTACHMENTS_COUNT } : e)).sort(compareEntries));
  }, []);
  const addEntry = useCallback((entry: IntercompanyEntry) => {
    setEntries((prev) => [...prev, { ...entry, ATTACHMENTS_COUNT: 0 }].sort(compareEntries));
  }, []);
  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.ID !== id));
  }, []);
  const removeEntries = useCallback((ids: string[]) => {
    const gone = new Set(ids);
    setEntries((prev) => prev.filter((e) => !gone.has(e.ID)));
  }, []);
  const setAttachmentsCount = useCallback((id: string, count: number) => {
    setEntries((prev) => prev.map((e) => (e.ID === id ? { ...e, ATTACHMENTS_COUNT: count } : e)));
  }, []);

  if (isChecking) return <MainLoader message="Loading Intercompany Data..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: setActiveTab,
    visibleTabs,
    onRefresh: () => void loadEntries(true),
    refreshing,
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <IntercompanySidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {/* Mobile Sidebar */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <IntercompanySidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Intercompany</span>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {!permissions || (canView && loading) ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : !canView ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Intercompany Reconciliation.</div>
          ) : loadError && entries.length === 0 ? (
            <TabFetchError message={loadError} onRetry={() => void loadEntries()} className="min-h-[60vh]" />
          ) : (
            <>
              {activeTab === 'entries' && visibleTabs.includes('entries') && (
                <EntriesTab
                  entries={entries}
                  permissions={permissions}
                  onReload={() => loadEntries(true)}
                  onEntryChanged={patchEntry}
                  onEntryAdded={addEntry}
                  onEntryDeleted={removeEntry}
                  onEntriesDeleted={removeEntries}
                  onAttachmentsCountChanged={setAttachmentsCount}
                />
              )}
              {activeTab === 'summary' && visibleTabs.includes('summary') && <SummaryTab entries={entries} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
