'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
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
  ArrowLeft
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
      className={`flex items-center ${isCollapsed ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group ${isActive
        ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      title={isCollapsed ? label : undefined}
    >
      <Icon className={`w-5 h-5 transition-colors ${isCollapsed ? '' : 'mr-4'} ${isActive ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
      {!isCollapsed && (
        <span className="font-medium text-sm tracking-wide whitespace-nowrap animate-in fade-in duration-200">{label}</span>
      )}
      {!isCollapsed && isActive && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37] animate-in fade-in duration-200" />}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebarCollapsed', String(nextState));
  };

  useEffect(() => {
    setIsMounted(true);
    const mainUserStr = localStorage.getItem('currentUser');

    if (!mainUserStr) {
      router.push('/');
    } else {
      const userData = JSON.parse(mainUserStr);
      // Ensure we have a NAME property for display/logic (mapping from main user's name if needed)
      if (!userData.NAME && userData.name) {
        userData.NAME = userData.name;
      }
      setUser(userData);
    }
  }, [router]);

  const handleLogout = () => {
    // Only remove main user if they really want to log out of the whole system, 
    // but usually in this context "Sign Out" from LPO means going back to main selection.
    router.push('/');
  };

  if (!isMounted || !user) return null;

  const ALL_NAV_ITEMS = [
    { id: 'lpo-dashboard', href: '/LPOs', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'lpo-orders', href: '/LPOs/Orders', icon: ShoppingCart, label: 'Orders' },
    { id: 'lpo-create-orders', href: '/LPOs/CreateOrders', icon: ReceiptText, label: 'Create Orders' },
    { id: 'lpo-reports', href: '/LPOs/Reports', icon: FileText, label: 'Reports' },
  ];

  const getFilteredNavItems = () => {
    if (!user) return [];

    // Admin Sabry has full access
    if (user.NAME === 'MED Sabry' || user.name === 'med sabry') return ALL_NAV_ITEMS;

    try {
      // Check for main system permissions (stored in 'role' as JSON)
      const mainUserStr = localStorage.getItem('currentUser');
      if (mainUserStr) {
        const mainUser = JSON.parse(mainUserStr);
        const roleStr = mainUser.role || '{}';
        const perms = JSON.parse(roleStr);

        // If they don't have access to LPO system at all, return empty
        if (perms.systems && !perms.systems.includes('lpo-management')) return [];

        // Check for sub-tab permissions
        const allowedTabs = perms['lpo-management'] || [];
        return ALL_NAV_ITEMS.filter(item => allowedTabs.includes(item.id));
      }
    } catch (e) {
      console.error('Error parsing permissions:', e);
    }

    // Default to all if no permission system found (legacy or LPO-only login)
    return ALL_NAV_ITEMS;
  };

  const navItems = getFilteredNavItems();

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isCollapsed ? 'w-20' : 'w-72'} bg-black text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <div className={`px-4 ${isCollapsed ? 'lg:px-4' : 'lg:px-8'} pt-6 pb-2 bg-black/50 backdrop-blur-md transition-all duration-300`}>
          <button
            onClick={handleLogout}
            className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-red-500 hover:text-red-400 transition-all duration-200 group w-full cursor-pointer`}
          >
            <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
            {!isCollapsed && (
              <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
                Back Home
              </span>
            )}
          </button>
        </div>
        <div className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300`}>
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-[#D4AF37]/20 transition-all duration-300">
              <ReceiptText className="w-7 h-7 text-black" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-xl font-bold tracking-tight">BHS LPO'S</h2>
                <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase">Admin Panel</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || (item.href !== '/LPOs' && pathname.startsWith(item.href))}
              isCollapsed={isCollapsed}
            />
          ))}
        </nav>

        {/* Toggle Button */}
        <div className="p-4 border-t border-white/10 mt-auto flex justify-center">
          <button 
            onClick={toggleSidebar} 
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-[#D4AF37]"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
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
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-black text-white transition-transform duration-300 transform lg:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
          <div className="px-8 pt-6 pb-2">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-3 py-2 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] w-full cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0 group-hover:-translate-x-1 transition-transform" />
              Back Home
            </button>
          </div>
          <div className="px-8 pt-2 pb-6 shrink-0 relative flex flex-col items-center justify-center">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="absolute right-4 top-2 p-2 text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-[#D4AF37] rounded-lg flex items-center justify-center mb-3">
                <ReceiptText className="w-6 h-6 text-black" />
              </div>
              <h2 className="text-lg font-bold">BHS LPO'S</h2>
              <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase">Admin Panel</p>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto no-scrollbar">
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
          <div className={`${(pathname === '/LPOs/Orders' || pathname === '/LPOs/CreateOrders' || pathname.startsWith('/DataBase')) ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
