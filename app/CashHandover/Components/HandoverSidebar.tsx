import { useState } from 'react';
import { PlusCircle, Save, Menu, ChevronLeft, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HandoverSidebarProps {
  activeTab: 'new' | 'saved';
  setActiveTab: (tab: 'new' | 'saved') => void;
}

export default function HandoverSidebar({ activeTab, setActiveTab }: HandoverSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const router = useRouter();

  const tabs = [
    { id: 'new', label: 'New Handover', icon: PlusCircle },
    { id: 'saved', label: 'Saved Handovers', icon: Save },
  ] as const;

  return (
    <aside className={`bg-white border-r border-gray-100 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-full md:w-64'}`}>
      <div className="h-full flex flex-col gap-2 sticky top-0 py-4">
        <div className="px-4 flex justify-center mb-2">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 text-gray-400 hover:text-black hover:bg-gray-50 rounded-xl transition-all"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
        
        <div className="flex flex-col gap-2 px-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-3 rounded-2xl font-bold transition-all duration-200
                  ${isCollapsed ? 'justify-center p-3' : 'w-full px-4 py-3.5'}
                  ${isActive 
                    ? 'bg-black text-[#D4AF37] shadow-md shadow-black/10' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                title={isCollapsed ? tab.label : undefined}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                {!isCollapsed && <span className="truncate">{tab.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-auto px-4 pb-4">
          <button
            onClick={() => router.push('/')}
            className={`
              flex items-center justify-center p-3 rounded-2xl transition-all duration-200 w-full
              text-slate-400 hover:bg-slate-100 hover:text-slate-900
            `}
            title="Back to Home"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </div>
    </aside>
  );
}
