'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Tag, Users, X } from 'lucide-react';

export type CustomersFilterMode = 'customers' | 'tags';

interface CustomersFilterModalProps {
  open: boolean;
  customers: string[];
  customerTags: string[];
  selectedCustomers: string[];
  selectedTags: string[];
  onChangeCustomers: (next: string[]) => void;
  onChangeTags: (next: string[]) => void;
  onClose: () => void;
}

export default function CustomersFilterModal({
  open,
  customers,
  customerTags,
  selectedCustomers,
  selectedTags,
  onChangeCustomers,
  onChangeTags,
  onClose,
}: CustomersFilterModalProps) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<CustomersFilterMode>('customers');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setMode('customers');
    }
  }, [open]);

  const options = mode === 'customers' ? customers : customerTags;
  const selected = mode === 'customers' ? selectedCustomers : selectedTags;
  const onChange = mode === 'customers' ? onChangeCustomers : onChangeTags;

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((item) => item.toLowerCase().includes(query));
  }, [options, search]);

  const toggleItem = (item: string) => {
    onChange(
      selected.includes(item) ? selected.filter((value) => value !== item) : [...selected, item]
    );
  };

  const selectAllFiltered = () => {
    onChange(Array.from(new Set([...selected, ...filteredOptions])));
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectionLabel =
    selectedCustomers.length === 0 && selectedTags.length === 0
      ? 'All customers included'
      : [
          selectedCustomers.length > 0
            ? `${selectedCustomers.length} customer${selectedCustomers.length === 1 ? '' : 's'}`
            : null,
          selectedTags.length > 0
            ? `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ');

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close customers filter"
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
              {mode === 'customers' ? <Users className="w-4 h-4" /> : <Tag className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900">Customers</h3>
              <p className="text-xs text-slate-500 truncate">{selectionLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 border-b border-slate-100 bg-slate-50/60">
          <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-slate-200 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setMode('customers');
                setSearch('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                mode === 'customers'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Customers
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('tags');
                setSearch('');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                mode === 'tags'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              Tags
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === 'customers' ? 'Search customer...' : 'Search tag...'}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wide text-emerald-700 bg-transparent border-2 border-emerald-500 rounded-xl hover:bg-emerald-50 transition-all active:scale-[0.98]"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wide text-red-600 bg-transparent border-2 border-red-500 rounded-xl hover:bg-red-50 transition-all active:scale-[0.98]"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-1">
          {options.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              {mode === 'customers' ? 'No customers found' : 'No customer tags found'}
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">
              {mode === 'customers' ? 'No customers match your search' : 'No tags match your search'}
            </div>
          ) : (
            filteredOptions.map((item) => {
              const isSelected = selected.includes(item);
              return (
                <label
                  key={item}
                  className={`w-full px-5 py-2.5 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${
                    isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleItem(item)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                  <span className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {item}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
