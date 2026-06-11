'use client';

import React from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  BarChart3, 
  FileText, 
  Wallet, 
  History, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  ArrowLeft 
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'receipts' | 'expenses' | 'stats' | 'voucher' | 'history';
  setActiveTab: (tab: 'receipts' | 'expenses' | 'stats' | 'voucher' | 'history') => void;
  currentUser: any;
  balance: number;
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export const tabs = [
  { id: 'receipts' as const, name: 'Receipts', icon: TrendingUp },
  { id: 'expenses' as const, name: 'Expenses', icon: TrendingDown },
  { id: 'voucher' as const, name: 'Voucher', icon: FileText },
  { id: 'stats' as const, name: 'Statistics', icon: BarChart3 },
  { id: 'history' as const, name: 'History', icon: History }
];

export default function Sidebar({
  activeTab,
  setActiveTab,
  currentUser,
  balance,
  showBalance,
  setShowBalance,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile
}: SidebarProps) {
  
  // Filter tabs based on user permissions
  const getFilteredTabs = () => {
    if (!currentUser) return [];
    if (currentUser.name === 'MED Sabry') return tabs;

    try {
      const perms = JSON.parse(currentUser.role || '{}');
      if (perms['petty-cash'] && Array.isArray(perms['petty-cash'])) {
        return tabs.filter(tab => perms['petty-cash'].includes(tab.id));
      }
    } catch (e) {
      // Default to all
    }
    return tabs;
  };

  const filteredTabs = getFilteredTabs();

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-white border-r border-slate-800 no-print">
      {/* Header Close button for Mobile */}
      {onCloseMobile && (
        <button 
          onClick={onCloseMobile}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white lg:hidden"
          title="Close Sidebar"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Back to Home Button */}
      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <button
          onClick={() => window.location.href = '/'}
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-cyan-500 hover:text-cyan-400 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
          title={isCollapsed ? "Back to Home" : undefined}
        >
          <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && (
            <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
              Back Home
            </span>
          )}
        </button>
      </div>

      {/* Brand Logo and Title */}
      <div className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300 border-b border-white/5`}>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-cyan-950/50 transition-all duration-300">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Petty Cash</h2>
              <p className="text-[10px] text-cyan-400 font-bold tracking-[0.2em] uppercase">BHS Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        {filteredTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg shadow-cyan-950/40 border-l-4 border-cyan-400 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={isCollapsed ? tab.name : undefined}
            >
              <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.name}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-cyan-300 animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Balance Widget (Only when Expanded) */}
      {!isCollapsed && (
        <div className="p-4 mx-4 mb-4 bg-white/5 border border-white/10 rounded-2xl animate-in fade-in duration-300">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] text-slate-400 font-bold tracking-[0.1em] uppercase">Balance</span>
            </div>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="text-slate-400 hover:text-white transition-colors p-1"
              title={showBalance ? "Hide Balance" : "Show Balance"}
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-slate-400 hover:text-white" />}
            </button>
          </div>
          <div className="text-xl font-black text-white select-none tracking-tight">
            {showBalance ? `${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED` : '•••••• AED'}
          </div>
          <span className="text-[9px] text-slate-500 font-medium">UAE Dirham</span>
        </div>
      )}

      {/* Toggle Collapse Button */}
      <div className="p-4 border-t border-white/5 shrink-0 flex justify-center">
        <button 
          onClick={onToggleCollapse} 
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-cyan-400"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
