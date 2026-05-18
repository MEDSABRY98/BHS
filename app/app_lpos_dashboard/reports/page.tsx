'use client';

import { useState } from 'react';
import { FileText, ClipboardList, ShieldAlert, TrendingUp } from 'lucide-react';
import PendingDriverInvoices from './components/PendingDriverInvoices';

type ReportTab = 'pending-drivers' | 'coming-soon-1' | 'coming-soon-2';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pending-drivers');

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-normal text-black tracking-tighter">
            Reports
          </h1>
        </div>
      </div>

      {/* Segmented Pill Selector (Report Types) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm w-full max-w-4xl mx-auto">
        <button
          onClick={() => setActiveTab('pending-drivers')}
          className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 w-full ${
            activeTab === 'pending-drivers'
              ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
              : 'text-gray-400 hover:text-black hover:bg-gray-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Pending Drivers
        </button>

        <button
          disabled
          className="flex items-center justify-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 cursor-not-allowed w-full"
        >
          <TrendingUp className="w-4 h-4 opacity-50" />
          Sales Performance (Soon)
        </button>

        <button
          disabled
          className="flex items-center justify-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 cursor-not-allowed w-full"
        >
          <ShieldAlert className="w-4 h-4 opacity-50" />
          Audit Logs (Soon)
        </button>
      </div>

      {/* Render active report sub-component */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'pending-drivers' && <PendingDriverInvoices />}
      </div>
    </div>
  );
}
