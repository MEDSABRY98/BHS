'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

export interface SearchOption {
  id: string;
  label: string;
  sub?: string; // second line (bank, IBAN …)
}

interface SearchSelectProps {
  value: string | null;
  options: SearchOption[];
  onChange: (id: string | null) => void;
  placeholder?: string;
  createLabel?: string; // "+ New beneficiary"
  onCreate?: (typed: string) => void;
  disabled?: boolean;
}

/** Searchable dropdown; when nothing matches, offers "+ New …". */
export default function SearchSelect({ value, options, onChange, placeholder = 'Search…', createLabel, onCreate, disabled }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.id === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.label.toLowerCase().includes(q) || String(o.sub || '').toLowerCase().replace(/\s/g, '').includes(q.replace(/\s/g, ''))).slice(0, 50);
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

  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full min-h-[44px] flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-white text-left transition-all disabled:opacity-50 ${
          open ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="flex-1 min-w-0">
          {current ? (
            <>
              <span className="block text-sm font-bold text-slate-800 truncate" dir="auto">
                {current.label}
              </span>
              {current.sub && <span className="block text-[11px] font-semibold text-slate-400 truncate">{current.sub}</span>}
            </>
          ) : (
            <span className="text-sm font-semibold text-slate-400">{placeholder}</span>
          )}
        </span>
        {current && !disabled && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              pick(null);
            }}
            className="p-1 rounded-md text-slate-300 hover:text-slate-600 hover:bg-slate-100"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 left-0 right-0 bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-900/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
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
                    pick(filtered[0].id);
                  }
                }}
                placeholder="Type to search…"
                dir="auto"
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm font-semibold text-slate-400">No match{query ? ` for "${query}"` : ''}</p>
            ) : (
              filtered.map((o) => {
                const active = o.id === value;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(o.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors ${active ? 'bg-[#0a0f1d] text-white' : 'hover:bg-slate-50'}`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-bold truncate ${active ? 'text-white' : 'text-slate-800'}`} dir="auto">
                        {o.label}
                      </span>
                      {o.sub && <span className={`block text-[11px] font-semibold truncate ${active ? 'text-slate-300' : 'text-slate-400'}`}>{o.sub}</span>}
                    </span>
                    {active && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          {onCreate && (
            <button
              type="button"
              onClick={() => {
                const typed = query.trim();
                setOpen(false);
                setQuery('');
                onCreate(typed);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 border-t border-slate-100 text-sm font-black text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="w-4 h-4" />
              {createLabel || 'New'}
              {query.trim() && <span className="font-semibold text-slate-500 truncate">“{query.trim()}”</span>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
