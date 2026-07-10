import React from "react";
import { ShieldCheck, ArrowLeft, ChevronRight, ChevronLeft } from "lucide-react";

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  currentView: "grid" | "add" | "details";
  setCurrentView: (view: "grid" | "add" | "details") => void;
  setSelectedCustomer: (val: null) => void;
}

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  currentView,
  setCurrentView,
  setSelectedCustomer
}: SidebarProps) {
  return (
    <div className={`${isSidebarOpen ? 'w-64' : 'w-24'} transition-all duration-300 bg-gray-900 text-white flex flex-col shrink-0 shadow-xl z-20`}>
      <div className="p-6 flex flex-col items-center justify-center border-b border-gray-800 relative">
        <a 
          href="/"
          className="text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800 p-2 rounded-xl mb-6 transition-colors flex items-center justify-center"
          title="Back to Home"
        >
          <ArrowLeft className="w-5 h-5 shrink-0" />
        </a>

        <div className="bg-[#D4AF37]/20 p-3 rounded-2xl">
          <ShieldCheck className="text-[#D4AF37] w-8 h-8" />
        </div>
        {isSidebarOpen && (
          <h1 className="text-lg font-bold tracking-tight mt-3 text-center leading-tight">
            Discounts &<br/>Rentals
          </h1>
        )}
      </div>

      <div className="flex-1 py-6 px-4 space-y-3">
        <button
          onClick={() => {
            setCurrentView("grid");
            setSelectedCustomer(null);
          }}
          className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center px-0'} py-3 rounded-xl transition-all ${
            currentView === "grid" || currentView === "details"
              ? "bg-[#D4AF37] text-gray-900 font-bold shadow-lg shadow-[#D4AF37]/20"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
          title="Customers List"
        >
          {isSidebarOpen ? <span>Customers List</span> : <span className="font-bold text-lg">C</span>}
        </button>
        
        <button
          onClick={() => {
            setCurrentView("add");
            setSelectedCustomer(null);
          }}
          className={`w-full flex items-center ${isSidebarOpen ? 'justify-start px-4' : 'justify-center px-0'} py-3 rounded-xl transition-all ${
            currentView === "add"
              ? "bg-[#D4AF37] text-gray-900 font-bold shadow-lg shadow-[#D4AF37]/20"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
          title="Add New Discount"
        >
          {isSidebarOpen ? <span>Add New Discount</span> : <span className="font-bold text-lg">+</span>}
        </button>
      </div>

      <div className="p-4 border-t border-gray-800 flex justify-center mt-auto">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-gray-400 hover:text-white hover:bg-gray-800 p-3 rounded-xl transition-colors flex items-center justify-center w-full"
          title="Toggle Sidebar"
        >
          {isSidebarOpen ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
        </button>
      </div>
    </div>
  );
}
