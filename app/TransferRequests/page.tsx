'use client';

import { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import TransferSidebar from './Utils/Sidebar';
import RequestForm from './Components/RequestForm';
import RequestsTab from './Components/RequestsTab';
import BeneficiariesTab from './Components/BeneficiariesTab';
import { getTransferPermissions, loadTransferData } from './Service/TransferService';
import type { TransferBank, TransferBeneficiary, TransferPermissions, TransferRequest, TransferTabId } from './Utils/TransferTypes';

const NO_ACCESS: TransferPermissions = { tabs: [], viewAll: false };
const byName = <T extends { NAME: string }>(a: T, b: T) => a.NAME.localeCompare(b.NAME);
const newestFirst = (a: TransferRequest, b: TransferRequest) =>
  a.REQUEST_DATE !== b.REQUEST_DATE ? (a.REQUEST_DATE < b.REQUEST_DATE ? 1 : -1) : a.CREATED_AT < b.CREATED_AT ? 1 : -1;

function upsert<T extends { ID: string }>(list: T[], item: T, sort: (a: T, b: T) => number): T[] {
  const exists = list.some((x) => x.ID === item.ID);
  return (exists ? list.map((x) => (x.ID === item.ID ? item : x)) : [...list, item]).sort(sort);
}

export default function TransferRequestsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [permissions, setPermissions] = useState<TransferPermissions | null>(null);
  const [activeTab, setActiveTab] = useState<TransferTabId>('new');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<TransferBeneficiary[]>([]);
  const [banks, setBanks] = useState<TransferBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<TransferRequest | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem('transferSidebarCollapsed') === 'false') setIsSidebarCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    const next = !isSidebarCollapsed;
    setIsSidebarCollapsed(next);
    try {
      localStorage.setItem('transferSidebarCollapsed', String(next));
    } catch {
      // ignore
    }
  };

  const loadPermissions = useCallback(async () => {
    try {
      setPermissions(await getTransferPermissions());
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

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await loadTransferData();
      setRequests(data.requests);
      setBeneficiaries(data.beneficiaries);
      setBanks(data.banks);
      setLoadError(null);
    } catch (err: any) {
      const message = err?.message || 'Could not load the data';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const canView = !!permissions && permissions.tabs.length > 0;
  useEffect(() => {
    if (canView) void loadData();
  }, [canView, loadData]);

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

  const changeTab = (tab: TransferTabId) => {
    if (tab !== 'new' && editRequest) setEditRequest(null);
    if (tab === 'new' && activeTab === 'new' && !editRequest) setFormKey((k) => k + 1); // fresh form
    setActiveTab(tab);
  };

  if (isChecking) return <MainLoader message="Loading Transfer Requests..." />;
  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  const sidebarProps = {
    activeTab,
    onTabChange: changeTab,
    visibleTabs,
    onRefresh: () => void loadData(true),
    refreshing,
  };

  const bankSaved = (b: TransferBank) => setBanks((prev) => upsert(prev, b, byName));
  const beneficiarySaved = (b: TransferBeneficiary) => setBeneficiaries((prev) => upsert(prev, b, byName));

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <TransferSidebar {...sidebarProps} isCollapsed={isSidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileSidebarOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <TransferSidebar {...sidebarProps} isCollapsed={false} onToggleCollapse={() => {}} onCloseMobile={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all">
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">Transfer Requests</span>
          </div>
        </header>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full flex flex-col">
          {!permissions || (canView && loading) ? (
            <TabLoader className="!min-h-[70vh] flex-1" />
          ) : !canView ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Transfer Requests.</div>
          ) : loadError && !banks.length && !beneficiaries.length && !requests.length ? (
            <div className="p-20 text-center">
              <p className="font-bold text-red-500 mb-4">{loadError}</p>
              <button onClick={() => void loadData()} className="px-5 py-2.5 rounded-xl bg-[#0a0f1d] text-white text-sm font-bold">
                Try Again
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'new' && visibleTabs.includes('new') && (
                <RequestForm
                  key={editRequest?.ID || `new-${formKey}`}
                  editRequest={editRequest}
                  banks={banks}
                  beneficiaries={beneficiaries}
                  onSaved={(r) => setRequests((prev) => upsert(prev, r, newestFirst))}
                  onCancelEdit={() => {
                    setEditRequest(null);
                    setActiveTab(visibleTabs.includes('requests') ? 'requests' : 'new');
                  }}
                  onBankSaved={bankSaved}
                  onBeneficiarySaved={beneficiarySaved}
                />
              )}
              {activeTab === 'requests' && visibleTabs.includes('requests') && (
                <RequestsTab
                  requests={requests}
                  banks={banks}
                  beneficiaries={beneficiaries}
                  viewAll={permissions.viewAll}
                  canEdit={visibleTabs.includes('new')}
                  onEdit={(r) => {
                    setEditRequest(r);
                    setActiveTab('new');
                  }}
                  onDeleted={(id) => setRequests((prev) => prev.filter((r) => r.ID !== id))}
                />
              )}
              {activeTab === 'beneficiaries' && visibleTabs.includes('beneficiaries') && (
                <BeneficiariesTab
                  banks={banks}
                  beneficiaries={beneficiaries}
                  onBankSaved={bankSaved}
                  onBankDeleted={(id) => setBanks((prev) => prev.filter((b) => b.ID !== id))}
                  onBeneficiarySaved={beneficiarySaved}
                  onBeneficiaryDeleted={(id) => setBeneficiaries((prev) => prev.filter((b) => b.ID !== id))}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
