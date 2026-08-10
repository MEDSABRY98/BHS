'use client';

import React from 'react';
import {
  ArrowLeft,
  BarChart3,
  Calculator,
  Calendar,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  currentView: 'grid' | 'add' | 'details' | 'months' | 'stats' | 'values';
  setCurrentView: (view: 'grid' | 'add' | 'details' | 'months' | 'stats' | 'values') => void;
  setSelectedCustomer: (val: null) => void;
}

const TABS = [
  { id: 'grid' as const, label: 'Customers List', icon: Users, match: (v: string) => v === 'grid' || v === 'details' },
  { id: 'months' as const, label: 'Monthly Overview', icon: Calendar, match: (v: string) => v === 'months' },
  { id: 'stats' as const, label: 'Statistics', icon: BarChart3, match: (v: string) => v === 'stats' },
  { id: 'values' as const, label: 'Values', icon: Calculator, match: (v: string) => v === 'values' },
  { id: 'add' as const, label: 'Add New Config', icon: PlusCircle, match: (v: string) => v === 'add' },
];

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  currentView,
  setCurrentView,
  setSelectedCustomer,
}: SidebarProps) {
  const isCollapsed = !isSidebarOpen;

  return (
    <div
      className={`flex flex-col h-full shrink-0 bg-[#0a0f1d] text-white border-r border-amber-950/20 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <a
          href="/"
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-[#D4AF37] hover:text-amber-300 transition-all duration-200 group w-full cursor-pointer bg-white/5 rounded-xl border border-white/10`}
          title={isCollapsed ? 'Back to Home' : undefined}
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
            <ShieldCheck className="w-6 h-6 text-black" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-white">Discounts</h2>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.match(currentView);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCurrentView(tab.id);
                setSelectedCustomer(null);
              }}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-gradient-to-r from-amber-600 to-[#D4AF37] text-white shadow-lg shadow-amber-950/40 border-l-4 border-[#D4AF37] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title={isCollapsed ? tab.label : undefined}
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

      <div className="p-4 border-t border-white/5 mt-auto flex flex-col gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="flex items-center justify-center w-10 h-10 mx-auto hover:bg-white/10 rounded-xl transition-all duration-200 text-slate-400 group"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 shrink-0" /> : <ChevronLeft className="w-5 h-5 shrink-0" />}
        </button>
      </div>
    </div>
  );
}
