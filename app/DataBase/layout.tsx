'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Package,
  UserCircle,
  LogOut,
  Menu,
  X,
  Database,
  ChevronRight,
  ChevronLeft
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

export default function DatabaseLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('dbSidebarCollapsed');
    if (stored === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const toggleSidebar = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('dbSidebarCollapsed', String(nextState));
  };

  useEffect(() => {
    setIsMounted(true);
    const mainUserStr = localStorage.getItem('currentUser');

    if (!mainUserStr) {
      router.push('/');
    } else {
      const userData = JSON.parse(mainUserStr);
      if (!userData.NAME && userData.name) {
        userData.NAME = userData.name;
      }
      setUser(userData);
    }
  }, [router]);

  const handleLogout = () => {
    router.push('/');
  };

  if (!isMounted || !user) return null;

  const NAV_ITEMS = [
    { id: 'db-dashboard', href: '/DataBase', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'db-customers', href: '/DataBase/customers', icon: UserCircle, label: 'Customers DB' },
    { id: 'db-products', href: '/DataBase/products', icon: Package, label: 'Products DB' },
    { id: 'db-users', href: '/DataBase/users', icon: Users, label: 'Users DB' },
  ];

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-black">
      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col ${isCollapsed ? 'w-20' : 'w-72'} bg-black text-white shadow-2xl fixed h-screen left-0 top-0 z-50 transition-all duration-300`}>
        <div className={`px-4 ${isCollapsed ? 'lg:px-4' : 'lg:px-8'} pt-6 pb-2 bg-black/50 backdrop-blur-md transition-all duration-300`}>
          <button
            onClick={handleLogout}
            className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-red-500 hover:text-red-400 transition-all duration-200 group w-full`}
          >
            <LogOut className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
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
              <Database className="w-7 h-7 text-black" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-300">
                <h2 className="text-xl font-bold tracking-tight">BHS DATABASE</h2>
                <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase">Control Panel</p>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar">
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || (item.href !== '/DataBase' && pathname.startsWith(item.href))}
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
            <aside className="relative flex flex-col w-72 max-w-xs bg-black text-white h-full z-10 animate-in slide-in-from-left duration-300">
              <div className="p-4 flex justify-between items-center border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#D4AF37] rounded-lg flex items-center justify-center">
                    <Database className="w-5 h-5 text-black" />
                  </div>
                  <span className="font-black text-sm uppercase tracking-wider text-[#D4AF37]">BHS Database</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white p-1">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-4 border-b border-white/10">
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 py-2 text-red-500 hover:text-red-400 transition-colors w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Back Home</span>
                </button>
              </div>

              <nav className="flex-1 mt-4 overflow-y-auto">
                {NAV_ITEMS.map((item) => (
                  <NavItem
                    key={item.href}
                    {...item}
                    isActive={pathname === item.href || (item.href !== '/DataBase' && pathname.startsWith(item.href))}
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
