'use client';

// One page frame for every form: login, permissions, the sidebar (New / Archive),
// the header (title + the form's own icons + Save) and the archive list.
// The form itself is given by renderNew(ctx) and only fills ctx.registerSave.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Menu, Save, X, type LucideIcon } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import FormSidebar from './FormSidebar';
import FormArchiveList from './FormArchiveList';
import { getFormAccess, listFormRecords, saveFormRecord } from './FormsArchiveService';
import type { FormAccess, FormEditorContext, FormRecord, FormSavePayload, FormTabId } from './FormsArchiveTypes';

interface FormShellProps<T> {
  formId: string;
  title: string;
  icon: LucideIcon;
  renderNew: (ctx: FormEditorContext<T>) => React.ReactNode;
  /** download / print a saved form from the archive */
  onDownload?: (r: FormRecord<T>) => Promise<void>;
  downloadLabel?: string;
  maxWidth?: string;
  /** show the Title column in the archive (default true) */
  archiveShowTitle?: boolean;
}

const NO_ACCESS: FormAccess = { use: false, archive: false, admin: false };

export default function FormShell<T = any>({ formId, title, icon, renderNew, onDownload, downloadLabel, maxWidth = 'max-w-[1100px]', archiveShowTitle = true }: FormShellProps<T>) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [access, setAccess] = useState<FormAccess | null>(null);
  const [activeTab, setActiveTab] = useState<FormTabId>('new');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  useModuleTabAudit(`${title} · ${activeTab === 'new' ? 'New' : 'Archive'}`);

  const [records, setRecords] = useState<FormRecord<T>[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<FormRecord<T> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [startEmpty, setStartEmpty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionsEl, setActionsEl] = useState<HTMLDivElement | null>(null);
  const saveFn = useRef<(() => FormSavePayload<T> | null) | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem('formsSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('formsSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadAccess = useCallback(async () => {
    try {
      setAccess(await getFormAccess(formId));
    } catch {
      setAccess(NO_ACCESS);
    }
  }, [formId]);

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
  }, [loadAccess]);

  const visibleTabs: FormTabId[] = access ? ([access.use && 'new', access.archive && 'archive'].filter(Boolean) as FormTabId[]) : [];

  const loadRecords = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        setRecords((await listFormRecords(formId)) as FormRecord<T>[]);
        setLoadError(null);
        setLoaded(true);
      } catch (err: any) {
        const message = err?.message || 'Could not load the saved forms';
        setLoadError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [formId],
  );

  // the archive is loaded the first time it is opened
  useEffect(() => {
    if (activeTab === 'archive' && access?.archive && !loaded && !loading) void loadRecords();
  }, [activeTab, access, loaded, loading, loadRecords]);

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs.join(','), activeTab]);

  const registerSave = useCallback((fn: (() => FormSavePayload<T> | null) | null) => {
    saveFn.current = fn;
  }, []);

  const save = async () => {
    const payload = saveFn.current?.();
    if (!payload) return;
    setSaving(true);
    try {
      const saved = (await saveFormRecord(formId, payload, editing?.ID)) as FormRecord<T>;
      if (loaded) setRecords((prev) => (editing ? prev.map((x) => (x.ID === saved.ID ? saved : x)) : [saved, ...prev]));
      if (editing) {
        toast.success(`${saved.REF_NO} updated`);
        setEditing(null);
        setActiveTab(access?.archive ? 'archive' : 'new');
      } else {
        toast.success(`Saved as ${saved.REF_NO}`);
      }
      // a fresh empty form
      setStartEmpty(true);
      setFormKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    await loadAccess();
  };

  if (isChecking) return <MainLoader message={`Loading ${title}...`} />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    title,
    icon,
    activeTab,
    onTabChange: (tab: FormTabId) => {
      if (editing) {
        setEditing(null);
        setStartEmpty(false);
        setFormKey((k) => k + 1);
      }
      setActiveTab(tab);
    },
    visibleTabs,
    onRefresh: access?.archive && activeTab === 'archive' ? () => void loadRecords(true) : undefined,
    refreshing,
  };

  const heading = activeTab === 'archive' ? `${title} · Archive` : editing ? `${title} · ${editing.REF_NO}` : title;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <FormSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <FormSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">{title}</span>
          </div>
        </header>

        <div className={`${maxWidth} mx-auto px-4 sm:px-6 pt-6 pb-12 flex-1 w-full flex flex-col space-y-5`}>
          {!access ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : visibleTabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use this form.</div>
          ) : activeTab === 'archive' && access.archive && !loaded && !loadError ? (
            // the archive is loading: the loader alone, no title
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-normal text-black tracking-tighter">{heading}</h1>
                {activeTab === 'new' && (
                  <div className="flex items-center gap-2 ml-auto">
                    {/* the form puts its own icons here */}
                    <div ref={setActionsEl} className="flex items-center gap-2" />
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={saving}
                      className="h-10 px-4 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      title={editing ? 'Save the changes' : 'Save to the archive'}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setStartEmpty(false);
                          setFormKey((k) => k + 1);
                          setActiveTab('archive');
                        }}
                        className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" /> Cancel Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {activeTab === 'new' && access.use && (
                <div key={editing ? `edit-${editing.ID}` : `new-${formKey}`}>{renderNew({ editing, actionsEl, registerSave, startEmpty: !editing && startEmpty })}</div>
              )}

              {activeTab === 'archive' && access.archive &&
                (loadError && !loaded ? (
                  <TabFetchError message={loadError} onRetry={() => void loadRecords()} />
                ) : (
                  <FormArchiveList
                    formId={formId}
                    records={records}
                    admin={access.admin}
                    canEdit={access.admin && access.use}
                    onEdit={(r) => {
                      setEditing(r as FormRecord<T>);
                      setActiveTab('new');
                    }}
                    onDeleted={(id) => setRecords((prev) => prev.filter((x) => x.ID !== id))}
                    onDownload={onDownload as ((r: FormRecord) => Promise<void>) | undefined}
                    downloadLabel={downloadLabel}
                    showTitle={archiveShowTitle}
                  />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
