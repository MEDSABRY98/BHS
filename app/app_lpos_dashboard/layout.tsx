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
    { id: 'lpo-dashboard', href: '/app_lpos_dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'lpo-orders', href: '/app_lpos_dashboard/orders', icon: ShoppingCart, label: 'Orders' },
    { id: 'lpo-create-orders', href: '/app_lpos_dashboard/create-orders', icon: ReceiptText, label: 'Create Orders' },
    { id: 'lpo-customers', href: '/app_lpos_dashboard/customers', icon: UserCircle, label: 'Customers DB' },
    { id: 'lpo-products', href: '/app_lpos_dashboard/products', icon: Package, label: 'Products DB' },
    { id: 'lpo-users', href: '/app_lpos_dashboard/users', icon: Users, label: 'Users DB' },
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
        <div className="px-8 pt-6 pb-2 bg-black/50 backdrop-blur-md">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 py-2.5 text-red-500 hover:text-red-400 transition-all duration-200 group w-full"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Back Home</span>
          </button>
        </div>
        <div className="px-8 pt-2 pb-6 shrink-0 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-[#D4AF37]/20">
              <ReceiptText className="w-7 h-7 text-black" />
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
          <div className="px-8 pt-6 pb-2">
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-3 py-2 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] w-full"
            >
              <LogOut className="w-3.5 h-3.5" />
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
          <div className={`${(pathname === '/app_lpos_dashboard/orders' || pathname === '/app_lpos_dashboard/create-orders') ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
