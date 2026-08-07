'use client';

import {
  ArrowLeft,
  ArrowLeftRight,
  Box,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Grid3x3,
  Layers,
  Package,
  X,
} from 'lucide-react';

export type InventoryTabId =
  | 'products_balance'
  | 'location_movements'
  | 'category_balance'
  | 'categories'
  | 'reports';

interface InventorySidebarProps {
  activeTab: InventoryTabId;
  onTabChange: (tab: InventoryTabId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

const TABS: { id: InventoryTabId; label: string; icon: typeof Package }[] = [
  { id: 'products_balance', label: 'Products Balance', icon: Package },
  { id: 'location_movements', label: 'Location Movements In/Out', icon: ArrowLeftRight },
  { id: 'category_balance', label: 'Categories Balance', icon: Grid3x3 },
  { id: 'categories', label: 'Categories Analysis', icon: Layers },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
];

export default function InventorySidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
}: InventorySidebarProps) {
  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-white border-r border-indigo-950/20">
      {onCloseMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white lg:hidden"
          title="Close Sidebar"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <button
          type="button"
          onClick={() => { window.location.href = '/'; }}
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-indigo-300 hover:text-indigo-200 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
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
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-950/50 transition-all duration-300">
            <Box className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Inventory Analysis</h2>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                onTabChange(tab.id);
                onCloseMobile?.();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-950/40 border-l-4 border-indigo-300 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={isCollapsed ? tab.label : undefined}
            >
              <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-indigo-200 animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 mt-auto flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-10 h-10 mx-auto hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400 group"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
        </button>
      </div>
    </div>
  );
}
