'use client';
import { useState } from 'react';
import React, { useMemo } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LineChart,
  TrendingUp,
  Users,
} from 'lucide-react';
import { getAllowedModuleTabIds } from '@/app/AdminControl/AdminControlTab/AdminControlTab';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  FilterNode?: React.ReactNode;
  currentUser?: any;
}

export const PURCHASE_PRICE_TAB_IDS = [
  'product-history',
  'supplier-comparison',
  'supplier-history',
  'reports',
] as const;

const TABS = [
  { id: 'product-history', label: 'Product History', icon: LineChart },
  { id: 'supplier-comparison', label: 'Supplier Comparison', icon: Users },
  { id: 'supplier-history', label: 'Supplier History', icon: Building2 },
  { id: 'reports', label: 'Excel Reports', icon: FileSpreadsheet },
];

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  onTabChange,
  FilterNode,
  currentUser,
}: SidebarProps) {
  const [hoveredTab, setHoveredTab] = useState<{ label: string; top: number } | null>(null);

  const isCollapsed = !isSidebarOpen;
  const tabs = useMemo(() => {
    const allowed = new Set(getAllowedModuleTabIds(currentUser, 'purchase-price-tracking', PURCHASE_PRICE_TAB_IDS));
    return TABS.filter((tab) => allowed.has(tab.id));
  }, [currentUser]);

  return (
    <div
      className={`flex flex-col h-full shrink-0 bg-[#0a0f1d] text-white border-r border-amber-950/20 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <a
          href="/"
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-[#D4AF37] hover:text-amber-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
          
        >
          <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && (
            <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
              Back Home
            </span>
          )}
        </a>
      </div>

      <div
        className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300 border-b border-white/5`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-amber-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-amber-950/50 transition-all duration-300">
            <TrendingUp className="w-6 h-6 text-black" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Purchase Price</h2>
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
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white shadow-lg shadow-amber-950/40 border-l-4 border-[#D4AF37] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              
            >
              <Icon
                className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${
                  isActive ? 'text-white' : 'group-hover:text-white'
                }`}
              />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-amber-200 animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5 mt-auto flex flex-col gap-2 shrink-0 items-center justify-center">
        <div className={`flex gap-2 ${isCollapsed ? 'flex-col' : 'flex-row items-center'}`}>
          {FilterNode}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
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
