import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Filter, Save, RotateCcw, ChevronDown, Check, Search } from 'lucide-react';
import { usePurchaseData, PurchaseFilters } from '../Context/PurchaseDataContext';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterModal({ isOpen, onClose }: FilterModalProps) {
  const { globalFilters, setGlobalFilters, uniqueCategories, products } = usePurchaseData();
  const [draftFilters, setDraftFilters] = useState<PurchaseFilters>(globalFilters);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [searchCat, setSearchCat] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync draft filters when modal opens
  useEffect(() => {
    if (isOpen) {
      setDraftFilters(globalFilters);
      setIsCategoryOpen(false);
      setSearchCat('');
    }
  }, [isOpen, globalFilters]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCategories = useMemo(() => {
    if (!searchCat) return uniqueCategories;
    return uniqueCategories.filter(c => c.toLowerCase().includes(searchCat.toLowerCase()));
  }, [uniqueCategories, searchCat]);

  // Calculate matching items based on draft
  const matchingCount = products.filter(p => 
    draftFilters.categories.length === 0 || draftFilters.categories.includes(p.category)
  ).length;

  if (!isOpen) return null;

  const toggleCategory = (cat: string) => {
    setDraftFilters(prev => {
      const isSelected = prev.categories.includes(cat);
      if (isSelected) {
        return { ...prev, categories: prev.categories.filter(c => c !== cat) };
      } else {
        return { ...prev, categories: [...prev.categories, cat] };
      }
    });
  };

  const handleApply = () => {
    setGlobalFilters(draftFilters);
    onClose();
  };

  const handleReset = () => {
    setDraftFilters({ categories: [] });
    setSearchCat('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl flex flex-col overflow-visible animate-in zoom-in-95 duration-300 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-purple-900 to-indigo-900 rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Purchase Filters</h2>
              <p className="text-xs font-medium text-purple-200 mt-0.5">Refine your product view</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleReset}
              title="Reset Filters"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={handleApply}
              title="Apply Filters"
              className="p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <Save className="w-5 h-5" />
            </button>
            <div className="w-px h-5 bg-white/20 mx-2"></div>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-visible flex-1 bg-slate-50 min-h-[400px]">
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-slate-800">Product Categories</label>
                {draftFilters.categories.length > 0 && (
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">
                    {draftFilters.categories.length} Selected
                  </span>
                )}
              </div>
              
              {/* Custom Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className={`w-full flex items-center justify-between bg-white border-2 text-left text-sm py-3 px-4 rounded-xl transition-all font-semibold
                    ${isCategoryOpen ? 'border-purple-500 shadow-sm ring-4 ring-purple-500/10' : 'border-slate-200 text-slate-700 hover:border-purple-300'}
                  `}
                >
                  <span className={draftFilters.categories.length === 0 ? 'text-slate-500' : 'text-purple-700 truncate pr-4'}>
                    {draftFilters.categories.length === 0 
                      ? 'All Categories' 
                      : draftFilters.categories.join(', ')}
                  </span>
                  <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCategoryOpen && (
                  <div className="absolute z-[110] w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    
                    {/* Search inside Dropdown */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={searchCat}
                          onChange={(e) => setSearchCat(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20"
                        />
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                      <button
                        onClick={() => {
                          setDraftFilters(prev => ({ ...prev, categories: [] }));
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors text-left font-medium mb-1
                          ${draftFilters.categories.length === 0 ? 'bg-purple-50 text-purple-700' : 'text-slate-700 hover:bg-slate-50'}
                        `}
                      >
                        <span>All Categories</span>
                        {draftFilters.categories.length === 0 && <Check className="w-4 h-4 text-purple-600" />}
                      </button>

                      {filteredCategories.map(cat => {
                        const isSelected = draftFilters.categories.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors text-left font-medium
                              ${isSelected ? 'bg-purple-50/50 text-purple-700' : 'text-slate-700 hover:bg-slate-50'}
                            `}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                              ${isSelected ? 'bg-purple-600 border-purple-600' : 'bg-white border-slate-300'}
                            `}>
                              {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                            </div>
                            <span className="truncate">{cat}</span>
                          </button>
                        );
                      })}
                      {filteredCategories.length === 0 && (
                        <div className="px-4 py-6 text-center text-sm text-slate-400 font-medium">
                          No categories found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 rounded-b-3xl">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-600">Matching Products:</span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-black">
              {matchingCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
