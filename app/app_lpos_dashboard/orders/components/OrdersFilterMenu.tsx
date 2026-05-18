'use client';

import { useState, useEffect } from 'react';
import { app_lpos_supabase } from '@/lib/app_lpos_supabase';
import { Filter, X, ChevronDown, User, Truck, ClipboardList, RotateCcw } from 'lucide-react';
import SearchSelect from '../../components/DropDownList';

interface OrdersFilterMenuProps {
  onFilterChange: (filters: FilterCriteria) => void;
  activeFilters: FilterCriteria;
  staffList: any[];
}

export interface FilterCriteria {
  invoiceStatus: 'All' | 'Handed Over' | 'Confirmed' | 'Pending' | 'Returned';
  driverId: string;
  prepStaffName: string;
}

export default function OrdersFilterMenu({ onFilterChange, activeFilters, staffList }: OrdersFilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [driversList, setDriversList] = useState<any[]>([]);

  useEffect(() => {
    fetchFilterData();
  }, []);

  async function fetchFilterData() {
    try {
      // Fetch drivers from STAFF master table since assignment uses staff IDs
      const { data: driverData } = await app_lpos_supabase
        .from('app_lpos_STAFF')
        .select('ID, NAME')
        .order('NAME');
      if (driverData) {
        setDriversList(driverData);
      }
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
                <SearchSelect
                  label=""
                  placeholder="All Invoices"
                  options={[
                    { id: 'All', label: 'All Invoices' },
                    { id: 'Pending', label: 'Pending Handover', subLabel: 'Awaiting Handover' },
                    { id: 'Handed Over', label: 'Handed Over', subLabel: 'Assigned to Driver' },
                    { id: 'Confirmed', label: 'Confirmed', subLabel: 'Fully Delivered' },
                    { id: 'Returned', label: 'Returned & Cancelled', subLabel: 'Returned' }
                  ]}
                  value={activeFilters.invoiceStatus}
                  onChange={(val) => onFilterChange({ ...activeFilters, invoiceStatus: (val as any) || 'All' })}
                />
              </div>

              {/* 2. Driver */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Truck className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Assignee (Driver)</p>
                </div>
                <SearchSelect
                  label=""
                  placeholder="All Drivers"
                  options={[
                    { id: 'All', label: 'All Drivers' },
                    ...driversList.map(d => ({ id: d.ID, label: d.NAME, subLabel: `Staff ID: ${d.ID}` }))
                  ]}
                  value={activeFilters.driverId}
                  onChange={(val) => onFilterChange({ ...activeFilters, driverId: val || 'All' })}
                />
              </div>

              {/* 3. Prep Staff */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <User className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Prepared By</p>
                </div>
                <SearchSelect
                  label=""
                  placeholder="All Staff"
                  options={[
                    { id: 'All', label: 'All Staff' },
                    ...staffList.map(s => ({ id: s.ID, label: s.NAME, subLabel: `Staff ID: ${s.ID}` }))
                  ]}
                  value={activeFilters.prepStaffName}
                  onChange={(val) => onFilterChange({ ...activeFilters, prepStaffName: val || 'All' })}
                  direction="up"
                />
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
