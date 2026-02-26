'use client';

import { ArrowLeft } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  currentUser?: any;
  lastUpdated?: string | null;
  sidebarOpen?: boolean;
}

export default function Sidebar({ activeTab, onTabChange, onLogout, currentUser, lastUpdated, sidebarOpen = true }: SidebarProps) {
  const allTabs = [
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'customers-mins', label: 'Customers Credit', icon: '💳' },
    { id: 'all-transactions', label: 'All Transactions', icon: '📋' },
    { id: 'customers-open-matches', label: 'Open Transactions', icon: '🔗' },
    { id: 'payment-tracker', label: 'Payment Tracker', icon: '💰' },
    { id: 'salesreps', label: 'Sales Reps', icon: '👔' },
    { id: 'years', label: 'Years', icon: '📅' },
    { id: 'months', label: 'Months', icon: '📆' },
    { id: 'ages', label: 'Ages', icon: '⏳' },
    { id: 'all-notes', label: 'All Notes', icon: '📝' },
  ];

  // Filter tabs based on user
  let tabs = allTabs;

  // Check for dynamic JSON permission structure
  try {
    const userName = currentUser?.name?.toLowerCase() || '';
    const perms = JSON.parse(currentUser?.role || '{}');
    // If role contains specific debit_tabs, filter by them
    // Otherwise, and for MED Sabry, show all tabs
    if (perms.debit_tabs && userName !== 'med sabry') {
      tabs = allTabs.filter(tab => perms.debit_tabs.includes(tab.id));
    }
  } catch (e) {
    // If not JSON or error, show all tabs (Full Access by default)
  }

  return (
    <div className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-gray-100 border-r border-gray-200 h-screen transition-all duration-300 overflow-hidden flex flex-col`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col items-center justify-center gap-2 mb-3">
          <button
            onClick={() => window.location.href = '/'}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800 text-center">Debit Analysis</h1>
        </div>
        {lastUpdated && (
          <div className="mt-3 text-center">
            <div className="text-sm font-medium text-gray-700">
              {lastUpdated}
            </div>
          </div>
        )}
      </div>

      <nav className="p-4 flex-1 overflow-y-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full text-left p-4 mb-2 rounded-lg transition-colors flex items-center ${activeTab === tab.id
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
              }`}
          >
            <span className="mr-3 text-xl">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
