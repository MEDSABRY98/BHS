'use client';
import { useState, useMemo } from 'react';

import {
  Users,
  Layers,
  FileText,
  Activity,
  FileSpreadsheet,
  CreditCard,
  UserCheck,
  History,
  Hourglass,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Wallet,
  X,
  RefreshCcw,
  ShieldAlert,
  ClipboardCheck,
  FolderOpen,
  Filter,
  PieChart,
} from 'lucide-react';
import { useDebitData } from '../Context/DebitDataContext';
import FilterModal from '../Modals/FilterModal';
import { useGlobalDebitFilter } from '../Hooks/useGlobalDebitFilter';

interface DebitSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: any;
  lastUpdated?: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const allTabs = [
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'customers-summaries', label: 'Customers Summaries', icon: FileSpreadsheet },
  { id: 'debit-insights', label: 'Debit Insights', icon: PieChart },
  { id: 'credit-limit', label: 'Customer Terms', icon: ShieldAlert },
  { id: 'customers-group', label: 'Customers Group', icon: Layers },
  { id: 'payment-reconciliation', label: 'Payment Reconciliation', icon: ClipboardCheck },
  { id: 'payment-reconciliation-saved', label: 'Saved Reconciliations', icon: FolderOpen },
  { id: 'all-transactions', label: 'All Transactions', icon: FileText },
  { id: 'customers-open-matches', label: 'Open Transactions', icon: Activity },
  { id: 'payment-tracker', label: 'Payment Tracker', icon: CreditCard },
  { id: 'salesreps', label: 'Sales Reps', icon: UserCheck },
  { id: 'history', label: 'History', icon: History },
  { id: 'ages', label: 'Ages', icon: Hourglass },
];

export function isDebitTabAllowed(tabId: string, allowedTabs?: string[]): boolean {
  if (!allowedTabs) return true;
  return allowedTabs.includes(tabId);
}

export default function DebitSidebar({
  activeTab,
  onTabChange,
  currentUser,
  lastUpdated,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  onRefresh,
  isRefreshing,
}: DebitSidebarProps) {
  const [hoveredTab, setHoveredTab] = useState<{ label: string; top: number } | null>(null);

  const getFilteredTabs = () => {
    if (!currentUser) return [];
    if (currentUser.name === 'MED Sabry') return allTabs;

    try {
      const perms = JSON.parse(currentUser.role || '{}');
      const allowedTabs = perms.debit || perms.debit_tabs;
      if (allowedTabs && Array.isArray(allowedTabs)) {
        return allTabs.filter((tab) => isDebitTabAllowed(tab.id, allowedTabs));
      }
    } catch {
      // Default to all if permission role parsing fails
    }
    return allTabs;
  };

  const tabs = getFilteredTabs();
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const { data, globalFilters, setGlobalFilters, invoicesByCustomer, customersWithEmails, luluEmails } = useDebitData();

  const globallyFilteredData = useGlobalDebitFilter(
    data, globalFilters, invoicesByCustomer, customersWithEmails, luluEmails
  );

  const filteredDataCount = useMemo(() => {
    const customers = new Set<string>();
    globallyFilteredData.forEach(r => customers.add(r.customerName));
    return customers.size;
  }, [globallyFilteredData]);

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-white border-r border-indigo-950/20">
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
            <Wallet className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Debit Analysis</h2>
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
                onTabChange(tab.id);
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

      {!isCollapsed && lastUpdated && (
        <div className="px-6 py-4 border-t border-white/5 bg-black/10 text-[11px] text-blue-400/80 font-medium text-center shrink-0">
          Updated: {lastUpdated}
        </div>
      )}

      <div className={`p-4 border-t border-white/5 mt-auto flex ${isCollapsed ? 'flex-col items-center mx-auto' : 'flex-row justify-center'} gap-2 shrink-0`}>
        <button
          onClick={() => setIsFilterModalOpen(true)}
          title="Advanced Filters"
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-purple-400 group relative border border-purple-500/30 bg-purple-500/5 shrink-0"
        >
          <Filter className="w-5 h-5 shrink-0 group-hover:scale-110 transition-transform" />
          {/* Active filter indicator */}
          {(globalFilters.customerRating !== 'ALL' || globalFilters.selectedSalesRep !== 'ALL' || globalFilters.emailFilter !== 'ALL' || globalFilters.overdueMonth.length > 0 || globalFilters.overdueYear.length > 0 || globalFilters.selectedCustomerTags.length > 0) && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2 border-[#0a0f1d]"></span>
          )}
        </button>

        {onRefresh && (
          <button
            onClick={onRefresh}
            title="Refresh Data"
            disabled={isRefreshing}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-blue-400 disabled:opacity-50 group border border-white/5 shrink-0"
          >
            <RefreshCcw className={`w-5 h-5 shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
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
        filters={globalFilters}
        setFilters={setGlobalFilters}
        filteredDataCount={filteredDataCount}
        data={data}
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
    </div>
  );
}
