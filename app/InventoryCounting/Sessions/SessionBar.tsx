'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ClipboardList, FileSpreadsheet, Search, type LucideIcon } from 'lucide-react';
import { useICSession } from './ICSessionContext';

export function formatICDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatQty(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export const inputCls =
  'w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-[#D4AF37]/15 focus:border-[#D4AF37] transition-all';
export const btnCls =
  'inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

export type ModernSelectOption = { value: string; label: string; hint?: string; dot?: boolean };

/** Custom dropdown (replaces the native <select>): gold accents, search for long lists, closes on outside click / Esc. */
export function ModernSelect({
  value,
  options,
  onChange,
  icon: Icon,
  placeholder = 'Select...',
  className = '',
  searchable,
}: {
  value: string;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const showSearch = searchable ?? options.length > 6;
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-white text-sm font-bold text-slate-800 text-left transition-all duration-200 ${
          open ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/15' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
        }`}
      >
        {Icon && <Icon className={`w-4 h-4 shrink-0 transition-colors ${open ? 'text-[#D4AF37]' : 'text-slate-400'}`} />}
        {selected?.dot && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
        <span className={`flex-1 min-w-0 truncate ${selected ? '' : 'text-slate-400'}`}>
          {selected ? selected.label : placeholder}
          {selected?.hint && <span className="ml-2 text-xs font-semibold text-slate-400">{selected.hint}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-[#D4AF37]' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-2 min-w-[220px] z-[60] bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {showSearch && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-transparent rounded-lg text-sm font-semibold text-slate-800 outline-none focus:bg-white focus:border-[#D4AF37]"
                />
              </div>
            </div>
          )}
          <div className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs font-bold text-slate-400">No results</div>
            ) : (
              filtered.map((o) => {
                const isSel = o.value === value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                      isSel ? 'bg-amber-50 text-amber-800 font-bold' : 'text-slate-600 font-semibold hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {o.dot !== undefined && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${o.dot ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{o.label}</span>
                      {o.hint && <span className="block truncate text-[11px] font-semibold text-slate-400">{o.hint}</span>}
                    </span>
                    {isSel && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
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

/** Icon-only Excel export button. */
export function ExcelIconButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title="Export to Excel"
      aria-label="Export to Excel"
      className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
    >
      <FileSpreadsheet className="w-5 h-5" />
    </button>
  );
}

/** Session picker + search box + extra controls on the right. */
export default function SessionBar({
  search,
  onSearch,
  placeholder = 'Search product, barcode or lot...',
  children,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const { sessions, selectedId, setSelectedId, data } = useICSession();
  const session = data?.session;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] p-4 flex flex-col xl:flex-row gap-3 xl:items-center">
      <ModernSelect
        className="xl:w-[420px] shrink-0"
        icon={ClipboardList}
        value={selectedId != null ? String(selectedId) : ''}
        onChange={(v) => setSelectedId(Number(v))}
        placeholder="No count sessions"
        options={sessions.map((s) => ({
          value: String(s.id),
          label: s.name || `Session #${s.id}`,
          hint: [s.warehouse, formatICDate(s.createdAt)].filter(Boolean).join('  ·  '),
          dot: s.status === 'OPEN',
        }))}
      />
      {session && (
        <span
          className={`inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shrink-0 ${
            session.status === 'OPEN' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {session.status}
        </span>
      )}
      <div className="relative flex-1 min-w-0">
        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-11`} />
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

export function StatBox({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'green' | 'red' | 'amber' | 'indigo' }) {
  const color = {
    slate: 'text-slate-900',
    green: 'text-emerald-600',
    red: 'text-red-600',
    amber: 'text-amber-600',
    indigo: 'text-[#B8860B]',
  }[tone];
  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] px-5 py-4">
      <div className={`font-mono text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</div>
    </div>
  );
}
