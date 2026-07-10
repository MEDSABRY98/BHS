import { PlusCircle, Save } from 'lucide-react';

interface HandoverSidebarProps {
  activeTab: 'new' | 'saved';
  setActiveTab: (tab: 'new' | 'saved') => void;
}

export default function HandoverSidebar({ activeTab, setActiveTab }: HandoverSidebarProps) {
  const tabs = [
    { id: 'new', label: 'New Handover', icon: PlusCircle },
    { id: 'saved', label: 'Saved Handovers', icon: Save },
  ] as const;

  return (
    <aside className="w-full md:w-64 bg-white border-r border-gray-100 flex-shrink-0">
      <div className="h-full py-6 flex flex-col gap-2 px-4 sticky top-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-bold transition-all duration-200
                ${isActive 
                  ? 'bg-purple-50 text-purple-700 shadow-sm shadow-purple-100' 
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : 'text-gray-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
