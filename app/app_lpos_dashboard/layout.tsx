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
  ChevronRight
} from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: any;
  label: string;
  isActive: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, isActive, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      replace
      onClick={onClick}
      className={`flex items-center px-6 py-4 transition-all duration-200 group ${isActive
        ? 'bg-gradient-to-r from-black/10 to-transparent border-l-4 border-[#D4AF37] text-white'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
    >
      <Icon className={`w-5 h-5 mr-4 transition-colors ${isActive ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
      <span className="font-medium text-sm tracking-wide">{label}</span>
      {isActive && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37]" />}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const storedUser = localStorage.getItem('app_lpos_user');
    const mainUser = localStorage.getItem('currentUser');
    
    if (!storedUser && !mainUser) {
      router.push('/app_lpos_login');
    } else {
      // Use LPO user if exists, otherwise main user
      const userData = storedUser ? JSON.parse(storedUser) : JSON.parse(mainUser || '{}');
      setUser(userData);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('app_lpos_user');
    router.push('/app_lpos_login');
  };

  if (!isMounted || !user) return null;

  const ALL_NAV_ITEMS = [
    { id: 'lpo-dashboard', href: '/app_lpos_dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'lpo-orders', href: '/app_lpos_dashboard/orders', icon: ShoppingCart, label: 'Orders' },
    { id: 'lpo-customers', href: '/app_lpos_dashboard/customers', icon: UserCircle, label: 'Customers' },
    { id: 'lpo-products', href: '/app_lpos_dashboard/products', icon: Package, label: 'Products' },
    { id: 'lpo-users', href: '/app_lpos_dashboard/users', icon: Users, label: 'User Management' },
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
      <aside className="hidden lg:flex flex-col w-72 bg-black text-white shadow-2xl fixed h-screen left-0 top-0 z-50">
        <div className="p-8 shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-[#D4AF37] rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-[#D4AF37]/20">
              <ReceiptText className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">BHS LPO'S</h2>
              <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              isActive={pathname === item.href || (item.href !== '/app_lpos_dashboard' && pathname.startsWith(item.href))}
            />
          ))}
        </nav>

        <div className="p-6 shrink-0 border-t border-white/5 bg-black/50 backdrop-blur-md">
          <div className="bg-white/5 rounded-2xl p-4 mb-6 flex items-center border border-white/5">
            <div className="w-10 h-10 bg-gradient-to-tr from-[#D4AF37] to-yellow-600 rounded-full flex items-center justify-center text-black font-black mr-3 shadow-lg shadow-[#D4AF37]/20">
              {user.NAME.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.NAME}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all duration-200 group"
          >
            <LogOut className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area - Shifted by Sidebar Width on Desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72 transition-all duration-300">
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
          <div className="p-8 shrink-0">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#D4AF37] rounded-lg flex items-center justify-center mr-3">
                  <ReceiptText className="w-5 h-5 text-black" />
                </div>
                <h2 className="text-lg font-bold">BHS LPO'S</h2>
              </div>
              <button onClick={() => setIsSidebarOpen(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
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
          <div className="p-6 shrink-0 border-t border-white/5">
            <div className="bg-white/5 rounded-2xl p-4 mb-4 flex items-center">
              <div className="w-8 h-8 bg-[#D4AF37] rounded-full flex items-center justify-center text-black font-black mr-3">
                {user.NAME.charAt(0)}
              </div>
              <p className="text-sm font-bold truncate">{user.NAME}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 bg-red-500/10 text-red-500 rounded-xl"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="text-sm font-bold">Sign Out</span>
            </button>
          </div>
        </aside>

        <main className="flex-1 p-4 md:p-8 lg:p-12">
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
