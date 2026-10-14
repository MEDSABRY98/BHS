'use client';

import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { usePettyCashTabAudit } from '@/app/Audit/Model/PettyCashTabAudit';
import PettyCashSidebar from './Utils/Sidebar';
import PettyCashForm from './Components/PettyCashForm';
import PettyCashCards from './Components/PettyCashCards';
import { getPettyCashPermissions, listPettyCash } from './Service/PettyCashService';
import type { PettyCash, PettyCashPermissions, PettyCashTabId } from './Utils/PettyCashTypes';

const NO_ACCESS: PettyCashPermissions = { tabs: [], viewAll: false };

export default function PettyCashPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [permissions, setPermissions] = useState<PettyCashPermissions | null>(null);
  const [activeTab, setActiveTab] = useState<PettyCashTabId>('new');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [items, setItems] = useState<PettyCash[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editItem, setEditItem] = useState<PettyCash | null>(null); // admin edit
  const [formKey, setFormKey] = useState(0);

  usePettyCashTabAudit(activeTab);

  useEffect(() => {
    try {
      if (localStorage.getItem('pettyCashSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('pettyCashSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadPermissions = useCallback(async () => {
    try {
      setPermissions(await getPettyCashPermissions());
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

  const visibleTabs = permissions?.tabs ?? [];
  const canSeeRecords = visibleTabs.includes('records');

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await listPettyCash());
      setLoadError(null);
      setLoaded(true);
    } catch (err: any) {
      const message = err?.message || 'Could not load the data';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (canSeeRecords) void loadData();
  }, [canSeeRecords, loadData]);

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

  if (isChecking) return <MainLoader message="Loading Petty Cash..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: (tab: PettyCashTabId) => {
      if (editItem) setEditItem(null);
      if (tab === 'new' && activeTab === 'new') setFormKey((k) => k + 1); // fresh form
      setActiveTab(tab);
    },
    visibleTabs,
    onRefresh: canSeeRecords ? () => void loadData(true) : undefined,
    refreshing,
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <PettyCashSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <PettyCashSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Petty Cash</span>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {!permissions ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : visibleTabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Petty Cash.</div>
          ) : (
            <>
              {activeTab === 'new' && visibleTabs.includes('new') && (
                <PettyCashForm
                  key={editItem ? `edit-${editItem.ID}` : `new-${formKey}`}
                  editItem={editItem}
                  onCancelEdit={() => {
                    setEditItem(null);
                    setActiveTab('records');
                  }}
                  onSaved={(p, isEdit) => {
                    setItems((prev) => (isEdit ? prev.map((x) => (x.ID === p.ID ? p : x)) : [p, ...prev.filter((x) => x.ID !== p.ID)]));
                    setEditItem(null);
                    if (canSeeRecords) setActiveTab('records');
                  }}
                />
              )}
              {activeTab === 'records' && canSeeRecords && (
                loading && !loaded ? (
                  <TabLoader className="!min-h-[70vh] flex-1" />
                ) : loadError && !loaded ? (
                  <div className="p-20 text-center">
                    <p className="font-bold text-red-500 mb-4">{loadError}</p>
                    <button onClick={() => void loadData()} className="px-5 py-2.5 rounded-xl bg-[#0a0f1d] text-white text-sm font-bold">
                      Try Again
                    </button>
                  </div>
                ) : (
                  <PettyCashCards
                    items={items}
                    viewAll={permissions.viewAll}
                    canDelete={permissions.viewAll} // delete: admin only
                    canEdit={permissions.viewAll && visibleTabs.includes('new')} // edit rows & accounts: admin only
                    onEdit={(p) => {
                      setEditItem(p);
                      setActiveTab('new');
                    }}
                    currentUserName={currentUser?.name || ''}
                    onDeleted={(id) => setItems((prev) => prev.filter((p) => p.ID !== id))}
                  />
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
