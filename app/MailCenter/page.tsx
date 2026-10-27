'use client';

// Mail Center: send emails from the finance mailbox with attachments made from the modules
// (customer / group / supplier statement), with templates and a sent log.

import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import MailSidebar from './Utils/Sidebar';
import ComposeTab from './Components/ComposeTab';
import TemplatesTab from './Components/TemplatesTab';
import SentTab from './Components/SentTab';
import SettingsTab from './Components/SettingsTab';
import { getMailPermissions, getMailStatus, listMailCustomers, listMailLog, listMailSuppliers, listMailTemplates } from './Service/MailService';
import type { MailCustomer, MailLogRow, MailPermissions, MailStatus, MailSupplier, MailTabId, MailTemplate } from './Utils/MailTypes';

const TITLES: Record<MailTabId, string> = { compose: 'Compose', bulk: 'Bulk Send', templates: 'Templates', sent: 'Sent', settings: 'Settings' };
const NO_ACCESS: MailPermissions = { tabs: [], admin: false };

export default function MailCenterPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [permissions, setPermissions] = useState<MailPermissions | null>(null);
  const [activeTab, setActiveTab] = useState<MailTabId>('compose');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  useModuleTabAudit(`Mail Center · ${TITLES[activeTab]}`);

  const [status, setStatus] = useState<MailStatus | null>(null);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [customers, setCustomers] = useState<MailCustomer[] | null>(null);
  const [suppliers, setSuppliers] = useState<MailSupplier[] | null>(null);
  const [log, setLog] = useState<MailLogRow[]>([]);
  const [logLoaded, setLogLoaded] = useState(false);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [opened, setOpened] = useState<Set<MailTabId>>(new Set());
  const [headerEl, setHeaderEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem('mailSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('mailSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadPermissions = useCallback(async () => {
    try {
      setPermissions(await getMailPermissions());
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
      } finally {
        setIsChecking(false);
      }
    })();
  }, [loadPermissions]);

  const tabs = permissions?.tabs ?? [];
  const canPick = tabs.includes('compose');

  const loadBase = useCallback(async () => {
    const jobs: Promise<unknown>[] = [getMailStatus().then(setStatus)];
    if (canPick || tabs.includes('templates')) jobs.push(listMailTemplates().then(setTemplates));
    await Promise.all(jobs.map((j) => j.catch((e: any) => toast.error(e?.message || 'Could not load the data'))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canPick, tabs.join(',')]);

  const loadPickers = useCallback(async () => {
    await Promise.all([
      listMailCustomers().then(setCustomers).catch((e: any) => {
        setCustomers([]);
        toast.error(e?.message || 'Could not load the customers');
      }),
      listMailSuppliers().then(setSuppliers).catch((e: any) => {
        setSuppliers([]);
        toast.error(e?.message || 'Could not load the suppliers');
      }),
    ]);
  }, []);

  const loadLog = useCallback(async () => {
    setLogLoading(true);
    try {
      setLog(await listMailLog());
      setLogError(null);
      setLogLoaded(true);
    } catch (e: any) {
      setLogError(e?.message || 'Could not load the sent emails');
    } finally {
      setLogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tabs.length) void loadBase();
  }, [tabs.length, loadBase]);

  useEffect(() => {
    if (tabs.length && !tabs.includes(activeTab)) setActiveTab(tabs[0]);
  }, [tabs, activeTab]);

  // each tab loads its data the first time it is opened, then stays mounted (nothing typed is lost)
  useEffect(() => {
    if (!tabs.includes(activeTab) || opened.has(activeTab)) return;
    setOpened((p) => new Set(p).add(activeTab));
    if (activeTab === 'compose' && !customers) void loadPickers();
    if (activeTab === 'sent' && !logLoaded) void loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, tabs.join(',')]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadBase();
      if (activeTab === 'compose') await loadPickers();
      if (activeTab === 'sent') await loadLog();
    } finally {
      setRefreshing(false);
    }
  };

  const onSent = (rows: MailLogRow[]) => {
    if (logLoaded) setLog((prev) => [...rows.slice().reverse(), ...prev]);
  };

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await loadPermissions();
  };

  if (isChecking) return <MainLoader message="Loading Mail Center..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: (tab: MailTabId) => setActiveTab(tab),
    visibleTabs: tabs,
    onRefresh: tabs.length ? () => void refresh() : undefined,
    refreshing,
  };
  const show = (tab: MailTabId) => (activeTab === tab ? '' : 'hidden');

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <MailSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <MailSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Mail Center</span>
          </div>
        </header>

        <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col space-y-5">
          {!permissions ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : tabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Mail Center.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{TITLES[activeTab]}</h1>
                {/* Compose (tabs, Send) and Templates (New Template) put their buttons here */}
                <div ref={setHeaderEl} className="flex flex-1 flex-wrap items-center gap-3 min-w-0" />
              </div>
              {tabs.includes('compose') && (
                <div className={show('compose')}>
                  <ComposeTab status={status} customers={customers} suppliers={suppliers} templates={templates} onSent={(r) => onSent([r])} headerEl={headerEl} active={activeTab === 'compose'} />
                </div>
              )}
              {tabs.includes('templates') && (
                <div className={show('templates')}>
                  <TemplatesTab templates={templates} onChange={setTemplates} headerEl={headerEl} active={activeTab === 'templates'} />
                </div>
              )}
              {tabs.includes('sent') && (
                <div className={show('sent')}>
                  {logLoading && !logLoaded ? (
                    <TabLoader className="!min-h-[60vh]" />
                  ) : logError && !logLoaded ? (
                    <TabFetchError message={logError} onRetry={() => void loadLog()} />
                  ) : (
                    <SentTab rows={log} admin={permissions.admin} />
                  )}
                </div>
              )}
              {tabs.includes('settings') && (
                <div className={show('settings')}>
                  <SettingsTab status={status} onChange={setStatus} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
