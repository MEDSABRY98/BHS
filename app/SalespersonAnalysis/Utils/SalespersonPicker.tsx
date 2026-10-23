'use client';

// Filters popup content (shared by the three sections), one row each:
// period (from / to) → salesperson → customer tag → customer class.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Layers, Search, Tag, UserRound } from 'lucide-react';
import { NO_VALUE, UseSalespersonData } from '../Context/SalespersonDataContext';

const rowLabel = 'text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400';

/** Dropdown with a search box (Tag / Class). value '' = all, NO_VALUE = without a value. */
function FilterSelect({
  label,
  icon,
  value,
  options,
  onChange,
  allLabel,
  noneLabel,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  allLabel: string;
  /** set = adds a "without a value" option */
  noneLabel?: string;
  disabled?: boolean;
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

  const items = useMemo(() => {
    const all = [
      { value: '', label: allLabel },
      ...(noneLabel ? [{ value: NO_VALUE, label: noneLabel }] : []),
      ...options.map((o) => ({ value: o, label: o })),
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [options, query, allLabel, noneLabel]);

  const shown = value === '' ? allLabel : value === NO_VALUE ? noneLabel || value : value;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border bg-slate-50 hover:bg-white hover:border-[#D4AF37] transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
          value ? 'border-[#D4AF37]' : 'border-slate-200'
        }`}
      >
        <div className="w-9 h-9 rounded-full bg-slate-900 text-[#D4AF37] flex items-center justify-center shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <div className={rowLabel}>{label}</div>
          <div className="font-bold text-slate-900 truncate">{shown}</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
          {options.length > 7 && (
            <div className="p-2 border-b border-slate-100 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Nothing found</div>
            ) : (
              items.map((i) => (
                <button
                  key={i.value || '__ALL__'}
                  type="button"
                  onClick={() => {
                    onChange(i.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 flex items-center gap-3 ${
                    i.value === value ? 'bg-amber-50 font-bold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate flex-1">{i.label}</span>
                  {i.value === value && <Check className="w-4 h-4 text-[#B8860B] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** showPeriod=false on the Debit tab: debit is always as of today, the period doesn't apply. */
export default function SalespersonPicker({ showPeriod = true }: { showPeriod?: boolean }) {
  const {
    salespersons,
    canChoose,
    listLoading,
    selectedId,
    setSelectedId,
    period,
    setPeriod,
    tagOptions,
    classOptions,
    tagFilter,
    setTagFilter,
    classFilter,
    setClassFilter,
  } = UseSalespersonData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(period);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(period), [period]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = salespersons.find((s) => s.id === selectedId);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? salespersons.filter((s) => s.name.toLowerCase().includes(q)) : salespersons;
  }, [salespersons, query]);

  const periodValid = !!draft.start && !!draft.end && draft.start <= draft.end;
  const periodChanged = draft.start !== period.start || draft.end !== period.end;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-4 flex flex-col gap-3">
      {/* 1 · period */}
      {showPeriod ? (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <CalendarDays className="w-5 h-5 text-[#B8860B] shrink-0" />
          <span className={`${rowLabel} mr-1`}>From</span>
          <input
            type="date"
            value={draft.start}
            max={draft.end || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
            className="flex-1 min-w-[150px] px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#D4AF37]"
          />
          <span className={rowLabel}>To</span>
          <input
            type="date"
            value={draft.end}
            min={draft.start || undefined}
            onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
            className="flex-1 min-w-[150px] px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#D4AF37]"
          />
          <button
            type="button"
            disabled={!periodValid || !periodChanged}
            onClick={() => setPeriod(draft)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-[#D4AF37] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-1 text-xs font-semibold text-slate-500">
          <CalendarDays className="w-4 h-4 text-[#B8860B] shrink-0" />
          Open debit as of today (not affected by the period)
        </div>
      )}

      {/* 2 · salesperson */}
      <div ref={boxRef} className="relative">
        <button
          type="button"
          disabled={!canChoose || listLoading}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-[#D4AF37] transition-all text-left disabled:cursor-default disabled:hover:bg-slate-50 disabled:hover:border-slate-200"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white flex items-center justify-center font-bold shrink-0">
            {selected ? selected.name.charAt(0).toUpperCase() : <UserRound className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className={rowLabel}>Salesperson</div>
            <div className="font-bold text-slate-900 truncate">{listLoading ? 'Loading...' : selected ? selected.name : 'Choose a salesperson'}</div>
          </div>
          {canChoose ? <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} /> : null}
        </button>

        {open && canChoose ? (
          <div className="absolute z-40 mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-slate-100 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a salesperson name..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-400">No salesperson found</div>
              ) : (
                filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(s.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 flex items-center gap-3 ${s.id === selectedId ? 'bg-amber-50 font-bold text-slate-900' : 'text-slate-700'}`}
                  >
                    <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate">{s.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 3 · customer tag */}
      <FilterSelect
        label="Customer Tag"
        icon={<Tag className="w-4 h-4" />}
        value={tagFilter}
        options={tagOptions}
        onChange={setTagFilter}
        allLabel="All tags"
        noneLabel="Without a tag"
        disabled={!selectedId}
      />

      {/* 4 · customer class */}
      <FilterSelect
        label="Customer Class"
        icon={<Layers className="w-4 h-4" />}
        value={classFilter}
        options={classOptions}
        onChange={setClassFilter}
        allLabel="All classes"
        disabled={!selectedId}
      />
    </div>
  );
}
