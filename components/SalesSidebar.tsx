'use client';

import { ArrowLeft } from 'lucide-react';

interface SalesSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  currentUser?: any;
  lastUpdated?: string | null;
}

export default function SalesSidebar({ activeTab, onTabChange, onLogout, currentUser, lastUpdated }: SalesSidebarProps) {
  const allTabs = [
    { id: 'sales-overview', label: 'Overview', icon: '📊' },
    { id: 'sales-top10', label: 'TOP10', icon: '🏆' },
    { id: 'sales-customers', label: 'Customers', icon: '👥' },
    { id: 'sales-inactive-customers', label: 'Inactive Customers', icon: '⚠️' },
    { id: 'sales-statistics', label: 'Statistics', icon: '📈' },
    { id: 'sales-daily-sales', label: 'Daily Sales', icon: '📅' },
    { id: 'sales-products', label: 'Products', icon: '📦' },
    { id: 'sales-download-form', label: 'Download Form', icon: '📥' },
  ];

  // Filter tabs based on user (can add restrictions later if needed)
  const tabs = allTabs;

  return (
    <div className="w-64 bg-gray-100 border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col items-center justify-center gap-2 mb-3">
          <button
            onClick={() => window.location.href = '/'}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800 text-center">Sales Analysis</h1>
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
                ? 'bg-green-600 text-white shadow-md'
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

