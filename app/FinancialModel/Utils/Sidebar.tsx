import React, { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, X, LayoutDashboard, LineChart, FileSpreadsheet, PencilLine } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export function Sidebar({ activeTab, setActiveTab, isCollapsed, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const [hoveredTab, setHoveredTab] = useState<{ label: string; top: number } | null>(null);

  const tabs = [
    { id: 'dashboard', label: 'P&L Dashboard', icon: LineChart },
    { id: 'income_statement', label: 'P&L', icon: FileSpreadsheet },
    { id: 'data_entry', label: 'P&L Data', icon: PencilLine },
  ];

  return (
    <aside
      className={`fixed lg:sticky top-0 h-[100dvh]
      bg-[#0f0f0f] border-r border-[#D4AF37]/20 shadow-2xl flex flex-col 
      transition-all duration-300 z-40 shrink-0
      ${isCollapsed ? 'w-20' : 'w-[280px]'}`}
    >
      {onCloseMobile && (
        <button
          onClick={onCloseMobile}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white lg:hidden"
          title="Close Sidebar"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-[#D4AF37] hover:text-[#FFF2B2] transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
        >
          <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && (
            <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
              Back Home
            </span>
          )}
        </button>
      </div>

      <div
        className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300 border-b border-white/5`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-zinc-800 to-black rounded-2xl flex items-center justify-center mb-3 shadow-lg border border-[#D4AF37]/30 transition-all duration-300">
            <LayoutDashboard className="w-6 h-6 text-[#D4AF37]" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Financial Model</h2>
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
              onClick={() => {
                setActiveTab(tab.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8942E] text-black shadow-lg shadow-black/40 border-l-4 border-black font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${
                  isActive ? 'text-black' : 'group-hover:text-white'
                }`}
              />
              {!isCollapsed && (
                <span className="text-sm font-semibold truncate transition-all duration-300">
                  {tab.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {isCollapsed && hoveredTab && (
        <div 
          className="fixed left-[85px] z-50 bg-gray-900 text-white text-xs font-bold py-1.5 px-3 rounded-md shadow-xl whitespace-nowrap pointer-events-none"
          style={{ top: hoveredTab.top }}
        >
          {hoveredTab.label}
          <div className="absolute left-[-4px] top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900" />
        </div>
      )}

      <div className="p-3 mt-auto shrink-0 border-t border-white/5">
        <button
          onClick={onToggleCollapse}
          className="w-full hidden lg:flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
