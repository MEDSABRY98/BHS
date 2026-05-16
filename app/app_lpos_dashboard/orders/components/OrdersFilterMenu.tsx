'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { Filter, X, ChevronDown, User, Truck, ClipboardList, RotateCcw } from 'lucide-react';

interface OrdersFilterMenuProps {
  onFilterChange: (filters: FilterCriteria) => void;
  activeFilters: FilterCriteria;
  staffList: any[];
}

export interface FilterCriteria {
  invoiceStatus: 'All' | 'Handed Over' | 'Confirmed' | 'Pending';
  driverId: string;
  prepStaffName: string;
}

export default function OrdersFilterMenu({ onFilterChange, activeFilters, staffList }: OrdersFilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prepStaff, setPrepStaff] = useState<string[]>([]);

  useEffect(() => {
    fetchFilterData();
  }, []);

  async function fetchFilterData() {
    try {
      const { data: prepData } = await app_lpos_supabase
        .from('app_lpos_PREPARATION')
        .select('PREPARATION_NAME');
      
      const uniquePreps = Array.from(new Set((prepData || []).map(p => p.PREPARATION_NAME))).filter(Boolean) as string[];
      setPrepStaff(uniquePreps.sort());
    } catch (err) {
      console.error('Error fetching filter data:', err);
    }
  }

  const handleClear = () => {
    onFilterChange({
      invoiceStatus: 'All',
      driverId: 'All',
      prepStaffName: 'All'
    });
  };

  const hasActiveFilters = activeFilters.invoiceStatus !== 'All' || 
                          activeFilters.driverId !== 'All' || 
                          activeFilters.prepStaffName !== 'All';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`p-3 rounded-2xl border transition-all flex items-center justify-center relative ${
          hasActiveFilters 
            ? 'bg-black text-[#D4AF37] border-black shadow-lg shadow-black/10' 
            : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'
        }`}
        title="Advanced Filters"
      >
        <Filter className="w-5 h-5" />
        {hasActiveFilters && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#D4AF37] rounded-full border-2 border-white" />
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setIsOpen(false)} 
          />
          
          <div className="relative w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-gray-100 p-10 animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-2xl font-black text-black tracking-tight">Advanced Filters</h3>
                <p className="text-gray-400 text-sm font-bold mt-1">Refine your orders view</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:text-black transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-8">
              {/* 1. Invoice Status */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <ClipboardList className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Invoices Status</p>
                </div>
                <div className="relative">
                  <select
                    value={activeFilters.invoiceStatus}
                    onChange={(e) => onFilterChange({ ...activeFilters, invoiceStatus: e.target.value as any })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-black/5"
                  >
                    <option value="All">All Invoices</option>
                    <option value="Pending">Pending Handover</option>
                    <option value="Handed Over">Handed Over</option>
                    <option value="Confirmed">Confirmed</option>
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 2. Driver */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Truck className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Assignee (Driver)</p>
                </div>
                <div className="relative">
                  <select
                    value={activeFilters.driverId}
                    onChange={(e) => onFilterChange({ ...activeFilters, driverId: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-black/5"
                  >
                    <option value="All">All Drivers</option>
                    {staffList.filter(s => s.ID.startsWith('S-')).map(s => (
                      <option key={s.ID} value={s.ID}>{s.NAME}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* 3. Prep Staff */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <User className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Prepared By</p>
                </div>
                <div className="relative">
                  <select
                    value={activeFilters.prepStaffName}
                    onChange={(e) => onFilterChange({ ...activeFilters, prepStaffName: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-xs font-bold text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-black/5"
                  >
                    <option value="All">All Staff</option>
                    {prepStaff.map(id => (
                      <option key={id} value={id}>{staffList.find(s => s.ID === id)?.NAME || id}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  onClick={handleClear}
                  className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2 border border-transparent hover:border-gray-100"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-4 rounded-2xl bg-black text-[#D4AF37] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-black/20 hover:bg-gray-900 transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
