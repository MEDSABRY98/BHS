'use client';

import {
  DollarSign,
  TrendingUp,
  ArrowRight,
  FileText,
  Package,
  Receipt,
  Wallet,
  FileSpreadsheet,
  LogOut,
  LayoutGrid,
  Truck,
  Database,
  Trash2,
  ClipboardList,
  ShieldCheck,
  Hash,
  Shield,
  ShoppingCart,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import './HomeSelection.css';

interface HomeSelectionProps {
  currentUser?: any;
  onLogout: () => void;
}

type CardColor =
  | 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'pink'
  | 'indigo' | 'orange' | 'teal' | 'cyan' | 'emerald' | 'sky' | 'violet';

interface SystemItem {
  id: string;
  title: string;
  icon: LucideIcon;
  path: string;
  color: CardColor;
}

interface SystemCardProps {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
  color: CardColor;
  delay?: number;
  admin?: boolean;
}

const COLOR_MAP: Record<CardColor, { stripe: string; icon: string; glow: string }> = {
  blue:    { stripe: 'bg-blue-500',    icon: 'from-blue-500 to-blue-600',    glow: 'group-hover:shadow-blue-200/60' },
  green:   { stripe: 'bg-emerald-500', icon: 'from-emerald-500 to-green-600', glow: 'group-hover:shadow-emerald-200/60' },
  red:     { stripe: 'bg-red-500',     icon: 'from-red-500 to-rose-600',     glow: 'group-hover:shadow-red-200/60' },
  yellow:  { stripe: 'bg-amber-500',   icon: 'from-amber-400 to-yellow-500', glow: 'group-hover:shadow-amber-200/60' },
  purple:  { stripe: 'bg-purple-500',  icon: 'from-purple-500 to-violet-600', glow: 'group-hover:shadow-purple-200/60' },
  pink:    { stripe: 'bg-pink-500',    icon: 'from-pink-500 to-rose-500',    glow: 'group-hover:shadow-pink-200/60' },
  indigo:  { stripe: 'bg-indigo-500',  icon: 'from-indigo-500 to-blue-600', glow: 'group-hover:shadow-indigo-200/60' },
  orange:  { stripe: 'bg-orange-500',  icon: 'from-orange-500 to-amber-500', glow: 'group-hover:shadow-orange-200/60' },
  teal:    { stripe: 'bg-teal-500',    icon: 'from-teal-500 to-cyan-600',    glow: 'group-hover:shadow-teal-200/60' },
  cyan:    { stripe: 'bg-cyan-500',    icon: 'from-cyan-500 to-sky-500',     glow: 'group-hover:shadow-cyan-200/60' },
  emerald: { stripe: 'bg-emerald-500', icon: 'from-emerald-500 to-teal-600', glow: 'group-hover:shadow-emerald-200/60' },
  sky:     { stripe: 'bg-sky-500',     icon: 'from-sky-500 to-blue-500',     glow: 'group-hover:shadow-sky-200/60' },
  violet:  { stripe: 'bg-violet-500',  icon: 'from-violet-500 to-purple-600', glow: 'group-hover:shadow-violet-200/60' },
};

function SystemCard({ title, icon: Icon, onClick, color, delay = 0, admin = false }: SystemCardProps) {
  const styles = COLOR_MAP[color] ?? COLOR_MAP.blue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group relative w-full text-left overflow-hidden rounded-2xl
        home-card p-4 sm:p-5 min-h-[120px] sm:min-h-[132px]
        animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards
        ${admin ? 'home-card-admin' : ''}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${admin ? 'bg-[#d4af37]' : styles.stripe} opacity-80`} />

      <div className="flex flex-col h-full justify-between pl-3 relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className={`
            w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white shadow-lg
            bg-gradient-to-br transition-transform duration-300 group-hover:scale-105
            ${admin ? 'from-[#d4af37] to-[#a8861e]' : styles.icon} ${styles.glow}
          `}>
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          </div>

          <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#b8941f]" />
          </div>
        </div>

        <h3 className="text-[13px] sm:text-[15px] font-bold text-slate-800 leading-snug tracking-tight group-hover:text-slate-900 line-clamp-2 mt-3">
          {title}
        </h3>
      </div>
    </button>
  );
}

export default function HomeSelection({ currentUser, onLogout }: HomeSelectionProps) {
  const [search, setSearch] = useState('');

  const nav = (path: string) => () => { window.location.href = path; };

  const isSystemAllowed = (systemId: string) => {
    const userName = currentUser?.name?.toLowerCase() || '';
    if (userName === 'med sabry') return true;

    try {
      const roleStr = currentUser?.role || '';
      if (!roleStr) return true;

      const perms = JSON.parse(roleStr);
      if (perms.systems) return perms.systems.includes(systemId);
    } catch {
      // full access by default
    }
    return true;
  };

  const ALL_SYSTEMS: SystemItem[] = [
    { id: 'cash-receipt', title: 'Cash Receipt', icon: Receipt, path: '/CashReceipt', color: 'teal' },
    { id: 'cash-handover', title: 'Cash Handover', icon: ClipboardList, path: '/CashHandover', color: 'purple' },
    { id: 'petty-cash', title: 'Petty Cash', icon: Wallet, path: '/PettyCash', color: 'cyan' },
    { id: 'documents-tracking', title: 'Documents Tracking', icon: FileSpreadsheet, path: '/DocumentsTracking', color: 'orange' },
    { id: 'customers-summaries', title: 'Customers Summaries', icon: FileSpreadsheet, path: '/CustomersSummaries', color: 'sky' },
    { id: 'debit', title: 'Debit Analysis', icon: DollarSign, path: '/Debit', color: 'red' },
    { id: 'customers-documents', title: 'Customers Documents', icon: FileText, path: '/CustomersDocuments', color: 'indigo' },
    { id: 'inventory', title: 'Inventory Analysis', icon: Package, path: '/InventoryAnalysis', color: 'indigo' },
    { id: 'inventory-item-code', title: 'Inventory Item Code', icon: Hash, path: '/InventoryItemCode', color: 'blue' },
    { id: 'inventory-counting', title: 'Inventory Counting', icon: ClipboardList, path: '/InventoryCounting', color: 'blue' },
    { id: 'inventory-scrap', title: 'Inventory Scrap', icon: Trash2, path: '/InventoryScrap', color: 'orange' },
    { id: 'suppliers', title: 'Suppliers', icon: Truck, path: '/Suppliers', color: 'emerald' },
    { id: 'purchase-price-tracking', title: 'Purchase Price Tracking', icon: TrendingUp, path: '/PurchasePriceTracking', color: 'yellow' },
    { id: 'sales', title: 'Sales Analysis', icon: LayoutGrid, path: '/Sales', color: 'green' },
    { id: 'lpo-management', title: "LPO's", icon: ShoppingCart, path: '/LPOs', color: 'yellow' },
    { id: 'database', title: 'Database', icon: Database, path: '/DataBase', color: 'sky' },
    { id: 'customers-discounts', title: 'Customers Discounts', icon: ShieldCheck, path: '/CustomersDiscounts', color: 'yellow' },
  ];

  const allowedSystems = useMemo(
    () => ALL_SYSTEMS.filter(sys => isSystemAllowed(sys.id)).sort((a, b) => a.title.localeCompare(b.title)),
    [currentUser]
  );

  const filteredSystems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allowedSystems;
    return allowedSystems.filter(sys => sys.title.toLowerCase().includes(q));
  }, [allowedSystems, search]);

  const showAdmin = currentUser?.name === 'MED Sabry';
  const adminMatches = !search.trim() || 'admin control'.includes(search.trim().toLowerCase());

  return (
    <div className="home-scene min-h-screen relative overflow-x-hidden" dir="ltr">
      <div className="home-aurora" />
      <div className="home-grid" />

      <div className="relative z-10 max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Header */}
        <header className="home-enter pt-6 sm:pt-8 pb-6">
          <div className="home-header rounded-2xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative w-11 h-11 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
                <span className="text-sm font-black bg-gradient-to-br from-[#f5e6a8] via-[#d4af37] to-[#a8861e] bg-clip-text text-transparent">
                  BHS
                </span>
                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
                  <Sparkles className="w-2 h-2 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none">
                  BHS Analysis
                </h1>
              </div>
            </div>

            {currentUser && (
              <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4af37] to-[#a8861e] text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="text-sm font-semibold text-slate-800 max-w-[140px] sm:max-w-none truncate">
                    {currentUser.name || 'User'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="group p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all border border-slate-100 hover:border-red-100"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Search */}
        <div className="home-enter mb-6 sm:mb-8" style={{ animationDelay: '80ms' }}>
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules..."
              className="home-search w-full h-12 pl-11 pr-4 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400"
            />
          </div>
          <p className="text-xs text-slate-400 font-medium mt-3 ml-1">
            {filteredSystems.length + (showAdmin && adminMatches ? 1 : 0)} modules available
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {showAdmin && adminMatches && (
            <SystemCard
              title="Admin Control"
              icon={Shield}
              onClick={nav('/AdminControl')}
              color="indigo"
              delay={50}
              admin
            />
          )}

          {filteredSystems.map((sys, index) => (
            <SystemCard
              key={sys.id}
              title={sys.title}
              icon={sys.icon}
              onClick={nav(sys.path)}
              color={sys.color}
              delay={80 + index * 30}
            />
          ))}
        </div>

        {filteredSystems.length === 0 && !(showAdmin && adminMatches) && (
          <div className="text-center py-20">
            <p className="text-slate-500 font-medium">No modules match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
