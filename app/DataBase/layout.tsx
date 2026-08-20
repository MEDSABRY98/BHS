'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import {
  Menu,
  X,
  Database,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
} from 'lucide-react';
import { useDataBaseRouteAudit } from '@/app/Audit/Model/DataBaseTabAudit';
import { findDatabaseNavItemByPath, getDatabaseNavItemsByCategory, DATABASE_DASHBOARD_HREF, DATABASE_DASHBOARD_NAV, DATABASE_NAV_ITEMS } from './Utils/DatabaseHubConfig';
import { getAllowedModuleTabIds } from '@/app/AdminControl/AdminControlTab/AdminControlTab';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';

interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  isActive: boolean;
  onClick?: () => void;
  isCollapsed?: boolean;
}

function NavItem({ href, icon: Icon, label, isActive, onClick, isCollapsed }: NavItemProps) {
  return (
    <Link
      href={href}
      replace
      onClick={onClick}
      className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
        isActive
          ? 'bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white shadow-lg shadow-amber-950/40 border-l-4 border-[#D4AF37] font-bold'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
      title={isCollapsed ? label : undefined}
    >
      <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
      {!isCollapsed && (
        <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left animate-in fade-in duration-200">{label}</span>
      )}
      {!isCollapsed && isActive && (
        <ChevronRight className="w-4 h-4 ml-auto text-amber-200 animate-in fade-in duration-200" />
      )}
    </Link>
  );
}

export default function DatabaseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  useDataBaseRouteAudit(pathname);
  useSyncLiveUser(setUser);

  useEffect(() => {
    const stored = localStorage.getItem('dbSidebarCollapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }

    const mainUserStr = localStorage.getItem('currentUser');
    if (mainUserStr) {
      try {
        const userData = JSON.parse(mainUserStr);
        if (!userData.NAME && userData.name) {
          userData.NAME = userData.name;
        }
        setUser(userData);
      } catch (e) {
        localStorage.removeItem('currentUser');
      }
    }
    setIsChecking(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    const navItem = findDatabaseNavItemByPath(pathname);
    if (!navItem) return;
    const allowed = getAllowedModuleTabIds(user, 'database', DATABASE_NAV_ITEMS.map((item) => item.id));
    if (!allowed.includes(navItem.id)) {
      router.replace('/DataBase');
    }
  }, [user, pathname, router]);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('dbSidebarCollapsed', String(nextState));
  };

  const handleLogin = (loggedInUser: any) => {
    if (!loggedInUser.NAME && loggedInUser.name) {
      loggedInUser.NAME = loggedInUser.name;
    }
    setUser(loggedInUser);
    localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    router.push('/');
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const isHub = pathname === '/DataBase';
  const isDashboard = pathname === DATABASE_DASHBOARD_HREF;
  const activeNavItem = findDatabaseNavItemByPath(pathname);
  const activeCategoryId = activeNavItem?.category || null;
  const allowedDbTabIds = new Set(getAllowedModuleTabIds(user, 'database', DATABASE_NAV_ITEMS.map((item) => item.id)));
  const sidebarItems = isHub || isDashboard || !activeCategoryId
    ? []
    : getDatabaseNavItemsByCategory(activeCategoryId).filter((item) => allowedDbTabIds.has(item.id));
  const DashboardIcon = DATABASE_DASHBOARD_NAV.icon;

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isCollapsed ? 'w-20' : 'w-72'} bg-[#0a0f1d] text-white border-r border-amber-950/20 shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
          <button
            onClick={handleLogout}
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
              <Database className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-lg font-bold tracking-tight text-white">Database</h2>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
          <div className="mb-2 space-y-1">
            {!isHub && (
              <Link
                href="/DataBase"
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group`}
                title="Back to Hub"
              >
                <ArrowLeft className={`w-4 h-4 text-slate-400 group-hover:text-white transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
                {!isCollapsed && <span className="font-bold text-xs text-slate-300 uppercase tracking-widest">Hub</span>}
              </Link>
            )}
            <Link
              href={DATABASE_DASHBOARD_HREF}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all group relative ${
                isDashboard
                  ? 'bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white shadow-lg shadow-amber-950/40 border-l-4 border-[#D4AF37] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={DATABASE_DASHBOARD_NAV.label}
            >
              <DashboardIcon className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isDashboard ? 'text-white' : 'group-hover:text-white'}`} />
              {!isCollapsed && (
                <span className="text-sm tracking-wide">{DATABASE_DASHBOARD_NAV.label}</span>
              )}
              {!isCollapsed && isDashboard && (
                <ChevronRight className="w-4 h-4 ml-auto text-amber-200" />
              )}
            </Link>
          </div>

          {sidebarItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 mt-auto flex justify-center shrink-0">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area - Shifted by Sidebar Width on Desktop */}
      <div className={`flex-1 flex flex-col min-w-0 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-72'} transition-all duration-300`}>
        {/* Header - Mobile */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200 sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-black">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center mr-2">
              <Database className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <span className="font-bold text-lg tracking-tight">Database</span>
          </div>
          <div className="w-10" />
        </header>

        {/* Drawer - Mobile */}
        {isSidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsSidebarOpen(false)} />

            {/* Menu */}
            <aside className="relative flex flex-col w-72 max-w-xs bg-[#0a0f1d] text-white border-r border-amber-950/20 h-full z-10 animate-in slide-in-from-left duration-300">
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white"
                title="Close Sidebar"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="px-6 pt-6 pb-2 shrink-0">
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-3 py-2.5 text-[#D4AF37] hover:text-amber-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10"
                >
                  <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Back Home</span>
                </button>
              </div>

              <div className="px-4 pt-2 pb-6 shrink-0 flex flex-col items-center justify-center border-b border-white/5">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-[#D4AF37] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-amber-950/50">
                  <Database className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-white">Database</h2>
              </div>

              <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
                <div className="mb-2 space-y-1">
                  {!isHub && (
                    <Link
                      href="/DataBase"
                      onClick={() => setIsSidebarOpen(false)}
                      className="w-full flex items-center px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
                    >
                      <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors mr-3" />
                      <span className="font-bold text-xs text-slate-300 uppercase tracking-widest">Database Hub</span>
                    </Link>
                  )}
                  <Link
                    href={DATABASE_DASHBOARD_HREF}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`w-full flex items-center px-4 py-3.5 rounded-xl transition-all group relative ${
                      isDashboard
                        ? 'bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white shadow-lg shadow-amber-950/40 border-l-4 border-[#D4AF37] font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <DashboardIcon className={`w-5 h-5 mr-3 ${isDashboard ? 'text-white' : 'group-hover:text-white'}`} />
                    <span className="text-sm tracking-wide">{DATABASE_DASHBOARD_NAV.label}</span>
                    {isDashboard && <ChevronRight className="w-4 h-4 ml-auto text-amber-200" />}
                  </Link>
                </div>
                {sidebarItems.map((item) => (
                  <NavItem
                    key={item.href}
                    {...item}
                    isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                    onClick={() => setIsSidebarOpen(false)}
                  />
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Content Wrapper */}
        <main className="flex-grow p-6 sm:p-8 lg:p-12 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
