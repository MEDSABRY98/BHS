'use client';

// Modern searchable dropdown — same look as the salesperson picker of Salesperson Analysis.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export type SelectOption = { id: string; label: string; sub?: string };

export default function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = 'Type to search...',
  emptyText = 'Nothing found',
  loading = false,
  fallbackLabel,
}: {
  /** omit inside a table-like row */
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (id: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loading?: boolean;
  /** label to show when the value is not (yet) in the options, e.g. while editing */
  fallbackLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = options.find((o) => o.id === value);
  const shown = selected?.label || (value ? fallbackLabel : '') || '';
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => `${o.label} ${o.sub || ''} ${o.id}`.toLowerCase().includes(q)) : options;
    return list.slice(0, 80);
  }, [options, query]);

  return (
    <div ref={boxRef} className="relative">
      {label ? <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</label> : null}
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((o) => !o)}
        className={`${label ? 'mt-1' : ''} w-full h-[52px] flex items-center gap-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#D4AF37] text-left transition-all disabled:cursor-wait`}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center font-bold text-sm shrink-0">
          {shown ? shown.charAt(0).toUpperCase() : <Search className="w-3.5 h-3.5" />}
        </div>
        <span className={`flex-1 min-w-0 truncate ${shown ? 'font-bold text-slate-900' : 'font-semibold text-slate-400'}`}>
          {loading ? 'Loading...' : shown || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in duration-150">
          <div className="p-2 border-b border-slate-100 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">{emptyText}</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 flex items-center gap-3 ${o.id === value ? 'bg-amber-50 font-bold text-slate-900' : 'text-slate-700'}`}
                >
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {o.label.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.sub ? <span className="block text-[11px] text-slate-400 truncate">{o.sub}</span> : null}
                  </span>
                  {o.id === value ? <Check className="w-4 h-4 text-[#B8860B] shrink-0" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
