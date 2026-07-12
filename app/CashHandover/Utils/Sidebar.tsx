import { useState } from 'react';
import { PlusCircle, Save, ArrowLeft, ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HandoverSidebarProps {
  activeTab: 'new' | 'saved';
  setActiveTab: (tab: 'new' | 'saved') => void;
}

export default function HandoverSidebar({ activeTab, setActiveTab }: HandoverSidebarProps) {
  // Set default collapsed to true
  const [isCollapsed, setIsCollapsed] = useState(true);
  const router = useRouter();

  const tabs = [
    { id: 'new', label: 'New Handover', icon: PlusCircle },
    { id: 'saved', label: 'Saved Handovers', icon: Save },
  ] as const;

  return (
    <aside className={`bg-white flex flex-col h-full border-r border-gray-200 flex-shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-full md:w-64'}`}>
      
      {/* Back to Home Button */}
      <div className={`px-4 ${isCollapsed ? 'px-2' : 'px-6'} pt-6 pb-2 shrink-0 transition-all duration-300`}>
        <button
          onClick={() => router.push('/')}
          className={`flex items-center justify-center ${isCollapsed ? 'gap-0' : 'gap-3'} py-2.5 text-gray-500 hover:text-black hover:bg-gray-100 transition-all duration-200 group w-full cursor-pointer bg-white rounded-xl border border-gray-200 shadow-sm`}
          title={isCollapsed ? "Back to Home" : undefined}
        >
          <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!isCollapsed && (
            <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
              Back Home
            </span>
          )}
        </button>
      </div>

      {/* Brand Logo and Title */}
      <div className={`px-4 ${isCollapsed ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300 border-b border-gray-100`}>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-black/10 transition-all duration-300">
            <ClipboardList className="w-6 h-6 text-[#D4AF37]" />
          </div>
          {!isCollapsed && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold tracking-tight text-gray-900">Cash Handover</h2>
              <p className="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase">BHS Panel</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar px-3 space-y-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10 border-l-4 border-[#D4AF37] font-bold'
                  : 'text-gray-500 hover:text-black hover:bg-gray-50'
              }`}
              title={isCollapsed ? tab.label : undefined}
            >
              <Icon className={`w-5 h-5 transition-colors shrink-0 ${isCollapsed ? '' : 'mr-3'} ${isActive ? 'text-[#D4AF37]' : 'group-hover:text-black'}`} />
              {!isCollapsed && (
                <span className="text-sm tracking-wide whitespace-nowrap overflow-hidden text-left">{tab.label}</span>
              )}
              {!isCollapsed && isActive && (
                <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37] animate-in fade-in duration-200" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Toggle Collapse Button */}
      <div className="p-4 border-t border-gray-100 mt-auto flex justify-center shrink-0">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          className="flex items-center justify-center w-10 h-10 hover:bg-gray-100 rounded-xl transition-all duration-200 text-gray-500 hover:text-black"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
