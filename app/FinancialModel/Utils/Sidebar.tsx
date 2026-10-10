import React, { useState, useEffect } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, X, LayoutDashboard, LineChart, FileSpreadsheet, PencilLine, RefreshCw, Filter, Target } from 'lucide-react';
import { useFinancialModel } from '../Context/FinancialModelContext';

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
  const { selectedYear, setSelectedYear, startMonth, setStartMonth, endMonth, setEndMonth } = useFinancialModel();
  const [localYear, setLocalYear] = useState(selectedYear);
  const [localStartMonth, setLocalStartMonth] = useState(startMonth);
  const [localEndMonth, setLocalEndMonth] = useState(endMonth);

  useEffect(() => {
    if (isFilterModalOpen) {
      setLocalYear(selectedYear);
      setLocalStartMonth(startMonth);
      setLocalEndMonth(endMonth);
    }
  }, [isFilterModalOpen, selectedYear, startMonth, endMonth]);

  const handleApplyFilters = () => {
    setSelectedYear(localYear);
    setStartMonth(localStartMonth);
    setEndMonth(localEndMonth);
    setIsFilterModalOpen(false);
  };

  const handleClearFilters = () => {
    const currentYear = new Date().getFullYear();
    setLocalYear(currentYear);
    setLocalStartMonth(1);
    setLocalEndMonth(12);
    setSelectedYear(currentYear);
    setStartMonth(1);
    setEndMonth(12);
    setIsFilterModalOpen(false);
  };

  const tabs = [
    { id: 'dashboard', label: 'P&L Dashboard', icon: LineChart },
    { id: 'income_statement', label: 'P&L Statement', icon: FileSpreadsheet },
    { id: 'break_even', label: 'Break-Even Point', icon: Target },
    { id: 'data_entry', label: 'P&L Data Entry', icon: PencilLine },
    { id: 'cf_statement', label: 'Cash Flow Statement', icon: FileSpreadsheet },
    { id: 'cf_data_entry', label: 'Cash Flow Data Entry', icon: PencilLine },
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

      <div className={`p-3 mt-auto shrink-0 border-t border-white/5 flex ${isCollapsed ? 'flex-col gap-3' : 'gap-2'}`}>
                  <button
                    onClick={onToggleCollapse}
                    className="flex-1 hidden lg:flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                  >
                    {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setIsFilterModalOpen(true)}
                    className="flex-1 flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    title="Global Date Filters"
                  >
                    <Filter className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      window.dispatchEvent(new Event('refresh-financial-model'));
                      import('@/app/Components/Notification').then(({ toast }) => {
                        toast.success('Module refreshed successfully');
                      });
                    }}
                    className="flex-1 flex items-center justify-center p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                    title="Refresh Module"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#D4AF37]" />
                Global Date Filter
              </h3>
              <button onClick={() => setIsFilterModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Year</label>
                <input 
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="YYYY"
                  value={localYear || ''} 
                  onChange={(e) => setLocalYear(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">From Month</label>
                  <input 
                    type="number"
                    min={1}
                    max={12}
                    placeholder="MM"
                    value={localStartMonth || ''} 
                    onChange={(e) => setLocalStartMonth(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">To Month</label>
                  <input 
                    type="number"
                    min={1}
                    max={12}
                    placeholder="MM"
                    value={localEndMonth || ''} 
                    onChange={(e) => setLocalEndMonth(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#D4AF37] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-center gap-3">
              <button 
                onClick={handleClearFilters}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
              >
                Clear Filters
              </button>
              <button 
                onClick={handleApplyFilters}
                className="px-6 py-2 bg-[#D4AF37] hover:bg-[#B8942E] text-black font-bold rounded-xl transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
