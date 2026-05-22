'use client';

import { useState } from 'react';
import { ClipboardList, CheckCircle2, User } from 'lucide-react';
import PendingDriverInvoices from './components/PendingDriverInvoices';
import DeliveredDriverInvoices from './components/DeliveredDriverInvoices';
import PendingCustomerInvoices from './components/PendingCustomerInvoices';

type ReportTab = 'pending' | 'delivered' | 'pending-customer';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pending');

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
          onClick={() => setActiveTab('pending')}
          className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 w-full cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
              : 'text-gray-400 hover:text-black hover:bg-gray-50'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Pending Invoices
        </button>

        <button
          onClick={() => setActiveTab('pending-customer')}
          className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 w-full cursor-pointer ${
            activeTab === 'pending-customer'
              ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
              : 'text-gray-400 hover:text-black hover:bg-gray-50'
          }`}
        >
          <User className="w-4 h-4" />
          Pending Customer Invoices
        </button>

        <button
          onClick={() => setActiveTab('delivered')}
          className={`flex items-center justify-center gap-3 px-6 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 w-full cursor-pointer ${
            activeTab === 'delivered'
              ? 'bg-black text-[#D4AF37] shadow-lg shadow-black/10'
              : 'text-gray-400 hover:text-black hover:bg-gray-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Delivered Invoices
        </button>
      </div>

      {/* Render active report sub-component */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'pending' && <PendingDriverInvoices />}
        {activeTab === 'pending-customer' && <PendingCustomerInvoices />}
        {activeTab === 'delivered' && <DeliveredDriverInvoices />}
      </div>
    </div>
  );
}


