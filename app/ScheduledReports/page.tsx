'use client';

// Scheduled Reports: reports emailed automatically (Dubai time). Admins / admins of this module only.

import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { isAdminRole } from '@/lib/AdminRole';
import { useScheduledReportsTabAudit } from '@/app/AdminControl/Code/Audit/Model/ScheduledReportsTabAudit';
import ScheduledReportsSidebar, { type ScheduledReportsTabId } from './Utils/Sidebar';
import ReportsTab from './Components/ReportsTab';
import LogTab from './Components/LogTab';
import { getScheduledReportsAccess, listScheduledReportLog, listScheduledReports } from './Service/ScheduledReportsService';
import type { ReportLogRow, ScheduledReport } from './Utils/Types';

const MODULE_ID = 'scheduled-reports';

export default function ScheduledReportsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [activeTab, setActiveTab] = useState<ScheduledReportsTabId>('reports');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [access, setAccess] = useState<{ canEdit: boolean; canDelete: boolean } | null>(null);
  const [reports, setReports] = useState<ScheduledReport[] | null>(null);
  const [setup, setSetup] = useState({ mailReady: false, mailFrom: null as string | null, cronReady: false });
  const [log, setLog] = useState<ReportLogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useScheduledReportsTabAudit(activeTab);

  useEffect(() => {
    try {
      if (localStorage.getItem('scheduledReportsSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('scheduledReportsSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const allowed = isAdminRole(currentUser, MODULE_ID);

  const loadAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const [acc, list, rows] = await Promise.all([getScheduledReportsAccess(), listScheduledReports(), listScheduledReportLog()]);
      setAccess(acc);
      setReports(list.reports);
      setSetup({ mailReady: list.mailReady, mailFrom: list.mailFrom, cronReady: list.cronReady });
      setLog(rows);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Could not load the scheduled reports');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const loadLog = useCallback(async () => {
    try {
      setLog(await listScheduledReportLog());
    } catch {
      // the log tab keeps the old rows
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isAuthenticated && allowed && !reports) void loadAll();
  }, [isAuthenticated, allowed, reports, loadAll]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  if (isChecking) return <MainLoader message="Loading Scheduled Reports..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: (tab: ScheduledReportsTabId) => {
      setActiveTab(tab);
      if (tab === 'log') void loadLog();
    },
    onRefresh: allowed ? () => void loadAll(true) : undefined,
    refreshing,
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <ScheduledReportsSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <ScheduledReportsSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Scheduled Reports</span>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {!allowed ? (
            <div className="p-20 text-center font-bold text-slate-400">Only admins can use Scheduled Reports.</div>
          ) : error && !reports ? (
            <TabFetchError message={error} onRetry={() => void loadAll()} className="min-h-[60vh]" />
          ) : !reports || !access || !log ? (
            <TabLoader className="-mt-6 -mb-12 !min-h-screen" />
          ) : activeTab === 'reports' ? (
            <ReportsTab
              reports={reports}
              mailReady={setup.mailReady}
              mailFrom={setup.mailFrom}
              cronReady={setup.cronReady}
              canEdit={access.canEdit}
              canDelete={access.canDelete}
              onChange={setReports}
              onSent={() => void loadLog()}
            />
          ) : (
            <LogTab rows={log} />
          )}
        </div>
      </div>
    </div>
  );
}
