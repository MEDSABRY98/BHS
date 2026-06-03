'use client';

import { 
  PlusCircle,
  List,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  X
} from 'lucide-react';

interface CashReceiptSidebarProps {
  activeTab: 'new' | 'saved';
  onTabChange: (tab: 'new' | 'saved') => void;
  currentUser?: any;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export default function CashReceiptSidebar({ 
  activeTab, 
  onTabChange, 
  currentUser, 
  isCollapsed,
  onToggleCollapse,
  onCloseMobile
}: CashReceiptSidebarProps) {
  
  const allTabs = [
    { id: 'new', label: 'New Receipt', icon: PlusCircle },
    { id: 'saved', label: 'Saved Receipts', icon: List }
  ];

  // Filter tabs based on user permissions
  const getFilteredTabs = () => {
    if (!currentUser) return [];
    if (currentUser.name === 'MED Sabry') return allTabs;

    try {
      const perms = JSON.parse(currentUser.role || '{}');
      if (perms['cash-receipt'] && Array.isArray(perms['cash-receipt'])) {
        return allTabs.filter(tab => perms['cash-receipt'].includes(tab.id));
      }
    } catch (e) {
      // Default to all if permission role parsing fails
    }
    return allTabs;
  };

  const tabs = getFilteredTabs();

  return (
    <div className="flex flex-col h-full bg-[#0d0e10] text-white border-r border-amber-950/20">
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
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-amber-500 hover:text-amber-400 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
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
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-amber-950/50 transition-all duration-300">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Cash Receipt</h2>
              <p className="text-[10px] text-amber-400 font-bold tracking-[0.2em] uppercase">BHS Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id as 'new' | 'saved');
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-950/40 border-l-4 border-amber-400 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={isCollapsed ? tab.label : undefined}
            >
              <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-amber-300 animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Toggle Collapse Button */}
      <div className="p-4 border-t border-white/5 mt-auto flex justify-center shrink-0">
        <button 
          onClick={onToggleCollapse} 
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-amber-400"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
