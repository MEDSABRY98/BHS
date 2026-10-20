'use client';

// Admin only (New Petty Cash): the employee the petty cash is for.
// Type any name (he doesn't have to be a user) or pick one of the suggestions. Empty = the admin himself.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, UserRound, X } from 'lucide-react';

interface EmployeePickerProps {
  value: string; // '' = myself
  names: string[];
  onChange: (name: string) => void;
  disabled?: boolean;
  placeholder?: string; // shown when empty (new: "Myself", edit: the current name)
}

export default function EmployeePicker({ value, names, onChange, disabled, placeholder = 'Myself' }: EmployeePickerProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const q = value.trim().toLowerCase();
    const list = q ? names.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q) : names;
    return list.slice(0, 50);
  }, [names, value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => setActive(-1), [value, open]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full sm:w-72">
      <div
        className={`h-10 flex items-center gap-2 px-3 rounded-xl border bg-white transition-all ${
          open ? 'border-amber-400 ring-4 ring-amber-400/15' : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-50' : ''}`}
        title="The employee this petty cash is for"
      >
        <UserRound className={`w-4 h-4 shrink-0 ${value.trim() ? 'text-amber-600' : 'text-slate-400'}`} />
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 shrink-0">Employee</span>
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !suggestions.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, suggestions.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && active >= 0) {
              e.preventDefault();
              pick(suggestions[active]);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          dir="auto"
          className="flex-1 min-w-0 h-full bg-transparent text-sm font-semibold text-slate-900 placeholder:text-slate-500 outline-none"
          aria-label="Employee"
        />
        {value && !disabled && (
          <button
            type="button"
            onClick={() => pick('')}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute right-0 sm:left-0 mt-2 w-full min-w-[16rem] z-50 bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] overflow-hidden">
          <div className="max-h-72 overflow-y-auto p-1.5">
            {suggestions.map((n, i) => {
              const sel = n === value;
              return (
                <button
                  key={n}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(n)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors ${
                    sel || i === active ? 'bg-amber-50 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate" dir="auto">
                    {n}
                  </span>
                  {sel && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
