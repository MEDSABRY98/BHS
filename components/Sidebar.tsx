'use client';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, onTabChange, onLogout }: SidebarProps) {
  const tabs = [
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'salesreps', label: 'Sales Reps', icon: '👔' },
    { id: 'years', label: 'Years', icon: '📅' },
    { id: 'months', label: 'Months', icon: '📆' },
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
