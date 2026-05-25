import React from 'react';
import { TrendingDown, TrendingUp, BarChart3, FileText, Wallet, History, Eye, EyeOff } from 'lucide-react';

interface SidebarProps {
  sidebarOpen: boolean;
  activeTab: 'receipts' | 'expenses' | 'stats' | 'voucher' | 'history';
  setActiveTab: (tab: 'receipts' | 'expenses' | 'stats' | 'voucher' | 'history') => void;
  currentUser: any;
  balance: number;
  showBalance: boolean;
  setShowBalance: (show: boolean) => void;
}

export const tabs = [
  { id: 'receipts' as const, name: 'Receipts', icon: TrendingUp },
  { id: 'expenses' as const, name: 'Expenses', icon: TrendingDown },
  { id: 'voucher' as const, name: 'Voucher', icon: FileText },
  { id: 'stats' as const, name: 'Statistics', icon: BarChart3 },
  { id: 'history' as const, name: 'History', icon: History }
];

export default function Sidebar({
  sidebarOpen,
  activeTab,
  setActiveTab,
  currentUser,
  balance,
  showBalance,
  setShowBalance
}: SidebarProps) {
  return (
    <div className={`${sidebarOpen ? 'w-72' : 'w-0'} bg-white text-gray-900 transition-all duration-300 overflow-hidden shadow-2xl border-r border-gray-200 no-print`}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-10 pb-6 border-b border-gray-200">
          <div className="bg-cyan-100 text-cyan-600 p-2 rounded-lg">
            <Wallet className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Petty Cash</h1>
          </div>
        </div>

        <nav className="space-y-2 mb-8">
          {tabs.filter(tab => {
            try {
              const perms = JSON.parse(currentUser?.role || '{}');
              if (perms['petty-cash'] && currentUser?.name !== 'MED Sabry') {
                return perms['petty-cash'].includes(tab.id);
              }
            } catch (e) { }
            return true;
          }).map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all duration-200 ${activeTab === tab.id
                  ? 'bg-cyan-100 text-cyan-700 shadow-lg transform scale-105'
                  : 'hover:bg-gray-100 hover:transform hover:translate-x-1 text-gray-700'
                  }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-semibold">{tab.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="bg-gradient-to-br from-gray-50 to-white p-5 rounded-xl border-2 border-gray-200">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <div className="text-xs text-gray-600 font-semibold">Current Balance</div>
            </div>
            <button
              type="button"
              onClick={() => setShowBalance(!showBalance)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded"
              title={showBalance ? "Hide Balance" : "Show Balance"}
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-3xl font-bold mb-1 text-gray-900 select-none">
            {showBalance ? `${balance.toFixed(2)} AED` : '•••••• AED'}
          </div>
          <div className="text-sm text-gray-600">UAE Dirham</div>
        </div>
      </div>
    </div>
  );
}
