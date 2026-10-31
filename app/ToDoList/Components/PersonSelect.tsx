'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { TodoUser } from '../Utils/TodoTypes';

interface PersonSelectProps {
  users: TodoUser[];
  value: string;      // user ID
  meId: string;
  onChange: (id: string) => void;
  className?: string;
}

/** Drop-down with a search box: type part of the name, Enter picks the first match. */
export default function PersonSelect({ users, value, meId, onChange, className = '' }: PersonSelectProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const label = (u: TodoUser) => (u.ID === meId ? `${u.NAME} (me)` : u.NAME);
  const current = users.find((u) => u.ID === value);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return users.filter((u) => !t || u.NAME.toLowerCase().includes(t));
  }, [users, q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => setActive(0), [q, open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ('');
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-11 px-4 rounded-xl border bg-white text-sm font-semibold text-slate-800 flex items-center justify-between gap-2 text-left transition-colors ${open ? 'border-[#C4A052] ring-4 ring-[#C4A052]/15' : 'border-slate-200 hover:border-slate-300'}`}
      >
        <span className="truncate" dir="auto">
          {current ? label(current) : 'Choose a person'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-2">
          <div className="relative mb-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((i) => Math.min(list.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (list[active]) pick(list[active].ID);
                }
              }}
              placeholder="Search…"
              dir="auto"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]"
            />
          </div>
          <div ref={listRef} className="max-h-56 overflow-y-auto space-y-0.5">
            {list.map((u, i) => (
              <button
                key={u.ID}
                type="button"
                data-i={i}
                onClick={() => pick(u.ID)}
                onMouseEnter={() => setActive(i)}
                className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-left ${i === active ? 'bg-[#C4A052]/10' : ''}`}
              >
                <span className={`text-[13px] truncate ${u.ID === value ? 'font-black text-slate-900' : 'font-bold text-slate-700'}`} dir="auto">
                  {label(u)}
                </span>
                {u.ID === value && <Check className="w-4 h-4 text-[#C4A052] shrink-0" />}
              </button>
            ))}
            {!list.length && <p className="px-3 py-4 text-center text-xs font-bold text-slate-400">No matching people</p>}
          </div>
        </div>
      )}
    </div>
  );
}
