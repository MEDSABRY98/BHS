'use client';

import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useCreditNotesTabAudit } from '@/app/AdminControl/Code/Audit/Model/CreditNotesTabAudit';
import CreditNotesSidebar from './Utils/Sidebar';
import CreditNoteForm from './Components/CreditNoteForm';
import CreditNotesList from './Components/CreditNotesList';
import { getCreditNotePermissions, listCreditNotes } from './Service/CreditNoteService';
import type { CreditNote, CreditNotePermissions, CreditNotesTabId } from './Utils/CreditNoteTypes';

const NO_ACCESS: CreditNotePermissions = { tabs: [], admin: false };
const newestFirst = (a: CreditNote, b: CreditNote) => (a.NOTE_DATE !== b.NOTE_DATE ? (a.NOTE_DATE < b.NOTE_DATE ? 1 : -1) : a.ID < b.ID ? 1 : -1);

export default function CreditNotesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [permissions, setPermissions] = useState<CreditNotePermissions | null>(null);
  const [activeTab, setActiveTab] = useState<CreditNotesTabId>('new');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editNote, setEditNote] = useState<CreditNote | null>(null); // admin edit
  const [formKey, setFormKey] = useState(0);

  useCreditNotesTabAudit(activeTab);

  useEffect(() => {
    try {
      if (localStorage.getItem('creditNotesSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('creditNotesSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadPermissions = useCallback(async () => {
    try {
      setPermissions(await getCreditNotePermissions());
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
  const canSeeNotes = visibleTabs.includes('notes');

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      setNotes(await listCreditNotes());
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
    if (canSeeNotes) void loadData();
  }, [canSeeNotes, loadData]);

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

  if (isChecking) return <MainLoader message="Loading Credit Notes..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: (tab: CreditNotesTabId) => {
      if (editNote) setEditNote(null);
      if (tab === 'new' && activeTab === 'new') setFormKey((k) => k + 1);
      setActiveTab(tab);
    },
    visibleTabs,
    onRefresh: canSeeNotes ? () => void loadData(true) : undefined,
    refreshing,
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <CreditNotesSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <CreditNotesSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Credit Notes</span>
          </div>
        </header>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {!permissions ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : visibleTabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Credit Notes.</div>
          ) : (
            <>
              {activeTab === 'new' && visibleTabs.includes('new') && (
                <CreditNoteForm
                  key={editNote ? `edit-${editNote.ID}` : `new-${formKey}`}
                  editNote={editNote}
                  onCancelEdit={() => {
                    setEditNote(null);
                    setActiveTab('notes');
                  }}
                  onSaved={(n, isEdit) => {
                    setNotes((prev) => (isEdit ? prev.map((x) => (x.ID === n.ID ? n : x)) : [n, ...prev.filter((x) => x.ID !== n.ID)]).sort(newestFirst));
                    setEditNote(null);
                    if (isEdit && canSeeNotes) setActiveTab('notes');
                  }}
                />
              )}
              {activeTab === 'notes' && canSeeNotes && (
                loading && !loaded ? (
                  <TabLoader className="!min-h-[70vh] flex-1" />
                ) : loadError && !loaded ? (
                  <TabFetchError message={loadError} onRetry={() => void loadData()} isRetrying={loading} className="min-h-[60vh]" />
                ) : (
                  <CreditNotesList
                    notes={notes}
                    admin={permissions.admin}
                    canEdit={permissions.admin && visibleTabs.includes('new')} // edit: admin only
                    onEdit={(n) => {
                      setEditNote(n);
                      setActiveTab('new');
                    }}
                    onDeleted={(id) => setNotes((prev) => prev.filter((n) => n.ID !== id))}
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
