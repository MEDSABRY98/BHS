'use client';

// Salesperson search / pick + period (shared by the three sections).

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Search, UserRound } from 'lucide-react';
import { UseSalespersonData } from '../Context/SalespersonDataContext';

export default function SalespersonPicker() {
  const { salespersons, canChoose, listLoading, selectedId, setSelectedId, period, setPeriod } = UseSalespersonData();
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
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_4px_20px_-6px_rgba(0,0,0,0.06)] p-4 flex flex-col lg:flex-row lg:items-center gap-3">
      {/* salesperson */}
      <div ref={boxRef} className="relative flex-1 min-w-0">
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
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Salesperson</div>
            <div className="font-bold text-slate-900 truncate">
              {listLoading ? 'Loading...' : selected ? selected.name : 'Choose a salesperson'}
            </div>
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

      {/* period */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarDays className="w-5 h-5 text-[#B8860B] shrink-0" />
        <input
          type="date"
          value={draft.start}
          max={draft.end || undefined}
          onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#D4AF37]"
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="date"
          value={draft.end}
          min={draft.start || undefined}
          onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
          className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:border-[#D4AF37]"
        />
        <button
          disabled={!periodValid || !periodChanged}
          onClick={() => setPeriod(draft)}
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-[#D4AF37] text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
