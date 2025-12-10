'use client';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  currentUser?: any;
  lastUpdated?: string | null;
}

export default function Sidebar({ activeTab, onTabChange, onLogout, currentUser, lastUpdated }: SidebarProps) {
  const tabs = [
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'customers-by-months', label: 'Customers BY Months', icon: '📊' },
    { id: 'salesreps', label: 'Sales Reps', icon: '👔' },
    { id: 'years', label: 'Years', icon: '📅' },
    { id: 'months', label: 'Months', icon: '📆' },
    { id: 'ages', label: 'Ages', icon: '⏳' },
    { id: 'all-notes', label: 'All Notes', icon: '📝' },
  ];

  return (
    <div className="w-64 bg-gray-100 border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800 text-center">Debt Analysis</h1>
      </div>
      
      <nav className="p-4 flex-1 overflow-y-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full text-left p-4 mb-2 rounded-lg transition-colors flex items-center ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="mr-3 text-xl">{tab.icon}</span>
            <span className="font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {lastUpdated && (
          <div className="mb-4 px-3 py-2 bg-yellow-50 rounded-lg border border-yellow-200 shadow-sm text-center">
             <div className="text-xs text-yellow-700 uppercase font-bold mb-1">Data Last Updated</div>
             <div className="font-medium text-gray-800 text-sm">
               {lastUpdated}
             </div>
          </div>
        )}

        {currentUser && (
          <div className="mb-4 px-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Current User</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
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
