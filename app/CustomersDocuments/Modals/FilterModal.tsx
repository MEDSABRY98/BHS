import React, { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';

export type FilterState = 'all' | 'collected' | 'missing';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  docFilters: { [key: string]: FilterState };
  setDocFilters: React.Dispatch<React.SetStateAction<{ [key: string]: FilterState }>>;
}

export default function FilterModal({ isOpen, onClose, docFilters, setDocFilters }: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState(docFilters);

  useEffect(() => {
    if (isOpen) {
      setLocalFilters(docFilters);
    }
  }, [isOpen, docFilters]);

  if (!isOpen) return null;

  const filterFields = [
    { id: 'creditApp', label: 'Credit App' },
    { id: 'licence', label: 'Trade Licence' },
    { id: 'trn', label: 'TRN Certificate' },
    { id: 'passport', label: 'Passport' },
    { id: 'id', label: 'ID Card' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden border border-slate-100" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <Filter className="w-4 h-4" />
            </div>
            Document Filters
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {filterFields.map(filter => (
            <div key={filter.id} className="flex flex-col gap-3">
              <span className="font-black text-slate-700 text-sm tracking-wide">{filter.label}</span>
              <div className="grid grid-cols-3 gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-100">
                <button
                  onClick={() => setLocalFilters(prev => ({ ...prev, [filter.id]: 'all' }))}
                  className={`py-2 rounded-xl text-[11px] uppercase tracking-wider font-black transition-all ${localFilters[filter.id] === 'all' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/50'}`}
                >
                  No Filter
                </button>
                <button
                  onClick={() => setLocalFilters(prev => ({ ...prev, [filter.id]: 'collected' }))}
                  className={`py-2 rounded-xl text-[11px] uppercase tracking-wider font-black transition-all ${localFilters[filter.id] === 'collected' ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50'}`}
                >
                  Collected
                </button>
                <button
                  onClick={() => setLocalFilters(prev => ({ ...prev, [filter.id]: 'missing' }))}
                  className={`py-2 rounded-xl text-[11px] uppercase tracking-wider font-black transition-all ${localFilters[filter.id] === 'missing' ? 'bg-rose-500 text-white shadow-sm shadow-rose-200' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50/50'}`}
                >
                  Missing
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => {
              setDocFilters(localFilters);
              onClose();
            }}
            className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
