import React from 'react';
import { ArrowLeft, DollarSign, Search, LucideIcon } from 'lucide-react';

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface HeaderProps {
  activeTab: 'new' | 'saved';
  setActiveTab: (tab: 'new' | 'saved') => void;
  availableTabs: TabItem[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleBack: () => void;
  setSelectedReceipt: (receipt: any) => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  availableTabs,
  searchQuery,
  setSearchQuery,
  handleBack,
  setSelectedReceipt,
}: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-30 no-print">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex items-center gap-4 h-16">
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all group flex-shrink-0"
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          {/* Logo & Title */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="p-1.5 bg-black rounded-lg">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-black tracking-tight text-gray-900 whitespace-nowrap">Cash Receipt</h1>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

          {/* Tab Buttons */}
          <nav className="flex items-center gap-1">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as 'new' | 'saved');
                  setSelectedReceipt(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab.id
                    ? 'bg-black text-white shadow-md'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Search (shows only on saved tab) */}
          {activeTab === 'saved' && (
            <div className="relative ml-auto w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search receipts..."
                className="w-full pl-9 pr-4 py-2 bg-gray-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-black transition-all outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
