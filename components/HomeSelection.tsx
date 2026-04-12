'use client';

import { DollarSign, TrendingUp, ArrowRight, FileText, Package, Clock, Receipt, Wallet, FileSpreadsheet, LogOut, Layers, Truck, Users, LayoutGrid, Shield, ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import AdminControlTab from './AdminControlTab';

interface HomeSelectionProps {
  currentUser?: any;
  onLogout: () => void;
}

interface SystemCardProps {
  title: string;
  icon: any;
  onClick: () => void;
  color: 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'pink' | 'indigo' | 'orange' | 'teal' | 'cyan' | 'emerald' | 'sky' | 'violet';
  delay?: number;
}

const SystemCard = ({ title, icon: Icon, onClick, color, delay = 0 }: SystemCardProps) => {
  const colorStyles = {
    blue: {
      base: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100 shadow-blue-100',
      gradient: 'from-transparent to-blue-100/50'
    },
    green: {
      base: 'bg-green-50 text-green-600 group-hover:bg-green-100 shadow-green-100',
      gradient: 'from-transparent to-green-100/50'
    },
    red: {
      base: 'bg-red-50 text-red-600 group-hover:bg-red-100 shadow-red-100',
      gradient: 'from-transparent to-red-100/50'
    },
    yellow: {
      base: 'bg-amber-50 text-amber-600 group-hover:bg-amber-100 shadow-amber-100',
      gradient: 'from-transparent to-amber-100/50'
    },
    purple: {
      base: 'bg-purple-50 text-purple-600 group-hover:bg-purple-100 shadow-purple-100',
      gradient: 'from-transparent to-purple-100/50'
    },
    pink: {
      base: 'bg-pink-50 text-pink-600 group-hover:bg-pink-100 shadow-pink-100',
      gradient: 'from-transparent to-pink-100/50'
    },
    indigo: {
      base: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 shadow-indigo-100',
      gradient: 'from-transparent to-indigo-100/50'
    },
    orange: {
      base: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100 shadow-orange-100',
      gradient: 'from-transparent to-orange-100/50'
    },
    teal: {
      base: 'bg-teal-50 text-teal-600 group-hover:bg-teal-100 shadow-teal-100',
      gradient: 'from-transparent to-teal-100/50'
    },
    cyan: {
      base: 'bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100 shadow-cyan-100',
      gradient: 'from-transparent to-cyan-100/50'
    },
    emerald: {
      base: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 shadow-emerald-100',
      gradient: 'from-transparent to-emerald-100/50'
    },
    sky: {
      base: 'bg-sky-50 text-sky-600 group-hover:bg-sky-100 shadow-sky-100',
      gradient: 'from-transparent to-sky-100/50'
    },
    violet: {
      base: 'bg-violet-50 text-violet-600 group-hover:bg-violet-100 shadow-violet-100',
      gradient: 'from-transparent to-violet-100/50'
    },
  };

  const styles = colorStyles[color] || colorStyles.blue;

  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full text-left
        bg-white rounded-2xl p-3 sm:p-4 h-[110px] sm:h-[140px]
        border border-slate-200
        transition-all duration-300 ease-out
        hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 hover:border-transparent
        overflow-hidden
        animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Background Decor */}
      <div className={`
        absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500
        bg-gradient-to-br ${styles.gradient} pointer-events-none
      `} />

      <div className="flex flex-col h-full justify-between relative z-10">
        <div className="flex justify-between items-start">
          <div className={`
            w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center
            transition-all duration-300 group-hover:scale-110 group-hover:rotate-3
            ${styles.base}
          `}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
          </div>

          <div className={`
            w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
            opacity-100 sm:opacity-0 sm:-translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0
            transition-all duration-300 delay-75
            bg-slate-50 text-slate-400
          `}>
            <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300 sm:text-slate-400 group-hover:text-slate-500" />
          </div>
        </div>

        <div>
          <h3 className="text-[13px] leading-tight sm:text-lg font-bold text-slate-800 tracking-tight group-hover:text-slate-900 transition-colors line-clamp-2">
            {title}
          </h3>
        </div>
      </div>
    </button>
  );
};

