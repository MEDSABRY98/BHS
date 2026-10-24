'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useAnalyticAllocationTabAudit } from '@/app/AdminControl/Code/Audit/Model/AnalyticAllocationTabAudit';
import AnalyticSidebar from './Utils/Sidebar';
import AccountsTab from './Components/AccountsTab';
import PeopleTab from './Components/PeopleTab';
import AllocateTab from './Components/AllocateTab';
import ArchiveTab from './Components/ArchiveTab';
import { getAnalyticPermissions, listAllocations, listAnalyticAccounts, listAnalyticPeople } from './Service/AnalyticService';
import type { Allocation, AnalyticAccount, AnalyticPermissions, AnalyticPerson, AnalyticTabId } from './Utils/AnalyticTypes';

const NO_ACCESS: AnalyticPermissions = { tabs: [], admin: false };
const newestFirst = (a: Allocation, b: Allocation) => (a.ALLOC_DATE !== b.ALLOC_DATE ? (a.ALLOC_DATE < b.ALLOC_DATE ? 1 : -1) : b.ID - a.ID);

export default function AnalyticAllocationPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [permissions, setPermissions] = useState<AnalyticPermissions | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticTabId>('allocate');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [accounts, setAccounts] = useState<AnalyticAccount[]>([]);
  const [people, setPeople] = useState<AnalyticPerson[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editAllocation, setEditAllocation] = useState<Allocation | null>(null); // admin edit
  const [formKey, setFormKey] = useState(0);

  useAnalyticAllocationTabAudit(activeTab);

  useEffect(() => {
    try {
      if (localStorage.getItem('analyticSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('analyticSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadPermissions = useCallback(async () => {
    try {
      setPermissions(await getAnalyticPermissions());
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

  const visibleTabs = useMemo(() => permissions?.tabs ?? [], [permissions]);
  const canSeeArchive = visibleTabs.includes('archive');

  const loadData = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const [acc, ppl, arc] = await Promise.all([listAnalyticAccounts(), listAnalyticPeople(), canSeeArchive ? listAllocations() : Promise.resolve([])]);
        setAccounts(acc);
        setPeople(ppl);
        setAllocations(arc);
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
    },
    [canSeeArchive],
  );

  useEffect(() => {
    if (visibleTabs.length) void loadData();
  }, [visibleTabs, loadData]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs.includes('allocate') ? 'allocate' : visibleTabs[0]);
  }, [visibleTabs, activeTab]);

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await loadPermissions();
  };

  const activeAccountNames = useMemo(() => accounts.filter((a) => a.IS_ACTIVE).map((a) => a.NAME), [accounts]);

  if (isChecking) return <MainLoader message="Loading Analytic Allocation..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: (tab: AnalyticTabId) => {
      if (editAllocation) setEditAllocation(null);
      if (tab === 'allocate' && activeTab === 'allocate') setFormKey((k) => k + 1);
      setActiveTab(tab);
    },
    visibleTabs,
    onRefresh: visibleTabs.length ? () => void loadData(true) : undefined,
    refreshing,
  };

  return (
    <div className="flex min-h-screen bg-white text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <AnalyticSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <AnalyticSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Analytic Allocation</span>
          </div>
        </header>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {!permissions ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : visibleTabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Analytic Allocation.</div>
          ) : loading && !loaded ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : loadError && !loaded ? (
            <TabFetchError message={loadError} onRetry={() => void loadData()} isRetrying={loading} className="min-h-[60vh]" />
          ) : (
            <>
              {activeTab === 'accounts' && visibleTabs.includes('accounts') && (
                <AccountsTab accounts={accounts} people={people} onChange={setAccounts} onRenamed={() => void listAnalyticPeople().then(setPeople).catch(() => {})} />
              )}
              {activeTab === 'people' && visibleTabs.includes('people') && <PeopleTab people={people} accountNames={activeAccountNames} onChange={setPeople} />}
              {activeTab === 'allocate' && visibleTabs.includes('allocate') && (
                <AllocateTab
                  key={editAllocation ? `edit-${editAllocation.ID}` : `new-${formKey}`}
                  people={people}
                  accountNames={activeAccountNames}
                  editAllocation={editAllocation}
                  onCancelEdit={() => {
                    setEditAllocation(null);
                    setActiveTab('archive');
                  }}
                  onSaved={(a, isEdit) => {
                    setAllocations((prev) => (isEdit ? prev.map((x) => (x.ID === a.ID ? a : x)) : [a, ...prev]).sort(newestFirst));
                    if (isEdit) {
                      setEditAllocation(null);
                      if (canSeeArchive) setActiveTab('archive');
                    }
                  }}
                />
              )}
              {activeTab === 'archive' && canSeeArchive && (
                <ArchiveTab
                  allocations={allocations}
                  admin={permissions.admin}
                  canEdit={permissions.admin && visibleTabs.includes('allocate')} // edit: admin only
                  onEdit={(a) => {
                    setEditAllocation(a);
                    setActiveTab('allocate');
                  }}
                  onDeleted={(id) => setAllocations((prev) => prev.filter((x) => x.ID !== id))}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
