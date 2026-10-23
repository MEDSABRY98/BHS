'use client';

import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, X, RefreshCcw, UserRound, ShoppingCart, Wallet, CreditCard, FileDown, Loader2, Filter, Gauge } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';
import { toast } from '@/app/Components/Notification';

export const SALESPERSON_TABS = [
  { id: 'sales', label: 'Sales', icon: ShoppingCart },
  { id: 'debit', label: 'Debit', icon: Wallet },
  { id: 'collections', label: 'Collections', icon: CreditCard },
  { id: 'quality', label: 'Collection Quality', icon: Gauge },
] as const;

export type SalespersonTabId = (typeof SALESPERSON_TABS)[number]['id'];

interface SidebarProps {
  activeTab: SalespersonTabId;
  onTabChange: (tab: SalespersonTabId) => void;
  allowedTabs: SalespersonTabId[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  /** opens the Filters popup (salesperson + period) */
  onOpenFilters: () => void;
}

export default function SalespersonSidebar({
  activeTab,
  onTabChange,
  allowedTabs,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  onOpenFilters,
}: SidebarProps) {
  const [hoveredTab, setHoveredTab] = useState<{ label: string; top: number } | null>(null);
  const { refresh, isRefreshing, selectedId, data, agingMode } = UseSalespersonData();
  const [isExporting, setIsExporting] = useState(false);

  // PDF report of the selected salesperson (Pdf/ExportReport.ts)
  const handleExport = async () => {
    if (isExporting || !data) return;
    setIsExporting(true);
    try {
      const { ExportSalespersonReport } = await import('../Pdf/ExportReport');
      await ExportSalespersonReport(data, agingMode);
    } catch (err) {
      console.error('Salesperson report failed:', err);
      toast.error('Could not create the PDF report');
    } finally {
      setIsExporting(false);
    }
  };
  const navItems = SALESPERSON_TABS.filter((t) => allowedTabs.includes(t.id));

  return (
    <div className="flex flex-col h-full bg-white text-slate-800 border-r border-slate-200">
      {onCloseMobile && (
        <button onClick={onCloseMobile} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-800 lg:hidden" title="Close Sidebar">
          <X className="w-6 h-6" />
        </button>
      )}

      {/* Back Home */}
      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-[#B8860B] hover:text-[#D4AF37] transition-all duration-200 group w-full cursor-pointer bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100`}
        >
          <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap">Back Home</span>}
        </button>
      </div>

      {/* App icon */}
      <div className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center border-b border-slate-100`}>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-[#D4AF37] to-[#B8860B] rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-[#D4AF37]/30">
            <UserRound className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && <h2 className="text-lg font-bold tracking-tight text-slate-900 animate-in fade-in duration-300">Salesperson Analysis</h2>}
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
                  setHoveredTab({ label: tab.label, top: rect.top + rect.height / 2 - 12 });
                }
              }}
              onMouseLeave={() => setHoveredTab(null)}
              onClick={() => {
                onTabChange(tab.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-lg shadow-[#D4AF37]/30 font-bold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-slate-800'}`} />
              {!isCollapsed && <span className="text-sm tracking-wide whitespace-nowrap">{tab.label}</span>}
              {!isCollapsed && isActive && <ChevronRight className="w-4 h-4 ml-auto text-white" />}
            </button>
          );
        })}
      </nav>

      {/* Footer controls */}
      <div className={`p-4 border-t border-slate-100 mt-auto flex ${isCollapsed ? 'flex-col items-center' : 'flex-row justify-center'} gap-2 shrink-0`}>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-10 h-10 hover:bg-slate-100 rounded-xl text-slate-500 border border-slate-200 shrink-0"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
        <button
          onClick={() => {
            onOpenFilters();
            if (onCloseMobile) onCloseMobile();
          }}
          title="Filters (salesperson and period)"
          className={`flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 ${
            selectedId ? 'hover:bg-slate-100 text-slate-500 border-slate-200' : 'bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white border-transparent shadow-lg shadow-[#D4AF37]/30'
          }`}
        >
          <Filter className="w-5 h-5" />
        </button>
        <button
          onClick={() => void refresh()}
          disabled={isRefreshing || !selectedId}
          title={isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          className="flex items-center justify-center w-10 h-10 hover:bg-slate-100 rounded-xl text-slate-500 border border-slate-200 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
        >
          <RefreshCcw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-[#D4AF37]' : ''}`} />
        </button>
        <button
          onClick={handleExport}
          disabled={isExporting || !data}
          title={data ? 'Export PDF Report' : 'Pick a salesperson first'}
          className="flex items-center justify-center w-10 h-10 hover:bg-slate-100 rounded-xl text-slate-500 border border-slate-200 disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
        >
          {isExporting ? <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" /> : <FileDown className="w-5 h-5" />}
        </button>
      </div>

      {hoveredTab && isCollapsed && (
        <div className="fixed z-[100] flex items-center pointer-events-none animate-in fade-in slide-in-from-left-2 duration-200" style={{ top: hoveredTab.top - 2, left: 70 }}>
          <div className="w-2 h-2 bg-white border-l border-b border-[#B8860B] rotate-45 -mr-1 z-10 relative" />
          <div className="bg-white border border-[#B8860B] text-slate-900 px-3 py-1.5 rounded-lg shadow-xl text-[13px] font-bold tracking-wide whitespace-nowrap">
            {hoveredTab.label}
          </div>
        </div>
      )}
    </div>
  );
}
