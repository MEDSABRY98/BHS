'use client';

import { useState, useEffect } from 'react';
import {
  Archive,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Filter,
  History,
  Layers,
  RefreshCw,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useInventoryCountingFilters } from '../Model/InventoryCountingFiltersContext';

export type InventoryCountingTabId =
  | 'total_count'
  | 'reconciliation'
  | 'user_comparison'
  | 'record'
  | 'archives';

const INVENTORY_COUNTING_TABS: {
  id: InventoryCountingTabId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'total_count', label: 'Total Count', icon: Layers },
  { id: 'reconciliation', label: 'Count Reconciliation', icon: ClipboardCheck },
  { id: 'user_comparison', label: 'User Comparison', icon: Users },
  { id: 'record', label: 'Record', icon: History },
  { id: 'archives', label: 'Archives', icon: Archive },
];

export function isCountingTabAllowed(tabId: string): boolean {
  try {
    const savedUser = localStorage.getItem('currentUser');
    const currentUser = savedUser ? JSON.parse(savedUser) : null;
    if (currentUser?.name?.toLowerCase() === 'med sabry') return true;

    const perms = JSON.parse(currentUser?.role || '{}');
    const countingTabs = perms['inventory-counting'];
    if (Array.isArray(countingTabs)) {
      if (countingTabs.includes(tabId)) return true;
      if (
        tabId === 'record' &&
        (countingTabs.includes('normal_record') || countingTabs.includes('damage_record'))
      ) {
        return true;
      }
      if (tabId === 'reconciliation' && countingTabs.includes('inventory_count')) {
        return true;
      }
      if (
        tabId === 'total_count' &&
        (countingTabs.includes('count') ||
          countingTabs.includes('normal_total') ||
          countingTabs.includes('damage_total'))
      ) {
        return true;
      }
      return false;
    }

    const inventoryTabs = perms.inventory;
    if (Array.isArray(inventoryTabs)) {
      if (inventoryTabs.includes('counting')) return true;
      if (inventoryTabs.includes(tabId)) return true;
      if (
        tabId === 'record' &&
        (inventoryTabs.includes('normal_record') || inventoryTabs.includes('damage_record'))
      ) {
        return true;
      }
      if (tabId === 'reconciliation' && inventoryTabs.includes('inventory_count')) {
        return true;
      }
      if (
        tabId === 'total_count' &&
        (inventoryTabs.includes('count') ||
          inventoryTabs.includes('normal_total') ||
          inventoryTabs.includes('damage_total'))
      ) {
        return true;
      }
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

export function getAllowedCountingTabs() {
  return INVENTORY_COUNTING_TABS.filter((tab) => isCountingTabAllowed(tab.id));
}

export function getCountingTabLabel(tabId: InventoryCountingTabId): string {
  return INVENTORY_COUNTING_TABS.find((tab) => tab.id === tabId)?.label ?? 'Inventory Counting';
}

interface SidebarProps {
  activeTab: InventoryCountingTabId;
  onTabChange: (tab: InventoryCountingTabId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  onOpenFilters: () => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  onOpenFilters,
}: SidebarProps) {
  const [hoveredTab, setHoveredTab] = useState<{ label: string; top: number } | null>(null);

  const tabs = getAllowedCountingTabs();
  const { activeFilterCount, hasActiveFilters } = useInventoryCountingFilters();
  const [refreshingTabs, setRefreshingTabs] = useState<Record<string, boolean>>({});
  const isCurrentTabRefreshing = refreshingTabs[activeTab] || false;

  useEffect(() => {
    const handleStateChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.activeTab === 'string') {
        setRefreshingTabs((prev) => ({
          ...prev,
          [customEvent.detail.activeTab]: customEvent.detail.isRefreshing,
        }));
      }
    };
    window.addEventListener('inventory-counting-refresh-state', handleStateChange);
    return () => {
      window.removeEventListener('inventory-counting-refresh-state', handleStateChange);
    };
  }, []);

  const handleTriggerRefresh = () => {
    window.dispatchEvent(
      new CustomEvent('inventory-counting-trigger-refresh', {
        detail: { activeTab },
      })
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-white border-r border-blue-950/20">
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
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-blue-300 hover:text-blue-200 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
          
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
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-blue-950/50 transition-all duration-300">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Inventory Counting</h2>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onMouseEnter={(e) => {
                if (isCollapsed) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredTab({ label: tab.label, top: rect.top + (rect.height / 2) - 12 });
                }
              }}
              onMouseLeave={() => setHoveredTab(null)}
              type="button"
              onClick={() => {
                onTabChange(tab.id);
                onCloseMobile?.();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/40 border-l-4 border-blue-300 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              
            >
              <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-blue-200 animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 mt-auto flex flex-col items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            handleTriggerRefresh();
            onCloseMobile?.();
          }}
          disabled={isCurrentTabRefreshing}
          className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${
            isCurrentTabRefreshing
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
              : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10'
          } disabled:opacity-50`}
          title="Refresh Tab"
        >
          <RefreshCw className={`w-5 h-5 ${isCurrentTabRefreshing ? 'animate-spin' : ''}`} />
        </button>

        <button
          type="button"
          onClick={() => {
            onOpenFilters();
            onCloseMobile?.();
          }}
          className={`relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${
            hasActiveFilters
              ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-950/40'
              : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/10'
          }`}
          title="Filters"
        >
          <Filter className="w-5 h-5" />
          {hasActiveFilters && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center shadow">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400 group"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
        </button>
      </div>

      {/* Portal-like Tooltip for Collapsed Sidebar */}
      {hoveredTab && isCollapsed && (
        <div 
          className="fixed z-[100] flex items-center pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200"
          style={{ top: hoveredTab.top - 2, left: 70 }}
        >
          <div className="w-2 h-2 bg-white border-l border-b border-[#B8860B] rotate-45 -mr-1 z-10 relative"></div>
          <div className="bg-white border border-[#B8860B] text-slate-900 px-3 py-1.5 rounded-lg shadow-xl text-[13px] font-bold tracking-wide relative z-0 whitespace-nowrap">
            {hoveredTab.label}
          </div>
        </div>
      )}
    </div>
  );
}
