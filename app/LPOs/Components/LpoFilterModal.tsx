'use client';

import React, { useEffect, useState } from 'react';
import { X, Filter, RotateCcw, ChevronDown, Check } from 'lucide-react';
import { useLpoData } from '../Context/LpoDataContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

function CustomDropdown({ value, options, onChange }: { value: string, options: {label: string, value: string}[], onChange: (v: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left appearance-none rounded-xl border transition-all duration-200 px-4 py-3 pr-10 text-[15px] font-semibold text-slate-900 shadow-sm outline-none flex items-center justify-between ${isOpen ? 'border-[#D4AF37] bg-white ring-4 ring-[#D4AF37]/15' : 'border-slate-200 bg-white/50 hover:bg-white focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-[#D4AF37]/15'}`}
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 animate-in fade-in zoom-in-95 duration-200 py-1.5 max-h-60 overflow-y-auto no-scrollbar">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-[14px] transition-colors ${value === opt.value ? 'bg-amber-50/50 text-amber-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}
              >
                {opt.label}
                {value === opt.value && <Check className="w-4 h-4 text-[#D4AF37]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function LpoFilterModal({ open, onClose }: Props) {
  const { filters, setFilters, assignedDrivers } = useLpoData();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (open) {
      setDraft(filters);
    }
  }, [open, filters]);

  if (!open) return null;

  const handleApply = () => {
    setFilters(draft);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters = { dateFrom: '', dateTo: '', driver: 'ALL', status: 'ALL' };
    setDraft(defaultFilters);
    setFilters(defaultFilters);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 bg-slate-50/50 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Filter className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Filters</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Date From</label>
              <div className="relative group">
                <input
                  type="date"
                  value={draft.dateFrom}
                  onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-[15px] font-semibold text-slate-900 shadow-sm outline-none transition-all hover:bg-white focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-[#D4AF37]/15"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Date To</label>
              <div className="relative group">
                <input
                  type="date"
                  value={draft.dateTo}
                  onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-[15px] font-semibold text-slate-900 shadow-sm outline-none transition-all hover:bg-white focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-[#D4AF37]/15"
                />
              </div>
            </div>
          </div>

          <div className="relative z-20">
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Driver</label>
            <CustomDropdown
              value={draft.driver}
              onChange={(val) => setDraft({ ...draft, driver: val })}
              options={[
                { label: 'All Drivers', value: 'ALL' },
                ...assignedDrivers.map(d => ({ label: d.NAME, value: d.NAME }))
              ]}
            />
          </div>

          <div className="relative z-10">
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Invoice Status</label>
            <CustomDropdown
              value={draft.status}
              onChange={(val) => setDraft({ ...draft, status: val })}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Pending Customer', value: 'Pending Customer' },
                { label: 'Pending Driver', value: 'Pending Driver' },
                { label: 'Canceled', value: 'Canceled' },
                { label: 'Delivered', value: 'Delivered' }
              ]}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-6 bg-slate-50/50 rounded-b-[2rem] relative z-0">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleApply}
              className="rounded-xl bg-[#0f0f0f] px-6 py-2.5 text-sm font-bold text-[#D4AF37] shadow-lg transition hover:bg-black hover:shadow-xl hover:-translate-y-0.5"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
