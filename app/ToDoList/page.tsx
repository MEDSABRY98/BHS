'use client';

// To Do List: tasks of a day with a check mark, and the history. A user sees his own tasks;
// the admin sees every user's tasks of the day (alphabetical) and gives tasks to other users.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import TodoSidebar from './Utils/Sidebar';
import AddTab from './Components/AddTab';
import TasksTab from './Components/TasksTab';
import HistoryTab from './Components/HistoryTab';
import { getTodoContext } from './Service/TodoService';
import type { TodoContext, TodoTabId } from './Utils/TodoTypes';

export default function ToDoListPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [ctx, setCtx] = useState<TodoContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TodoTabId>('tasks');
  const [reloadKey, setReloadKey] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useModuleTabAudit(`To Do List · ${activeTab === 'add' ? 'Add Tasks' : activeTab === 'tasks' ? 'Tasks' : 'History'}`);

  useEffect(() => {
    try {
      if (localStorage.getItem('todoSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('todoSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadContext = useCallback(async () => {
    setError(null);
    try {
      setCtx(await getTodoContext());
    } catch (e: any) {
      setError(e?.message || 'Could not load the To Do List');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadContext();
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, [loadContext]);

  const [visited, setVisited] = useState<Set<TodoTabId>>(new Set());
  useEffect(() => setVisited((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab))), [activeTab]);
  const mounted = (t: TodoTabId) => visited.has(t) || activeTab === t;

  const visibleTabs = useMemo(() => ctx?.permissions.tabs ?? [], [ctx]);
  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
  }, [visibleTabs, activeTab]);

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await loadContext();
  };

  if (isChecking) return <MainLoader message="Loading To Do List..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: setActiveTab,
    visibleTabs,
    onRefresh: ctx ? () => setReloadKey((k) => k + 1) : undefined,
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <TodoSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <TodoSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">To Do List</span>
          </div>
        </header>

        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {error && !ctx ? (
            <TabFetchError message={error} onRetry={() => void loadContext()} className="min-h-[60vh]" />
          ) : !ctx ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : visibleTabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use the To Do List.</div>
          ) : (
            // a tab is loaded the first time it is opened and then only hidden: coming back to it shows what it had (no reload)
            <>
              {visibleTabs.includes('add') && mounted('add') && (
                <div className={activeTab === 'add' ? 'flex-1 flex flex-col' : 'hidden'}>
                  <AddTab ctx={ctx} />
                </div>
              )}
              {visibleTabs.includes('tasks') && mounted('tasks') && (
                <div className={activeTab === 'tasks' ? 'flex-1 flex flex-col' : 'hidden'}>
                  <TasksTab ctx={ctx} reloadKey={reloadKey} />
                </div>
              )}
              {visibleTabs.includes('history') && mounted('history') && (
                <div className={activeTab === 'history' ? 'flex-1 flex flex-col' : 'hidden'}>
                  <HistoryTab ctx={ctx} reloadKey={reloadKey} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
