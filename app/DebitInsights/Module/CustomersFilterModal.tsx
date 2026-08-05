'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Users, X } from 'lucide-react';

interface CustomersFilterModalProps {
  open: boolean;
  customers: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onClose: () => void;
}

export default function CustomersFilterModal({
  open,
  customers,
  selected,
  onChange,
  onClose,
}: CustomersFilterModalProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => customer.toLowerCase().includes(query));
  }, [customers, search]);

  const toggleCustomer = (customer: string) => {
    onChange(
      selected.includes(customer)
        ? selected.filter((value) => value !== customer)
        : [...selected, customer]
    );
  };

  const selectAllFiltered = () => {
    const merged = new Set([...selected, ...filteredCustomers]);
    onChange(Array.from(merged));
  };

  const clearFiltered = () => {
    const filteredSet = new Set(filteredCustomers);
    onChange(selected.filter((customer) => !filteredSet.has(customer)));
  };

  const selectionLabel =
    selected.length === 0
      ? 'All customers included'
      : `${selected.length} of ${customers.length} selected`;

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
              <Users className="w-4 h-4" />
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
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer..."
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllFiltered}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearFiltered}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex-1 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto py-1">
          {customers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No customers found</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-400">No customers match your search</div>
          ) : (
            filteredCustomers.map((customer) => {
              const isSelected = selected.includes(customer);
              return (
                <label
                  key={customer}
                  className={`w-full px-5 py-2.5 flex items-center gap-3 cursor-pointer transition-colors border-b border-slate-50 last:border-0 ${
                    isSelected ? 'bg-indigo-50 text-indigo-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleCustomer(customer)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
                  />
                  <span className={`text-sm truncate ${isSelected ? 'font-semibold' : 'font-medium'}`}>
                    {customer}
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
