'use client';

import { useState, useEffect } from 'react';
import InventoryScrapTab from '@/app/InventoryScrap/Components/InventoryScrapTab';
import { useInventoryScrapTabAudit } from '@/app/Audit/Model/InventoryScrapTabAudit';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Layers,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Lock,
  History
} from 'lucide-react';
import type { InventoryScrapTabId } from '@/app/Audit/Model/InventoryScrapTabAudit';
import { getAllowedModuleTabIds } from '@/app/AdminControl/AdminControlTab';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

const SCRAP_TABS: { id: InventoryScrapTabId; label: string; icon: typeof Plus }[] = [
  { id: 'record', label: 'Log Scrap', icon: Plus },
  { id: 'sessions', label: 'View Sessions', icon: Layers },
  { id: 'history', label: 'Saved Reports', icon: History },
];
const SCRAP_TAB_IDS = SCRAP_TABS.map((tab) => tab.id);

export default function InventoryScrapPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  const [activeSubTab, setActiveSubTab] = useState<InventoryScrapTabId>('record');
  useInventoryScrapTabAudit(activeSubTab);

  useEffect(() => {
    if (!currentUser) return;
    const allowedTabs = getAllowedModuleTabIds(currentUser, 'inventory-scrap', SCRAP_TAB_IDS);
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeSubTab)) {
      setActiveSubTab(allowedTabs[0] as InventoryScrapTabId);
    }
    try {
      const perms = JSON.parse(currentUser.role || '{}');
      if (Array.isArray(perms.systems)) {
        setIsAllowed(perms.systems.includes('inventory-scrap') || currentUser.name?.toLowerCase() === 'med sabry');
      }
    } catch {
      // keep current allow state
    }
  }, [currentUser, activeSubTab]);

  // Sidebar Collapse states
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userInitial, setUserInitial] = useState('U');

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setIsAuthenticated(true);
        if (parsed.name) {
          setUserInitial(parsed.name.charAt(0).toUpperCase());
        }

        // Check permission for inventory-scrap
        const userName = parsed.name?.toLowerCase() || '';
        if (userName === 'med sabry') {
          setIsAllowed(true);
        } else {
          try {
            const roleStr = parsed.role || '';
            if (roleStr) {
              const perms = JSON.parse(roleStr);
              if (perms.systems) {
                setIsAllowed(perms.systems.includes('inventory-scrap'));
              } else {
                setIsAllowed(true);
              }
            } else {
              setIsAllowed(true);
            }
          } catch (e) {
            setIsAllowed(true);
          }
        }
        const allowedTabs = getAllowedModuleTabIds(parsed, 'inventory-scrap', SCRAP_TAB_IDS);
        if (allowedTabs.length > 0 && !allowedTabs.includes('record')) {
          setActiveSubTab(allowedTabs[0] as InventoryScrapTabId);
        }
      } catch (e) {
        localStorage.removeItem('currentUser');
      } finally {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('scrapSidebarCollapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('scrapSidebarCollapsed', String(nextState));
  };

  const handleLogin = (user: any) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    if (user.name) {
      setUserInitial(user.name.charAt(0).toUpperCase());
    }
    localStorage.setItem('currentUser', JSON.stringify(user));

    // Check permission for inventory-scrap on login
    const userName = user.name?.toLowerCase() || '';
    if (userName === 'med sabry') {
      setIsAllowed(true);
    } else {
      try {
        const roleStr = user.role || '';
        if (roleStr) {
          const perms = JSON.parse(roleStr);
          if (perms.systems) {
            setIsAllowed(perms.systems.includes('inventory-scrap'));
          } else {
            setIsAllowed(true);
          }
        } else {
          setIsAllowed(true);
        }
      } catch (e) {
        setIsAllowed(true);
      }
    }
    const allowedTabs = getAllowedModuleTabIds(user, 'inventory-scrap', SCRAP_TAB_IDS);
    if (allowedTabs.length > 0 && !allowedTabs.includes('record')) {
      setActiveSubTab(allowedTabs[0] as InventoryScrapTabId);
    }
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-slate-200/60 flex flex-col items-center">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mb-6 text-red-500 shadow-sm">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Access Denied</h2>
          <p className="text-slate-500 mt-2 font-medium">You do not have permission to access the Inventory Scrap module.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-8 w-full flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-black text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md active:scale-95 text-sm uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black font-sans selection:bg-blue-100 selection:text-blue-900">

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col ${isCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white border-r border-amber-950/20 shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
          <button
            onClick={() => window.location.href = '/'}
            className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-[#D4AF37] hover:text-amber-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
            title={isCollapsed ? 'Back to Home' : undefined}
          >
            <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
            {!isCollapsed && (
              <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
                Back Home
              </span>
            )}
          </button>
        </div>

        <div className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300 border-b border-white/5`}>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-[#D4AF37] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-amber-950/50 transition-all duration-300">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-lg font-bold tracking-tight text-white">Inventory Scrap</h2>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
          {SCRAP_TABS.filter((tab) =>
            getAllowedModuleTabIds(currentUser, 'inventory-scrap', SCRAP_TAB_IDS).includes(tab.id)
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${isActive
                    ? 'bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white shadow-lg shadow-amber-950/40 border-l-4 border-[#D4AF37] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                title={isCollapsed ? tab.label : undefined}
              >
                <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
                {!isCollapsed && (
                  <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
                )}
                {!isCollapsed && isActive && (
                  <ChevronRight className="w-4 h-4 ml-auto text-amber-200 animate-in fade-in duration-200" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 mt-auto flex justify-center shrink-0">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400 cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area - Shifted by Sidebar Width on Desktop */}
      <div className={`flex-grow flex flex-col min-w-0 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>

        {/* Header - Mobile */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-black cursor-pointer">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-2">
              <Trash2 className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h1 className="font-black text-slate-800 text-base">BHS SCRAP</h1>
          </div>
          <div className="w-10 h-10 bg-black text-[#D4AF37] rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
            {userInitial}
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar Menu */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white border-r border-amber-950/20 transition-transform duration-300 transform lg:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white cursor-pointer"
            title="Close Sidebar"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="px-6 pt-6 pb-2 shrink-0">
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center justify-center gap-3 py-2.5 text-[#D4AF37] hover:text-amber-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10"
            >
              <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">Back Home</span>
            </button>
          </div>

          <div className="px-4 pt-2 pb-6 shrink-0 flex flex-col items-center justify-center border-b border-white/5">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-[#D4AF37] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-amber-950/50">
              <Trash2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white">Inventory Scrap</h2>
          </div>

          <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
            {SCRAP_TABS.filter((tab) =>
              getAllowedModuleTabIds(currentUser, 'inventory-scrap', SCRAP_TAB_IDS).includes(tab.id)
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveSubTab(tab.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all duration-200 group relative cursor-pointer ${isActive
                      ? 'bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white shadow-lg shadow-amber-950/40 border-l-4 border-[#D4AF37] font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  <Icon className={`w-5 h-5 mr-3 shrink-0 ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
                  <span className="text-sm tracking-wide text-left">{tab.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-amber-200" />}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Component Area */}
        <main className="flex-grow p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 min-h-[calc(100vh-6rem)]">
              <InventoryScrapTab activeSubTab={activeSubTab} />
            </div>
          </div>
        </main>
      </div>

    </div>
  );
}
