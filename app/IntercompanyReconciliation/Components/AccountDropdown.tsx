'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Wallet } from 'lucide-react';

export const ALL_ACCOUNTS = '';
export const NO_ACCOUNT = '__NO_ACCOUNT__';

export interface AccountOption {
  value: string;
  label: string;
  count: number;
}

interface AccountDropdownProps {
  value: string;
  options: AccountOption[]; // first option = "All accounts"
  onChange: (value: string) => void;
}

export default function AccountDropdown({ value, options, onChange }: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o, i) => i === 0 || o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showSearch = options.length > 8;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-11 w-full lg:w-[250px] flex items-center gap-2.5 pl-3.5 pr-3 rounded-xl border bg-white text-sm font-bold text-slate-700 transition-all ${
          open ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-slate-300'
        }`}
        title={current?.label}
      >
        <Wallet className={`w-4 h-4 shrink-0 ${value ? 'text-amber-500' : 'text-slate-400'}`} />
        <span className="flex-1 min-w-0 text-left truncate" dir="auto">
          {current?.label}
        </span>
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-black text-slate-500">{(current?.count || 0).toLocaleString('en-US')}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 left-0 right-0 bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-900/10 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {showSearch && (
            <div className="relative mb-1.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search account..."
                dir="auto"
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40"
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto">
            {shown.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value || 'all'}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  title={o.label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    active ? 'bg-[#0a0f1d] text-white font-bold' : 'text-slate-600 font-semibold hover:bg-slate-50'
                  } ${o.value === NO_ACCOUNT && !active ? 'italic text-slate-400' : ''}`}
                >
                  <span className="flex-1 min-w-0 text-left truncate" dir="auto">
                    {o.label}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${active ? 'bg-white/15 text-[#D4AF37]' : 'bg-slate-100 text-slate-500'}`}>
                    {o.count.toLocaleString('en-US')}
                  </span>
                  <Check className={`w-4 h-4 shrink-0 ${active ? 'text-[#D4AF37]' : 'invisible'}`} />
                </button>
              );
            })}
            {shown.length === 1 && query && <p className="px-3 py-3 text-xs font-semibold text-slate-400">No account found</p>}
          </div>
        </div>
      )}
    </div>
  );
}
