'use client';

// Reports: ready reports, one folder per report (app/Reports/<ReportName>/). Pick a report in the sidebar,
// set its options and download the Excel. Which reports a user sees: Admin Control → Reports.

import { useEffect, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import ReportsSidebar from './Utils/Sidebar';
import { REPORTS } from './Utils/ReportsRegistry';
import { getAllowedReports } from './Service/ReportsAccess';

export default function ReportsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [allowedIds, setAllowedIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const reports = useMemo(() => REPORTS.filter((r) => allowedIds?.includes(r.id)), [allowedIds]);
  const opened = reports.find((r) => r.id === openId);
  useModuleTabAudit(opened ? `Reports · ${opened.title}` : 'Reports');

  useEffect(() => {
    try {
      if (localStorage.getItem('reportsSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('reportsSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadAccess = async () => {
    setError(null);
    try {
      setAllowedIds(await getAllowedReports());
    } catch (e: any) {
      setError(e?.message || 'Could not load the reports');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadAccess();
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, []);

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await loadAccess();
  };

  if (isChecking) return <MainLoader message="Loading Reports..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const Report = opened?.Component;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <ReportsSidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <ReportsSidebar isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Reports</span>
          </div>
        </header>

        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-12 flex-1 w-full flex flex-col space-y-5">
          {error && !allowedIds ? (
            <TabFetchError message={error} onRetry={() => void loadAccess()} className="min-h-[60vh]" />
          ) : !allowedIds ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : reports.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use any report.</div>
          ) : (
            <>
              <h1 className="text-2xl sm:text-3xl font-normal text-black tracking-tighter">Reports</h1>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {reports.map((r) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setOpenId(r.id)}
                      className="aspect-square bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-5 flex flex-col items-center justify-center gap-4 text-center hover:border-[#D4AF37] hover:shadow-lg hover:-translate-y-0.5 transition-all"
                    >
                      <span className="w-14 h-14 rounded-2xl bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-center">
                        <Icon className="w-7 h-7" />
                      </span>
                      <span className="text-sm font-black text-slate-900 leading-snug">{r.title}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      {opened && Report && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpenId(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{opened.title}</h2>
              <button type="button" onClick={() => setOpenId(null)} className="w-9 h-9 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Report key={opened.id} onClose={() => setOpenId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
