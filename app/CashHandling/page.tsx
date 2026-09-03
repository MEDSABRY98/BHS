'use client';

import { useState, useEffect } from 'react';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import CashHandlingSidebar, { CashHandlingTabId } from './Utils/Sidebar';
import { Menu } from 'lucide-react';
import { verifyUserCredentials } from '@/app/DataBase/Service/database_service';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

// Cash Receipt Imports
import CashReceiptTab from './CashReceipt/Components/CashReceiptTab';
import { useCashReceiptTabAudit } from '@/app/Audit/Model/CashReceiptTabAudit';

// Cash Handover Imports
import HandoverForm from './CashHandover/Components/HandoverForm';
import SavedHandoversTab from './CashHandover/Components/SavedHandoversTab';
import { useCashHandoverTabAudit } from '@/app/Audit/Model/CashHandoverTabAudit';
import { CashHandover } from './CashHandover/Service/cash_handover_service';

export default function CashHandlingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);

  const [activeTab, setActiveTab] = useState<CashHandlingTabId>('new');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Cash Receipt State
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cash Handover State
  const [editHandover, setEditHandover] = useState<CashHandover | null>(null);

  // Auditing
  useCashReceiptTabAudit(activeTab === 'new' || activeTab === 'saved' || activeTab === 'stats' ? activeTab : 'new');
  useCashHandoverTabAudit(activeTab === 'handover-new' || activeTab === 'handover-saved' ? (activeTab === 'handover-new' ? 'new' : 'saved') : 'new');

  // Load sidebar collapsed state on mount
  useEffect(() => {
    const stored = localStorage.getItem('cashHandlingSidebarCollapsed');
    if (stored === 'false') {
      setIsSidebarCollapsed(false);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextState);
    localStorage.setItem('cashHandlingSidebarCollapsed', String(nextState));
  };

  useEffect(() => {
    const validateAndSetUser = async () => {
      try {
        const savedUser = localStorage.getItem('currentUser');
        const savedPassword = localStorage.getItem('userPassword');

        if (savedUser && savedPassword) {
          try {
            const userData = JSON.parse(savedUser);
            if (userData && userData.name) {
              const result = await verifyUserCredentials(userData.name, savedPassword);

              if (result.success && result.user) {
                setCurrentUser(result.user);
                setIsAuthenticated(true);
                localStorage.setItem('currentUser', JSON.stringify(result.user));
              } else {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('userPassword');
              }
            }
          } catch (e) {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('userPassword');
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

  // Determine initial tab based on permissions
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.name === 'MED Sabry') return; // Admin has full access

    try {
      const perms = JSON.parse(currentUser.role || '{}');
      
      const hasReceiptPerms = perms['cash-receipt'] && Array.isArray(perms['cash-receipt']) && perms['cash-receipt'].length > 0;
      const hasHandoverPerms = perms['cash-handover'] && Array.isArray(perms['cash-handover']) && perms['cash-handover'].length > 0;

      // Ensure activeTab is within allowed permissions, fallback to first available
      let isAllowed = false;
      if (activeTab === 'new' || activeTab === 'saved' || activeTab === 'stats') {
        if (hasReceiptPerms && perms['cash-receipt'].includes(activeTab)) isAllowed = true;
      } else if (activeTab === 'handover-new' || activeTab === 'handover-saved') {
        const mappedId = activeTab.replace('handover-', '');
        if (hasHandoverPerms && perms['cash-handover'].includes(mappedId)) isAllowed = true;
      }

      if (!isAllowed) {
        if (hasReceiptPerms) {
          setActiveTab(perms['cash-receipt'][0] as CashHandlingTabId);
        } else if (hasHandoverPerms) {
          setActiveTab(`handover-${perms['cash-handover'][0]}` as CashHandlingTabId);
        }
      }
    } catch (e) {
      // Default to leaving activeTab as is if parsing fails
    }
  }, [currentUser, activeTab]);

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userPassword', user.password);
  };

  if (isChecking) {
    return <Loading message="Loading Cash Handling Data..." />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <CashHandlingSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
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
        <CashHandlingSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          currentUser={currentUser}
          isCollapsed={false}
          onToggleCollapse={() => { }}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
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
              Cash Handling
            </span>
          </div>
        </header>

        {/* Main Content Wrapper */}
        {(activeTab === 'new' || activeTab === 'saved' || activeTab === 'stats') && (
          <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12 flex-1 w-full">
            <CashReceiptTab
              activeTab={activeTab as 'new' | 'saved' | 'stats'}
              setActiveTab={(val: any) => setActiveTab(val as CashHandlingTabId)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          </div>
        )}

        {(activeTab === 'handover-new' || activeTab === 'handover-saved') && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 no-print custom-scrollbar w-full">
            <div className="max-w-7xl mx-auto pb-20">
              {activeTab === 'handover-new' && (
                <HandoverForm
                  currentUser={currentUser}
                  editHandover={editHandover}
                  onSaveComplete={() => setEditHandover(null)}
                />
              )}
              {activeTab === 'handover-saved' && (
                <SavedHandoversTab
                  onEdit={(handover) => {
                    setEditHandover(handover);
                    setActiveTab('handover-new');
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
