'use client';

// Same look as the Petty Cash pickers (EmployeeSelect): white trigger, rounded popover, dark active row with gold check.
// The popover is `fixed` so it is never clipped by a table / card with overflow hidden.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;      // small grey line under the label
  icon?: ElementType;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;     // width etc. for the trigger wrapper
  size?: 'md' | 'sm';
  disabled?: boolean;
  searchable?: boolean;   // default: more than 6 options
}

export default function Dropdown({ value, options, onChange, placeholder = 'Select…', className = '', size = 'md', disabled, searchable }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = options.find((o) => o.value === value) || null;
  const showSearch = searchable ?? options.length > 6;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = r.width; // same width as the trigger
    const up = window.innerHeight - r.bottom < 300 && r.top > 300;
    setPos({ top: up ? r.top - 8 : r.bottom + 8, left: r.left, width, up });
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onMove = (e: Event) => { if (!popRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', place);
    if (showSearch) setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', place);
    };
  }, [open, showSearch]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const h = size === 'sm' ? 'h-9' : 'h-11';
  const Icon = current?.icon;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full ${h} flex items-center gap-2 px-3 rounded-xl border bg-white text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
        <span className={`flex-1 min-w-0 truncate ${size === 'sm' ? 'text-xs' : 'text-sm'} font-bold ${current ? 'text-slate-800' : 'text-slate-400'}`} dir="auto">
          {current ? current.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && (
        <div
          ref={popRef}
          style={{ position: 'fixed', left: pos.left, width: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          className="z-[200] bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-900/10 overflow-hidden animate-in fade-in duration-150"
        >
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setOpen(false);
                    if (e.key === 'Enter' && filtered[0]) { e.preventDefault(); pick(filtered[0].value); }
                  }}
                  placeholder="Search…"
                  dir="auto"
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
              </div>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm font-semibold text-slate-400">No match</p>
            ) : (
              filtered.map((o) => {
                const active = o.value === value;
                const OIcon = o.icon;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${active ? 'bg-[#0a0f1d]' : 'hover:bg-slate-50'}`}
                  >
                    {OIcon && (
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-[#D4AF37] text-[#0a0f1d]' : 'bg-slate-100 text-slate-500'}`}>
                        <OIcon className="w-4 h-4" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-bold truncate ${active ? 'text-white' : 'text-slate-800'}`} dir="auto">{o.label}</span>
                      {o.hint && <span className="block text-[11px] font-semibold text-slate-400 truncate">{o.hint}</span>}
                    </span>
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
