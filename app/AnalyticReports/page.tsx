'use client';

import NoData from '@/app/Components/DataState/NoDataTab';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useAnalyticReportsTabAudit } from '@/app/AdminControl/Code/Audit/Model/AnalyticReportsTabAudit';
import ReportsSidebar from './Utils/Sidebar';
import UploadTab from './Components/UploadTab';
import RegionsTab from './Components/RegionsTab';
import HqTab from './Components/HqTab';
import AccountsTab from './Components/AccountsTab';
import ReportPicker from './Components/ReportPicker';
import { getReportLines, getReportPermissions, listAnalyticTypes, listReports, setReportClosedMonths } from './Service/ReportService';
import { REPORT_TABS, type AnalyticType, type ReportLine, type ReportMeta, type ReportPermissions, type ReportTabId } from './Utils/ReportTypes';

const NO_ACCESS: ReportPermissions = { tabs: [], admin: false };

export default function AnalyticReportsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [permissions, setPermissions] = useState<ReportPermissions | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTabId>('regions');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [types, setTypes] = useState<AnalyticType[]>([]);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [reportId, setReportId] = useState('');
  const [lines, setLines] = useState<ReportLine[]>([]);
  const [closed, setClosed] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [linesLoading, setLinesLoading] = useState(false);

  useAnalyticReportsTabAudit(activeTab);

  useEffect(() => {
    try {
      if (localStorage.getItem('analyticReportsSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('analyticReportsSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadPermissions = useCallback(async () => {
    try {
      setPermissions(await getReportPermissions());
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

  const visibleTabs = useMemo(() => REPORT_TABS.filter((t) => permissions?.tabs.includes(t)), [permissions]);
  const canSeeAnalysis = visibleTabs.includes('regions') || visibleTabs.includes('hq');

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [t, r] = await Promise.all([listAnalyticTypes(), listReports()]);
      setTypes(t);
      setReports(r);
      setReportId((cur) => (cur && r.some((x) => x.id === cur) ? cur : r[0]?.id || ''));
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
    if (visibleTabs.length) void loadData();
  }, [visibleTabs, loadData]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs.includes('regions') ? 'regions' : visibleTabs[0]);
  }, [visibleTabs, activeTab]);

  // lines of the selected report (only for the analysis tabs)
  const report = reports.find((r) => r.id === reportId) || null;
  useEffect(() => {
    setLines([]);
    if (!report || !canSeeAnalysis) return;
    setClosed(report.closed);
    setLinesLoading(true);
    getReportLines(report.id)
      .then(setLines)
      .catch((e) => toast.error(e?.message || 'Could not load the report'))
      .finally(() => setLinesLoading(false));
  }, [report?.id, canSeeAnalysis]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleClosed = async (m: string) => {
    const next = closed.includes(m) ? closed.filter((x) => x !== m) : [...closed, m];
    setClosed(next);
    try {
      await setReportClosedMonths(reportId, next);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the closed months');
    }
  };

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await loadPermissions();
  };

  if (isChecking) return <MainLoader message="Loading Analytic Reports..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: (tab: ReportTabId) => setActiveTab(tab),
    visibleTabs,
    onRefresh: visibleTabs.length ? () => void loadData(true) : undefined,
    refreshing,
  };

  const picker = <ReportPicker reports={reports} reportId={reportId} onSelect={setReportId} closed={closed} onToggleClosed={(m) => void toggleClosed(m)} />;
  const analysisBody = (render: () => ReactNode) =>
    !report ? <NoData message="No reports yet — upload one in Upload Report" /> : linesLoading ? <TabLoader className="!min-h-[50vh]" /> : render();

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <ReportsSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <ReportsSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Analytic Reports</span>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {!permissions ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : visibleTabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Analytic Reports.</div>
          ) : loading && !loaded ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : loadError && !loaded ? (
            <TabFetchError message={loadError} onRetry={() => void loadData()} isRetrying={loading} className="min-h-[60vh]" />
          ) : (
            <div className="space-y-6">
              {activeTab === 'upload' && (
                <UploadTab
                  types={types}
                  reports={reports}
                  canDelete={!!permissions.admin}
                  onSaved={async (id) => {
                    await loadData(true);
                    setReportId(id);
                    if (canSeeAnalysis) setActiveTab(visibleTabs.includes('regions') ? 'regions' : 'hq');
                  }}
                  onDeleted={() => void loadData(true)}
                />
              )}
              {activeTab === 'regions' && (
                <>
                  {picker}
                  {analysisBody(() => <RegionsTab lines={lines} types={types} months={closed.length ? closed : report!.months} all={report!.months} />)}
                </>
              )}
              {activeTab === 'hq' && (
                <>
                  {picker}
                  {analysisBody(() => <HqTab lines={lines} types={types} months={report!.months} />)}
                </>
              )}
              {activeTab === 'accounts' && <AccountsTab types={types} onChange={() => loadData(true)} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
