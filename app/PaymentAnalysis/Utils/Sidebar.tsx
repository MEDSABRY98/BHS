'use client';

import { useState } from 'react';
import { 
  Users, 
  FileText, 
  CalendarDays, 
  LayoutDashboard,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCcw,
  Wallet,
  Filter,
  MapPin
} from 'lucide-react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import GlobalFiltersModal from './GlobalFiltersModal';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const navItems = [
  { id: 'dashboard', label: 'Collections Overview', icon: LayoutDashboard },
  { id: 'cities', label: 'Cities Collections', icon: MapPin },
  { id: 'collections', label: 'Customer Collections', icon: Users },
  { id: 'periods', label: 'Periods Analysis', icon: CalendarDays },
];

export default function PaymentSidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  onRefresh,
  isRefreshing
}: SidebarProps) {
  const [hoveredTab, setHoveredTab] = useState<{ label: string; top: number } | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const { dateRange, setDateRange } = usePaymentAnalysis();

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 border-r border-slate-200">
      {onCloseMobile && (
        <button
          onClick={onCloseMobile}
          className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-800 lg:hidden"
          title="Close Sidebar"
        >
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Back Home Button */}
      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-[#B8860B] hover:text-[#D4AF37] transition-all duration-200 group w-full cursor-pointer bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100`}
        >
          <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && (
            <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
              Back Home
            </span>
          )}
        </button>
      </div>

      {/* App Icon area */}
      <div
        className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300 border-b border-slate-100`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-[#D4AF37]/30 transition-all duration-300">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">Payments Analysis</h2>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        {navItems.map((tab) => {
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
                onTabChange(tab.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-lg shadow-[#D4AF37]/30 border-l-4 border-[#D4AF37] font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${
                  isActive ? 'text-white' : 'group-hover:text-slate-800'
                }`}
              />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-white animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className={`p-4 border-t border-slate-100 mt-auto flex ${isCollapsed ? 'flex-col items-center mx-auto' : 'flex-row justify-center'} gap-2 shrink-0`}>
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh Data"
            disabled={isRefreshing}
            className="flex items-center justify-center w-10 h-10 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-500 disabled:opacity-50 group border border-slate-200 shrink-0"
          >
            <RefreshCcw className={`w-5 h-5 shrink-0 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
          </button>
        )}
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className={`flex items-center justify-center w-10 h-10 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-500 group border border-slate-200 shrink-0 ${dateRange.start || dateRange.end ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''}`}
          title="Global Filters"
        >
          <Filter className="w-5 h-5 shrink-0" />
        </button>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-10 h-10 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-500 group border border-slate-200 shrink-0"
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

      {/* Global Filter Modal */}
      {isFilterModalOpen && (
        <GlobalFiltersModal onClose={() => setIsFilterModalOpen(false)} />
      )}
    </div>
  );
}
