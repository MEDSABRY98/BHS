'use client';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = [
    { id: 'customers', label: 'Customers', icon: '👥' },
    { id: 'salesreps', label: 'Sales Reps', icon: '👔' },
    { id: 'years', label: 'Years', icon: '📅' },
    { id: 'months', label: 'Months', icon: '📆' },
  ];

  return (
    <div className="w-64 bg-gray-100 border-r border-gray-200 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800 text-center">Debt Analysis</h1>
      </div>
      <nav className="p-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`w-full text-left p-4 mb-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

