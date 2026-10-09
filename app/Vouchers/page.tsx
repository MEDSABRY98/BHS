'use client';

import { useState, useEffect } from 'react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import VouchersSidebar, { VouchersTabId } from './Utils/Sidebar';
import { Menu } from 'lucide-react';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

import { useCashReceiptTabAudit } from '@/app/Audit/Model/CashReceiptTabAudit';

// Unified cash vouchers (Cash In / Cash Out)
import VoucherEntry from './Components/VoucherEntry';
import VouchersRegister from './Components/VouchersRegister';
import { getVoucherPermissions } from './Service/cash_voucher_service';
import type { CashVoucher } from './Utils/voucherTypes';

type VoucherPermissions = Awaited<ReturnType<typeof getVoucherPermissions>>;

export default function VouchersPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [activeTab, setActiveTab] = useState<VouchersTabId>('new');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [permissions, setPermissions] = useState<VoucherPermissions | null>(null);
  const [editVoucher, setEditVoucher] = useState<CashVoucher | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Auditing
  useCashReceiptTabAudit(activeTab);

  // Load sidebar collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem('vouchersSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('vouchersSidebarCollapsed', String(nextState));
  };

  useEffect(() => {
    const validateAndSetUser = async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          try {
            const perms = await getVoucherPermissions();
            setPermissions(perms);
          } catch {
            setPermissions({ in: { create: false, view: false }, out: { create: false, view: false }, stats: false });
          }
        }
      } catch (error) {
        console.error('Error validating user:', error);
      } finally {
        setIsChecking(false);
      }
    };

    validateAndSetUser();
  }, []);

  const visibleTabs: VouchersTabId[] = permissions
    ? ([
        ...(permissions.in.create || permissions.out.create ? ['new'] : []),
        ...(permissions.in.view || permissions.out.view ? ['saved'] : []),
      ] as VouchersTabId[])
    : [];

  useEffect(() => {
    if (visibleTabs.length && !visibleTabs.includes(activeTab)) setActiveTab(visibleTabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs.join(','), activeTab]);

  const handleLogin = async (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    try {
      const perms = await getVoucherPermissions();
      setPermissions(perms);
    } catch {
      setPermissions({ in: { create: false, view: false }, out: { create: false, view: false }, stats: false });
    }
  };

  if (isChecking) {
    return <MainLoader message="Loading Vouchers Data..." />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <VouchersSidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setEditVoucher(null);
            setActiveTab(tab);
          }}
          visibleTabs={visibleTabs}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white transition-transform duration-300 transform lg:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        <VouchersSidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setEditVoucher(null);
            setActiveTab(tab);
          }}
          visibleTabs={visibleTabs}
          isCollapsed={false}
          onToggleCollapse={() => { }}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
        />
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        {/* Header - Mobile Only for Hamburger */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300 no-print lg:hidden">
          <div className="px-4 py-3 flex items-center">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="ml-3 text-lg font-extrabold text-slate-800 tracking-tight">
              Vouchers
            </span>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
          {!permissions ? (
            <MainLoader fullScreen={false} message="Loading..." />
          ) : visibleTabs.length === 0 ? (
            <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use Vouchers.</div>
          ) : (
            <>
              <div className={activeTab === 'new' ? 'block' : 'hidden'}>
                {visibleTabs.includes('new') && (
                  <VoucherEntry
                    key={editVoucher?.ID || 'new'}
                    permissions={permissions}
                    currentUserName={currentUser?.name || ''}
                    editVoucher={editVoucher}
                    onDone={() => {
                      setEditVoucher(null);
                      setRefreshTrigger((prev) => prev + 1);
                      setActiveTab('saved');
                    }}
                  />
                )}
              </div>
              <div className={activeTab === 'saved' ? 'block' : 'hidden'}>
                {visibleTabs.includes('saved') && (
                  <VouchersRegister
                    canEdit={{ IN: permissions.in.create, OUT: permissions.out.create }}
                    currentUserName={currentUser?.name || ''}
                    onEdit={(v) => {
                      setEditVoucher(v);
                      setActiveTab('new');
                    }}
                    refreshTrigger={refreshTrigger}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
