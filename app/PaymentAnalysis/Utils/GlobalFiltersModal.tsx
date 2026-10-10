import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Filter, Tag, LayoutGrid, ChevronDown, Check, MapPin, RotateCcw } from 'lucide-react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { bhs_supabase } from '@/lib/secureDb';

interface GlobalFiltersModalProps {
  onClose: () => void;
}

function MultiSelectDropdown({ 
  label, 
  icon: Icon, 
  options, 
  selectedOptions, 
  onChange,
  placeholder 
}: { 
  label: string; 
  icon: any; 
  options: string[]; 
  selectedOptions: string[]; 
  onChange: (selected: string[]) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selectedOptions.includes(option)) {
      onChange(selectedOptions.filter(o => o !== option));
    } else {
      onChange([...selectedOptions, option]);
    }
  };

  return (
    <div className="space-y-1.5" ref={dropdownRef}>
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        {label}
      </label>
      <div className="relative">
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full appearance-none rounded-xl border transition-all duration-200 px-4 py-3 pr-10 text-[15px] font-semibold text-slate-900 shadow-sm outline-none flex items-center justify-between min-h-[50px] cursor-pointer ${isOpen ? 'border-[#D4AF37] bg-white ring-4 ring-[#D4AF37]/15' : 'border-slate-200 bg-white/50 hover:bg-white focus-within:border-[#D4AF37] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#D4AF37]/15'}`}
        >
          <div className="flex flex-wrap gap-1 items-center">
            {selectedOptions.length === 0 ? (
              <span className="text-slate-400 font-medium">{placeholder}</span>
            ) : (
              selectedOptions.map(opt => (
                <span key={opt} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                  {opt}
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleOption(opt); }}
                    className="hover:text-indigo-900 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))
            )}
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 absolute right-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 animate-in fade-in zoom-in-95 duration-200 py-1.5 max-h-60 overflow-y-auto no-scrollbar">
            {options.length === 0 ? (
              <div className="p-3 text-sm text-slate-500 text-center">No options available</div>
            ) : (
              <div>
                {options.map(option => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <div 
                      key={option}
                      onClick={() => toggleOption(option)}
                      className={`flex items-center justify-between px-4 py-2.5 text-[14px] transition-colors cursor-pointer ${isSelected ? 'bg-amber-50/50 text-amber-700 font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}
                    >
                      <span>{option}</span>
                      {isSelected && <Check className="w-4 h-4 text-[#D4AF37]" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GlobalFiltersModal({ onClose }: GlobalFiltersModalProps) {
  const { data, dateRange, setDateRange, selectedTags, setSelectedTags, selectedClasses, setSelectedClasses, selectedCities, setSelectedCities } = usePaymentAnalysis();
  const [draftDateRange, setDraftDateRange] = useState(dateRange);
  const [draftTags, setDraftTags] = useState<string[]>(selectedTags);
  const [draftClasses, setDraftClasses] = useState<string[]>(selectedClasses);
  const [draftCities, setDraftCities] = useState<string[]>(selectedCities);

  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Extract cities from context data
  const availableCities = useMemo(() => {
    const cSet = new Set<string>();
    data.forEach(row => {
      if (row.city) cSet.add(row.city.trim());
    });
    return Array.from(cSet).filter(Boolean).sort();
  }, [data]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const { data, error } = await bhs_supabase
          .from('bhs_CUSTOMERS')
          .select('"CUSTOMER TAG", "CUSTOMER CLASS"');
        
        if (data && !error) {
          const tSet = new Set<string>();
          const cSet = new Set<string>();
          
          data.forEach(row => {
            if (row['CUSTOMER TAG']) {
              row['CUSTOMER TAG'].split(',').forEach((t: string) => tSet.add(t.trim()));
            }
            if (row['CUSTOMER CLASS']) {
              cSet.add(row['CUSTOMER CLASS'].trim());
            }
          });
          
          setAvailableTags(Array.from(tSet).filter(Boolean).sort());
          setAvailableClasses(Array.from(cSet).filter(Boolean).sort());
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      } finally {
        setLoadingOptions(false);
      }
    }
    loadFilterOptions();
  }, []);

  const handleApply = () => {
    setDateRange(draftDateRange);
    setSelectedTags(draftTags);
    setSelectedClasses(draftClasses);
    setSelectedCities(draftCities);
    onClose();
  };

  const handleClear = () => {
    const emptyRange = { start: '', end: '' };
    setDraftDateRange(emptyRange);
    setDateRange(emptyRange);
    
    setDraftTags([]);
    setSelectedTags([]);
    
    setDraftClasses([]);
    setSelectedClasses([]);
    
    setDraftCities([]);
    setSelectedCities([]);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-visible shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center shrink-0 rounded-t-[2rem]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
              <Filter className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black tracking-tight text-slate-900">Filters</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">From Date</label>
              <div className="relative group">
                <input
                  type="date"
                  value={draftDateRange.start}
                  onChange={(e) => setDraftDateRange({ ...draftDateRange, start: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-[15px] font-semibold text-slate-900 shadow-sm outline-none transition-all hover:bg-white focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-[#D4AF37]/15"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">To Date</label>
              <div className="relative group">
                <input
                  type="date"
                  value={draftDateRange.end}
                  onChange={(e) => setDraftDateRange({ ...draftDateRange, end: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white/50 px-4 py-3 text-[15px] font-semibold text-slate-900 shadow-sm outline-none transition-all hover:bg-white focus:border-[#D4AF37] focus:bg-white focus:ring-4 focus:ring-[#D4AF37]/15"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative z-30">
              <MultiSelectDropdown 
                label="City"
                icon={MapPin}
                options={availableCities}
                selectedOptions={draftCities}
                onChange={setDraftCities}
                placeholder="Select cities"
              />
            </div>

            <div className="relative z-20">
              <MultiSelectDropdown 
                label="Customer Tags"
                icon={Tag}
                options={availableTags}
                selectedOptions={draftTags}
                onChange={setDraftTags}
                placeholder={loadingOptions ? "Loading tags..." : "Select tags"}
              />
            </div>

            <div className="relative z-10">
              <MultiSelectDropdown 
                label="Customer Class"
                icon={LayoutGrid}
                options={availableClasses}
                selectedOptions={draftClasses}
                onChange={setDraftClasses}
                placeholder={loadingOptions ? "Loading classes..." : "Select classes"}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 p-6 bg-slate-50/50 rounded-b-[2rem] relative z-0">
          <button
            onClick={handleClear}
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
