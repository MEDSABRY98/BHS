'use client';

import { 
  BarChart3, 
  Award, 
  Users, 
  Scale, 
  AlertTriangle, 
  LineChart, 
  Calendar, 
  Tag, 
  Package, 
  FileText,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  X,
  Sparkles
} from 'lucide-react';

interface SalesSidebarProps {
  refreshTrigger?: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: any;
  lastUpdated?: string | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
}

export default function SalesSidebar({ 
  activeTab, 
  onTabChange, 
  currentUser, 
  lastUpdated,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile
}: SalesSidebarProps) {
  
  const allTabs = [
    { id: 'sales-overview', label: 'Overview', icon: BarChart3 },
    { id: 'sales-top10', label: 'Top 10', icon: Award },
    { id: 'sales-customers', label: 'Customers', icon: Users },
    { id: 'sales-customers-comparison', label: 'Comparison', icon: Scale },
    { id: 'sales-inactive-customers', label: 'Inactive Customers', icon: AlertTriangle },
    { id: 'sales-statistics', label: 'Statistics', icon: LineChart },
    { id: 'sales-daily-sales', label: 'Daily Sales', icon: Calendar },
    { id: 'sales-categories', label: 'Product Category', icon: Tag },
    { id: 'sales-products', label: 'Products', icon: Package },
    { id: 'sales-new-listings', label: 'New Listings', icon: Sparkles },
    { id: 'sales-download-form', label: 'Stock Report', icon: FileText },
    { id: 'sales-my-customers', label: 'Set Customers', icon: User },
  ];

  // Filter tabs based on user permissions
  const getFilteredTabs = () => {
    if (!currentUser) return [];

    const isManager = currentUser.name === 'MED Sabry' || currentUser.isSalesManager === true || currentUser.isSalesManager === 'TRUE';
    let allowedTabs = allTabs;
    if (!isManager) {
      allowedTabs = allTabs.filter(tab => tab.id !== 'sales-my-customers');
    }

    if (isManager) return allowedTabs;

    try {
      const perms = JSON.parse(currentUser.role || '{}');
      if (perms.sales && Array.isArray(perms.sales)) {
        return allowedTabs.filter(tab => perms.sales.includes(tab.id));
      }
    } catch (e) {
      // Default to allowedTabs if permission role parsing fails
    }
    return allowedTabs;
  };

  const tabs = getFilteredTabs();

  return (
    <div className="flex flex-col h-full bg-[#0d1e16] text-white border-r border-emerald-950/20">
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
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-emerald-400 hover:text-emerald-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
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
          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-green-950/50 transition-all duration-300">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Sales Analysis</h2>
              <p className="text-[10px] text-emerald-400 font-bold tracking-[0.2em] uppercase">BHS Panel</p>
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
                onTabChange(tab.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-950/40 border-l-4 border-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={isCollapsed ? tab.label : undefined}
            >
              <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-white' : 'group-hover:text-white'}`} />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-emerald-300 animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Last Updated */}
      {!isCollapsed && lastUpdated && (
        <div className="px-6 py-4 border-t border-white/5 bg-black/10 text-[11px] text-emerald-400/80 font-medium text-center shrink-0">
          Updated: {lastUpdated}
        </div>
      )}

      {/* Toggle Collapse Button */}
      <div className="p-4 border-t border-white/5 mt-auto flex justify-center shrink-0">
        <button 
          onClick={onToggleCollapse} 
          className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-emerald-400"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

