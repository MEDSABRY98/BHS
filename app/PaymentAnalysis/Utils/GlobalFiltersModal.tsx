import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Filter, Tag, LayoutGrid, ChevronDown, Check, MapPin } from 'lucide-react';
import { usePaymentAnalysis } from '../Context/PaymentAnalysisContext';
import { bhs_supabase } from '@/lib/supabase';

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
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all cursor-pointer flex justify-between items-center min-h-[42px]"
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
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
            {options.length === 0 ? (
              <div className="p-3 text-sm text-slate-500 text-center">No options available</div>
            ) : (
              <div className="p-1">
                {options.map(option => {
                  const isSelected = selectedOptions.includes(option);
                  return (
                    <div 
                      key={option}
                      onClick={() => toggleOption(option)}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm font-medium ${isSelected ? 'text-slate-900' : 'text-slate-600'}`}>
                        {option}
                      </span>
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
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-visible shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center shrink-0 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Filter className="w-5 h-5" />
            </div>
            <h3 className="font-black text-lg text-slate-800">Global Filters</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-8 overflow-visible min-h-[400px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 tracking-wide border-b border-slate-100 pb-2">Date Range</h4>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">From Date</label>
                  <input
                    type="date"
                    value={draftDateRange.start}
                    onChange={(e) => setDraftDateRange({ ...draftDateRange, start: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">To Date</label>
                  <input
                    type="date"
                    value={draftDateRange.end}
                    onChange={(e) => setDraftDateRange({ ...draftDateRange, end: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-sm font-bold text-slate-800 tracking-wide border-b border-slate-100 pb-2">Customer Properties</h4>
              
              <MultiSelectDropdown 
                label="Customer Tags"
                icon={Tag}
                options={availableTags}
                selectedOptions={draftTags}
                onChange={setDraftTags}
                placeholder={loadingOptions ? "Loading tags..." : "Select tags"}
              />

              <MultiSelectDropdown 
                label="Customer Class"
                icon={LayoutGrid}
                options={availableClasses}
                selectedOptions={draftClasses}
                onChange={setDraftClasses}
                placeholder={loadingOptions ? "Loading classes..." : "Select classes"}
              />

              <MultiSelectDropdown 
                label="City"
                icon={MapPin}
                options={availableCities}
                selectedOptions={draftCities}
                onChange={setDraftCities}
                placeholder="Select cities"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0 rounded-b-3xl">
          <button
            onClick={handleClear}
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
}
