'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Login from '@/app/Components/Auth/Login';
import Loading from '@/app/Components/Loading';
import { useLposRouteAudit } from '@/app/Audit/Modules/LPOsTabAudit';
import { LpoDataProvider } from './Context/LpoDataContext';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  UserCircle,
  LogOut,
  Menu,
  X,
  ReceiptText,
  ChevronRight,
  ChevronLeft,
  FileText,
  ArrowLeft,
  FileX2
} from 'lucide-react';

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

function readStoredUser() {
  if (typeof window === 'undefined') return null;
  const mainUserStr = localStorage.getItem('currentUser');
  if (!mainUserStr) return null;
  try {
    const userData = JSON.parse(mainUserStr);
    if (!userData.NAME && userData.name) {
      userData.NAME = userData.name;
    }
    return userData;
  } catch {
    localStorage.removeItem('currentUser');
    return null;
  }
}

const ALL_NAV_ITEMS = [
  { id: 'lpo-dashboard', href: '/LPOs', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'lpo-orders', href: '/LPOs/Orders', icon: ShoppingCart, label: 'Orders' },
  { id: 'lpo-create-orders', href: '/LPOs/CreateOrders', icon: ReceiptText, label: 'Create Orders' },
  { id: 'lpo-reports', href: '/LPOs/Reports', icon: FileText, label: 'Reports' },
  { id: 'lpo-invoice-cancel', href: '/LPOs/InvoiceCancel', icon: FileX2, label: 'Invoice Cancel' },
];

function getLpoNavIdFromPath(pathname: string): string | null {
  if (pathname === '/LPOs') return 'lpo-dashboard';
  if (pathname.startsWith('/LPOs/OrderDetails') || pathname.startsWith('/LPOs/Orders')) return 'lpo-orders';
  if (pathname.startsWith('/LPOs/CreateOrders')) return 'lpo-create-orders';
  if (pathname.startsWith('/LPOs/Reports')) return 'lpo-reports';
  if (pathname.startsWith('/LPOs/InvoiceCancel')) return 'lpo-invoice-cancel';
  return null;
}

function getFilteredNavItems(user: any) {
  if (!user) return [];

  if (user.NAME === 'MED Sabry' || user.name === 'med sabry') return ALL_NAV_ITEMS;

  try {
    const mainUserStr = localStorage.getItem('currentUser');
    if (mainUserStr) {
      const mainUser = JSON.parse(mainUserStr);
      const roleStr = mainUser.role || '{}';
      const perms = JSON.parse(roleStr);

      if (perms.systems && !perms.systems.includes('lpo-management')) return [];

      if (Array.isArray(perms['lpo-management'])) {
        return ALL_NAV_ITEMS.filter((item) => perms['lpo-management'].includes(item.id));
      }
    }
  } catch (e) {
    console.error('Error parsing permissions:', e);
  }

  return ALL_NAV_ITEMS;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);
  useLposRouteAudit(pathname);
  useSyncLiveUser(setUser);

  useEffect(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }

    const storedUser = readStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setIsChecking(false);
  }, []);

  useEffect(() => {
    if (isChecking || !user) return;

    const navItemsForUser = getFilteredNavItems(user);
    if (navItemsForUser.length === 0) {
      router.replace('/');
      return;
    }

    const currentNavId = getLpoNavIdFromPath(pathname);
    if (!currentNavId) return;

    const allowedIds = new Set(navItemsForUser.map((item) => item.id));
    if (!allowedIds.has(currentNavId)) {
      router.replace(navItemsForUser[0].href);
    }
  }, [isChecking, user, pathname, router]);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebarCollapsed', String(nextState));
  };

  const handleLogin = (loggedInUser: any) => {
    if (!loggedInUser.NAME && loggedInUser.name) {
      loggedInUser.NAME = loggedInUser.name;
    }
    setUser(loggedInUser);
    localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    // Only remove main user if they really want to log out of the whole system, 
    // but usually in this context "Sign Out" from LPO means going back to main selection.
    router.push('/');
  };

  if (isChecking) {
    return <Loading />;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const navItems = getFilteredNavItems(user);

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
              <ReceiptText className="w-6 h-6 text-white" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-lg font-bold tracking-tight text-white">LPO Management</h2>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || (item.href !== '/LPOs' && pathname.startsWith(item.href))}
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
              <ReceiptText className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h1 className="font-bold">BHS LPO'S</h1>
          </div>
          <div className="w-10 h-10 bg-black text-[#D4AF37] rounded-full flex items-center justify-center text-sm font-bold">
            {user.NAME.charAt(0)}
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0f1d] text-white border-r border-amber-950/20 transition-transform duration-300 transform lg:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
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
              <ReceiptText className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white">LPO Management</h2>
          </div>

          <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                isActive={pathname === item.href}
                onClick={() => setIsSidebarOpen(false)}
              />
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 lg:p-12">
          <div className={`${(pathname === '/LPOs' || pathname === '/LPOs/Orders' || pathname === '/LPOs/CreateOrders' || pathname === '/LPOs/InvoiceCancel' || pathname.startsWith('/DataBase')) ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            <LpoDataProvider>{children}</LpoDataProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
