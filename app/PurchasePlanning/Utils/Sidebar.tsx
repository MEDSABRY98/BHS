import React, { useState } from 'react';
import { PackageSearch, ArrowLeft, ChevronLeft, ChevronRight, X, LayoutDashboard, Filter } from 'lucide-react';
import FilterModal from '../Modals/FilterModal';
import { usePurchaseData } from '../Context/PurchaseDataContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export function Sidebar({ activeTab, setActiveTab, isCollapsed, onToggleCollapse, onCloseMobile }: SidebarProps) {
  const [hoveredTab, setHoveredTab] = useState<{ label: string; top: number } | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const { globalFilters } = usePurchaseData();

  const tabs = [
    { id: 'planning', label: 'Purchase Planning', icon: PackageSearch },
  ];

  return (
    <aside
      className={`fixed lg:sticky top-0 h-[100dvh]
      bg-[#0a0f1d] border-r border-indigo-950/20 shadow-2xl flex flex-col 
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
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-blue-400 hover:text-blue-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
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
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-950/50 transition-all duration-300">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Purchase Planner</h2>
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
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/40 border-l-4 border-blue-400 font-bold'
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
                <ChevronRight className="w-4 h-4 ml-auto text-blue-300 animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      <div className={`p-4 border-t border-white/5 mt-auto flex ${isCollapsed ? 'flex-col items-center mx-auto' : 'flex-row justify-center'} gap-2 shrink-0`}>
        <button
          onClick={() => setIsFilterModalOpen(true)}
          title="Advanced Filters"
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-purple-400 group relative border border-purple-500/30 bg-purple-500/5 shrink-0"
        >
          <Filter className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
          {globalFilters.categories.length > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-[#0a0f1d]"></span>
          )}
        </button>

        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400 group border border-white/5 shrink-0"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
        </button>
      </div>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
      />

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
    </aside>
  );
}
