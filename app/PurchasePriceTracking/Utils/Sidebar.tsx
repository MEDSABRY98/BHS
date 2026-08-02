import React from 'react';
import { TrendingUp, ArrowLeft, ChevronRight, ChevronLeft, LineChart, Users, Building2, FileSpreadsheet } from 'lucide-react';

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  FilterNode?: React.ReactNode;
}

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  onTabChange,
  FilterNode,
}: SidebarProps) {
  return (
    <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-black text-white flex flex-col shrink-0 shadow-2xl z-20 h-screen sticky top-0`}>
      
      {/* Top Header - Back Button */}
      <div className={`px-4 ${isSidebarOpen ? 'px-6' : ''} pt-6 pb-2 bg-black/50 backdrop-blur-md transition-all duration-300`}>
        <a
          href="/"
          className={`flex items-center justify-center ${!isSidebarOpen ? 'gap-0' : 'gap-3'} py-2.5 text-red-500 hover:text-red-400 transition-all duration-200 group w-full cursor-pointer`}
          title="Back Home"
        >
          <ArrowLeft className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
          {isSidebarOpen && (
            <span className="text-xs font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-hidden transition-all duration-300">
              Back Home
            </span>
          )}
        </a>
      </div>

      {/* Logo & Title */}
      <div className={`px-4 ${!isSidebarOpen ? 'py-4' : 'pt-2 pb-6'} shrink-0 flex flex-col items-center justify-center transition-all duration-300`}>
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-[#D4AF37] rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-[#D4AF37]/20 transition-all duration-300">
            <TrendingUp className="w-7 h-7 text-black" />
          </div>
          {isSidebarOpen && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-xl font-bold tracking-tight">PURCHASE PRICE</h2>
              <p className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase">Tracking Hub</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 mt-4 overflow-y-auto no-scrollbar flex flex-col">
        <button
          onClick={() => onTabChange("product-history")}
          className={`flex items-center ${!isSidebarOpen ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group ${
            activeTab === "product-history"
              ? 'bg-gradient-to-r from-white/10 to-transparent border-l-4 border-[#D4AF37] text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
          }`}
          title={!isSidebarOpen ? "Product Price History" : undefined}
        >
          <LineChart className={`w-5 h-5 transition-colors ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === "product-history" ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
          {isSidebarOpen && (
            <span className="font-medium text-sm tracking-wide whitespace-nowrap animate-in fade-in duration-200">Product History</span>
          )}
          {isSidebarOpen && activeTab === "product-history" && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37] animate-in fade-in duration-200" />}
        </button>

        <button
          onClick={() => onTabChange("supplier-comparison")}
          className={`flex items-center ${!isSidebarOpen ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group ${
            activeTab === "supplier-comparison"
              ? 'bg-gradient-to-r from-white/10 to-transparent border-l-4 border-[#D4AF37] text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
          }`}
          title={!isSidebarOpen ? "Supplier Comparison" : undefined}
        >
          <Users className={`w-5 h-5 transition-colors ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === "supplier-comparison" ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
          {isSidebarOpen && (
            <span className="font-medium text-sm tracking-wide whitespace-nowrap animate-in fade-in duration-200">Supplier Comparison</span>
          )}
          {isSidebarOpen && activeTab === "supplier-comparison" && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37] animate-in fade-in duration-200" />}
        </button>

        <button
          onClick={() => onTabChange("supplier-history")}
          className={`flex items-center ${!isSidebarOpen ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group ${
            activeTab === "supplier-history"
              ? 'bg-gradient-to-r from-white/10 to-transparent border-l-4 border-[#D4AF37] text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
          }`}
          title={!isSidebarOpen ? "Supplier History" : undefined}
        >
          <Building2 className={`w-5 h-5 transition-colors ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === "supplier-history" ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
          {isSidebarOpen && (
            <span className="font-medium text-sm tracking-wide whitespace-nowrap animate-in fade-in duration-200">Supplier History</span>
          )}
          {isSidebarOpen && activeTab === "supplier-history" && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37] animate-in fade-in duration-200" />}
        </button>

        <button
          onClick={() => onTabChange("reports")}
          className={`flex items-center ${!isSidebarOpen ? 'justify-center px-4' : 'px-6'} py-4 transition-all duration-200 group ${
            activeTab === "reports"
              ? 'bg-gradient-to-r from-white/10 to-transparent border-l-4 border-[#D4AF37] text-white'
              : 'text-gray-400 hover:text-white hover:bg-white/5 border-l-4 border-transparent'
          }`}
          title={!isSidebarOpen ? "Excel Reports" : undefined}
        >
          <FileSpreadsheet className={`w-5 h-5 transition-colors ${isSidebarOpen ? 'mr-4' : ''} ${activeTab === "reports" ? 'text-[#D4AF37]' : 'group-hover:text-white'}`} />
          {isSidebarOpen && (
            <span className="font-medium text-sm tracking-wide whitespace-nowrap animate-in fade-in duration-200">Excel Reports</span>
          )}
          {isSidebarOpen && activeTab === "reports" && <ChevronRight className="w-4 h-4 ml-auto text-[#D4AF37] animate-in fade-in duration-200" />}
        </button>
      </nav>

      {/* Actions */}
      <div className="p-4 border-t border-white/10 mt-auto flex flex-col items-center gap-2">
        <div className={`flex gap-2 ${isSidebarOpen ? 'flex-row items-center' : 'flex-col'}`}>
          {FilterNode}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex items-center justify-center w-10 h-10 hover:bg-white/10 rounded-xl transition-all duration-200 text-[#D4AF37]"
            title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
          >
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