export default function HomeSelection({ currentUser, onLogout }: HomeSelectionProps) {
  const [activeView, setActiveView] = useState<'selection' | 'admin'>('selection');

  // Navigation Handlers
  const nav = (path: string) => () => window.location.href = path;

  const isSystemAllowed = (systemId: string) => {
    const userName = currentUser?.name?.toLowerCase() || '';
    if (userName === 'med sabry') return true;

    try {
      const roleStr = currentUser?.role || '';
      if (!roleStr) return true; // Default to true if no role

      const perms = JSON.parse(roleStr);
      // If the user has dynamic permissions set (JSON role), follow them
      if (perms.systems) {
        return perms.systems.includes(systemId);
      }
    } catch (e) {
      // Not JSON or error, full access by default as requested
    }
    return true;
  };

  const ALL_SYSTEMS = [
    { id: 'cash-receipt', title: "Cash Receipt", icon: Receipt, path: '/cash-receipt', color: 'teal' as const },
    { id: 'petty-cash', title: "Petty Cash", icon: Wallet, path: '/petty-cash', color: 'cyan' as const },
    { id: 'documents-tracking', title: "Documents Tracking", icon: FileSpreadsheet, path: '/documents-tracking', color: 'orange' as const },
    { id: 'debit', title: "Debit Analysis", icon: DollarSign, path: '/debit', color: 'red' as const },
    { id: 'visit-customers', title: "Visit Customers", icon: Users, path: '/visit-customers', color: 'pink' as const },
    { id: 'sales', title: "Sales Analysis", icon: LayoutGrid, path: '/sales', color: 'green' as const },
    { id: 'delivery-tracking', title: "Delivery Tracking", icon: Truck, path: '/delivery-tracking', color: 'blue' as const },
    { id: 'inventory', title: "Inventory", icon: Package, path: '/inventory', color: 'indigo' as const },
    { id: 'wh20-items', title: "WH/20 ITEMS", icon: Package, path: '/wh20-items', color: 'emerald' as const },
    { id: 'employee', title: "Employee", icon: Clock, path: '/employee', color: 'blue' as const },
    { id: 'water-delivery-note', title: "Water - Delivery Note", icon: FileText, path: '/water-delivery-note', color: 'violet' as const },
    { id: 'suppliers', title: "Suppliers", icon: Truck, path: '/suppliers', color: 'emerald' as const },
  ];

  const allowedSystems = ALL_SYSTEMS
    .filter(sys => isSystemAllowed(sys.id))
    .sort((a, b) => a.title.localeCompare(b.title));

  if (activeView === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveView('selection')}
              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
              title="Back to Dashboard"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <h1 className="text-xl font-bold text-slate-900">Admin Control</h1>
          </div>
        </div>
        <AdminControlTab />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 relative selection:bg-blue-100 selection:text-blue-900 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start pt-6 sm:pt-10 pb-10">
      {/* Abstract Background Shapes */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-100/40 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-teal-100/30 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] w-full px-6 flex flex-col items-center">

        {/* Header Section */}
        <div className="text-center mb-4 sm:mb-6 animate-in fade-in zoom-in-95 duration-700 w-full relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-6 sm:mb-8">
            BHS <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Analysis</span>
          </h1>

          {/* User Profile - Positioned between header and grid */}
          {currentUser && (
            <div className="flex items-center justify-center gap-3 animate-in fade-in slide-in-from-top-4 delay-300 fill-mode-backwards mb-6 sm:mb-8 translate-y-2">
              <div className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-white rounded-full shadow-md shadow-slate-200/50 border border-slate-100">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-slate-800 leading-none">{currentUser.name || 'User'}</p>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="group p-2 bg-white text-slate-400 rounded-full hover:bg-red-50 hover:text-red-600 transition-all duration-300 shadow-sm hover:shadow-md hover:shadow-red-100 border border-slate-100 hover:border-red-100"
                title="Log Out"
              >
                <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          )}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 w-full max-w-[1400px]">

          {/* ADMIN CARD - ONLY FOR MED SABRY - ALWAYS FIRST */}
          {currentUser?.name === 'MED Sabry' && (
            <SystemCard
              title="Admin Control"
              icon={Shield}
              onClick={() => setActiveView('admin')}
              color="indigo"
              delay={100}
            />
          )}

          {/* DYNAMIC SYSTEMS - SORTED ALPHABETICALLY */}
          {allowedSystems.map((sys, index) => (
            <SystemCard
              key={sys.id}
              title={sys.title}
              icon={sys.icon}
              onClick={nav(sys.path)}
              color={sys.color}
              delay={150 + (index * 25)}
            />
          ))}

        </div>

        {/* Footer info - Absolute bottom or reduced */}


      </div>
    </div>
  );
}
