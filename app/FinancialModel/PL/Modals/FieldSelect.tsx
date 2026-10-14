'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FieldSelectOption {
  value: string;
  label: string;
  hint?: string;
  dot?: string; // tailwind bg-* class
}

interface FieldSelectProps {
  value: string;
  options: FieldSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Styled dropdown used in the account modals (replaces the native <select>)
export default function FieldSelect({ value, options, onChange, disabled }: FieldSelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, options, value]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (options[active]) pick(options[active].value);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border rounded-xl text-left transition-all font-semibold text-slate-900 disabled:opacity-50 ${
          open ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/40 bg-white' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {selected?.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${selected.dot}`} />}
        <span className="flex-1 truncate">{selected?.label ?? 'Select...'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-[#D4AF37]' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-black/10 p-1.5 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <button
                key={o.value || '__empty'}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  isSel ? 'bg-[#0f0f0f] text-white' : i === active ? 'bg-amber-50 text-slate-900' : 'text-slate-700'
                }`}
              >
                {o.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${o.dot}`} />}
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{o.label}</span>
                  {o.hint && <span className={`block text-[11px] font-medium truncate ${isSel ? 'text-slate-300' : 'text-slate-400'}`}>{o.hint}</span>}
                </span>
                {isSel && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const PL_TYPE_OPTIONS: FieldSelectOption[] = [
  { value: 'REVENUE', label: 'Revenue', hint: 'Sales and other income', dot: 'bg-emerald-500' },
  { value: 'COGS', label: 'COGS (Cost)', hint: 'Cost of goods sold', dot: 'bg-orange-500' },
  { value: 'DIRECT_EXPENSE', label: 'Direct Expenses', hint: 'Linked directly to sales', dot: 'bg-amber-500' },
  { value: 'INDIRECT_EXPENSE', label: 'Indirect Expenses', hint: 'Overheads and admin', dot: 'bg-rose-500' },
  { value: 'DEPRECIATION', label: 'Depreciation', hint: 'Non-cash asset cost', dot: 'bg-slate-500' },
  { value: 'FINANCE_COST', label: 'Finance Cost (Interest)', hint: 'Interest and bank charges', dot: 'bg-indigo-500' },
  { value: 'TAXES', label: 'Taxes', hint: 'Corporate tax', dot: 'bg-purple-500' },
];

export const CF_TYPE_OPTIONS: FieldSelectOption[] = [
  { value: 'OPENING_BALANCE', label: 'Opening Balance', hint: 'Cash at start of period', dot: 'bg-slate-500' },
  { value: 'OPERATING', label: 'Operating Activities', hint: 'Day-to-day business cash', dot: 'bg-emerald-500' },
  { value: 'INVESTING', label: 'Investing Activities', hint: 'Assets bought or sold', dot: 'bg-blue-500' },
  { value: 'FINANCING', label: 'Financing Activities', hint: 'Loans, capital, dividends', dot: 'bg-purple-500' },
];

export const CF_DIRECTION_OPTIONS: FieldSelectOption[] = [
  { value: 'IN', label: 'Inflow (+)', hint: 'Cash coming in', dot: 'bg-emerald-500' },
  { value: 'OUT', label: 'Outflow (-)', hint: 'Cash going out', dot: 'bg-rose-500' },
];

export const COST_BEHAVIOR_OPTIONS: FieldSelectOption[] = [
  { value: '', label: 'Auto (Default)', hint: 'Decided by account type', dot: 'bg-slate-300' },
  { value: 'VARIABLE', label: 'Variable Cost', hint: 'Moves with sales volume', dot: 'bg-amber-500' },
  { value: 'FIXED', label: 'Fixed Cost', hint: 'Same every month', dot: 'bg-blue-500' },
];
