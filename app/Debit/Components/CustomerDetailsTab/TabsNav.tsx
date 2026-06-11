import React from 'react';

type TabType = 'dashboard' | 'invoices' | 'ages' | 'notes' | 'overdue' | 'monthly';

interface TabsNavProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  notesCount: number;
}

export default function TabsNav({ activeTab, setActiveTab, notesCount }: TabsNavProps) {
  const tabs: { key: TabType; label: React.ReactNode; activeColor: string }[] = [
    { key: 'dashboard', label: '📊 Dashboard', activeColor: 'text-purple-700 border-purple-600 bg-purple-50' },
    { key: 'invoices', label: 'Invoices', activeColor: 'text-blue-700 border-blue-600 bg-blue-50' },
    { key: 'overdue', label: 'Overdue', activeColor: 'text-blue-700 border-blue-600 bg-blue-50' },
    { key: 'ages', label: 'Ages', activeColor: 'text-blue-700 border-blue-600 bg-blue-50' },
    { key: 'monthly', label: 'Monthly', activeColor: 'text-blue-700 border-blue-600 bg-blue-50' },
    { key: 'notes', label: <>Notes <span className="text-red-600">({notesCount})</span></>, activeColor: 'text-blue-700 border-blue-600 bg-blue-50' },
  ];

  return (
    <div className="mb-4 flex w-full border-b border-gray-200 bg-white shadow-sm rounded-t-xl overflow-hidden">
      {tabs.map(({ key, label, activeColor }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key)}
          className={`flex-1 py-4 font-semibold transition-all duration-200 border-b-4 text-center ${
            activeTab === key
              ? activeColor
              : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
