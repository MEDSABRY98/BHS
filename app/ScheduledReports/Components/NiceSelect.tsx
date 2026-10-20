'use client';

// Dropdown used in the Scheduled Reports popup (period, who gets the report).
// The list opens in a portal with fixed positioning so the popup's scroll area never cuts it.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export type NiceOption = { value: string; label: string; hint?: string; icon?: React.ReactNode };

interface Props {
  value: string;
  options: NiceOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'md' | 'sm';
  searchPlaceholder?: string;
  className?: string;
  tone?: (value: string) => 'default' | 'accent';
}

export default function NiceSelect({ value, options, onChange, disabled, size = 'md', searchPlaceholder = 'Search...', className = '', tone }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) || null;
  const searchable = options.length > 7;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint || '').toLowerCase().includes(q)) : options;
  }, [options, query]);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = r.width; // same width as the button
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < 300 && r.top > spaceBelow;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ left, top: up ? r.top - 6 : r.bottom + 6, width, up });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    if (searchable) setTimeout(() => searchRef.current?.focus(), 0);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    const onMove = (e: Event) => {
      if (listRef.current && e.target instanceof Node && listRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    btnRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active].value);
    }
  };

  const accent = tone?.(value) === 'accent';
  const h = size === 'sm' ? 'h-9 px-2.5 rounded-lg text-xs' : 'h-11 px-3 rounded-xl text-sm';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        className={`${h} w-full flex items-center gap-2 border font-bold text-left transition-all disabled:opacity-60 disabled:cursor-default ${
          open
            ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/15 bg-white'
            : accent
              ? 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300'
              : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
        } ${className}`}
      >
        {selected?.icon}
        <span className="flex-1 min-w-0 truncate">{selected?.label || 'Select...'}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && pos && typeof document !== 'undefined' && createPortal(
        <div
          ref={listRef}
          onKeyDown={onKey}
          style={{ position: 'fixed', left: pos.left, width: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
          className="z-[300] bg-white rounded-2xl border border-slate-200/80 shadow-[0_16px_48px_-12px_rgba(15,23,42,0.35)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {searchable && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-100 text-sm font-semibold outline-none focus:border-[#D4AF37]/60"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.map((o, i) => {
              const sel = o.value === value;
              return (
                <button
                  key={o.value || '__all'}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(o.value)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-left transition-colors ${
                    i === active ? 'bg-amber-50' : ''
                  } ${sel ? 'text-slate-900 font-black' : 'text-slate-700 font-semibold'}`}
                >
                  {o.icon}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate" dir="auto">
                      {o.label}
                    </span>
                    {o.hint && <span className="block text-[11px] font-semibold text-slate-400 truncate">{o.hint}</span>}
                  </span>
                  {sel && <Check className="w-4 h-4 text-[#B8860B] shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-3 py-5 text-center text-xs font-bold text-slate-400">No matches</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
