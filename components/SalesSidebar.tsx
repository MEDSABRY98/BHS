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
    { id: 'sales-customers', label: 'Customers', icon: '👥' },
    { id: 'sales-products', label: 'Products', icon: '📦' },
  ];

  // Filter tabs based on user (can add restrictions later if needed)
  const tabs = allTabs;

  return (
    <div className="w-64 bg-gray-100 border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-center gap-2 mb-3">
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
            className={`w-full text-left p-4 mb-2 rounded-lg transition-colors flex items-center ${
              activeTab === tab.id
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="mr-3 text-xl">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {currentUser && (
          <div className="mb-4 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Current User</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="font-medium text-gray-700 truncate" title={currentUser.name}>
                {currentUser.name || 'User'}
              </div>
            </div>
          </div>
        )}
        
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center p-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors duration-200"
          title="Sign Out"
        >
          <span className="mr-2">🚪</span>
          <span className="font-medium">Log Out</span>
        </button>
      </div>
    </div>
  );
}

