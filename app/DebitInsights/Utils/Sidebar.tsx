'use client';

import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Loader2,
  RefreshCcw,
  X,
} from 'lucide-react';

interface DebitInsightsSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenFilters: () => void;
  filtersActive?: boolean;
  filtersPending?: boolean;
  onExportPdf?: () => void;
  isExportingPdf?: boolean;
  canExportPdf?: boolean;
  lastUpdated?: string | null;
}

export default function DebitInsightsSidebar({
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  onRefresh,
  isRefreshing,
  onOpenFilters,
  filtersActive = false,
  filtersPending = false,
  onExportPdf,
  isExportingPdf = false,
  canExportPdf = true,
  lastUpdated,
}: DebitInsightsSidebarProps) {
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
          onClick={() => {
            window.location.href = '/';
          }}
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-blue-400 hover:text-blue-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
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

      <div
        className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300 border-b border-white/5`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-indigo-950/50 transition-all duration-300">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Debit Insights</h2>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        <div
          className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/40 border-l-4 border-blue-400 font-bold`}
          title={isCollapsed ? 'Overview' : undefined}
        >
          <BarChart3 className={`w-5 h-5 shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && <span className="text-sm tracking-wide">Overview</span>}
          {!isCollapsed && <ChevronRight className="w-4 h-4 ml-auto text-blue-300" />}
        </div>

      </nav>

      {!isCollapsed && lastUpdated && (
        <div className="px-6 py-4 border-t border-white/5 bg-black/10 text-[11px] text-blue-400/80 font-medium text-center shrink-0">
          Updated: {lastUpdated}
        </div>
      )}

      <div className="p-4 border-t border-white/5 mt-auto flex flex-col gap-3 shrink-0">
        <div className={`flex ${isCollapsed ? 'flex-col' : 'flex-row'} items-center justify-center gap-3`}>
          <button
            type="button"
            onClick={() => {
              onOpenFilters();
              onCloseMobile?.();
            }}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400 group relative"
            title="Filters"
          >
            <Filter className="w-5 h-5 shrink-0 group-hover:text-white transition-colors" />
            {(filtersActive || filtersPending) && (
              <span
                className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                  filtersPending ? 'bg-amber-400' : 'bg-blue-400'
                }`}
              />
            )}
          </button>

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={!canExportPdf || isExportingPdf}
              className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-red-300 disabled:opacity-50 group"
              title="Export ZIP"
            >
              {isExportingPdf ? (
                <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
              ) : (
                <FileText className="w-5 h-5 shrink-0 group-hover:text-red-200 transition-colors" />
              )}
            </button>
          )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-blue-400 disabled:opacity-50 group"
              title="Refresh Data"
            >
              <RefreshCcw className={`w-5 h-5 shrink-0 group-hover:text-blue-300 transition-colors ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="w-full h-[1px] bg-white/5 my-1" />

        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-10 h-10 mx-auto hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400 group"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5 shrink-0" />
          ) : (
            <ChevronLeft className="w-5 h-5 shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
}
