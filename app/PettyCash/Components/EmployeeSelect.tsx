'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';
import { formatAmount } from '../Utils/PettyCashTypes';

export interface EmployeeOption {
  name: string;
  count: number;
  total: number;
}

interface EmployeeSelectProps {
  value: string;              // '' = all employees
  options: EmployeeOption[];
  onChange: (name: string) => void;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

function Avatar({ name, active }: { name: string; active?: boolean }) {
  return (
    <span
      className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
        active ? 'bg-[#D4AF37] text-[#0a0f1d]' : 'bg-gradient-to-br from-[#d4af37] to-[#a8861e] text-white'
      }`}
    >
      {initials(name)}
    </span>
  );
}

/** Searchable employee picker with each employee's claims count and total. */
export default function EmployeeSelect({ value, options, onChange }: EmployeeSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.name === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const allCount = options.reduce((s, o) => s + o.count, 0);

  return (
    <div ref={ref} className="relative lg:w-[260px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-11 flex items-center gap-2.5 pl-1.5 pr-3 rounded-xl border bg-white text-left transition-all ${
          open ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {current ? (
          <Avatar name={current.name} />
        ) : (
          <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4" />
          </span>
        )}
        <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 truncate" dir="auto">
          {current ? current.name : 'All employees'}
        </span>
        {current && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              pick('');
            }}
            className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100"
            title="All employees"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 left-0 right-0 bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-900/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length > 6 && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false);
                    if (e.key === 'Enter' && filtered[0]) {
                      e.preventDefault();
                      pick(filtered[0].name);
                    }
                  }}
                  placeholder="Search employee…"
                  dir="auto"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              </div>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto p-1.5">
            {!query && (
              <button
                type="button"
                onClick={() => pick('')}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${!value ? 'bg-[#0a0f1d]' : 'hover:bg-slate-50'}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!value ? 'bg-[#D4AF37] text-[#0a0f1d]' : 'bg-slate-100 text-slate-500'}`}>
                  <Users className="w-4 h-4" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-bold ${!value ? 'text-white' : 'text-slate-800'}`}>All employees</span>
                  <span className={`block text-[11px] font-semibold ${!value ? 'text-slate-400' : 'text-slate-400'}`}>{allCount} claims</span>
                </span>
                {!value && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
              </button>
            )}

            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm font-semibold text-slate-400">No match for &quot;{query}&quot;</p>
            ) : (
              filtered.map((o) => {
                const active = o.name === value;
                return (
                  <button
                    key={o.name}
                    type="button"
                    onClick={() => pick(o.name)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${active ? 'bg-[#0a0f1d]' : 'hover:bg-slate-50'}`}
                  >
                    <Avatar name={o.name} active={active} />
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-bold truncate ${active ? 'text-white' : 'text-slate-800'}`} dir="auto">
                        {o.name}
                      </span>
                      <span className="block text-[11px] font-semibold text-slate-400">
                        {o.count} claim{o.count === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className={`text-xs font-black whitespace-nowrap ${active ? 'text-[#D4AF37]' : 'text-slate-600'}`}>{formatAmount(o.total)}</span>
                    {active && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
