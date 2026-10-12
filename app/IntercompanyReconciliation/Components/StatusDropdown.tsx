'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface StatusOption<T extends string> {
  value: T;
  label: string;
  count: number;
  dot: string; // tailwind bg color for the dot
}

interface StatusDropdownProps<T extends string> {
  value: T;
  options: StatusOption<T>[];
  onChange: (value: T) => void;
}

export default function StatusDropdown<T extends string>({ value, options, onChange }: StatusDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`h-11 w-full lg:w-[250px] flex items-center gap-2.5 pl-3.5 pr-3 rounded-xl border bg-white text-sm font-bold text-slate-700 transition-all ${
          open ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${current.dot}`} />
        <span className="flex-1 text-left whitespace-nowrap">{current.label}</span>
        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-black text-slate-500">{current.count.toLocaleString('en-US')}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 left-0 right-0 bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-900/10 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active ? 'bg-[#0a0f1d] text-white font-bold' : 'text-slate-600 font-semibold hover:bg-slate-50'
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${o.dot}`} />
                <span className="flex-1 text-left whitespace-nowrap">{o.label}</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-black ${active ? 'bg-white/15 text-[#D4AF37]' : 'bg-slate-100 text-slate-500'}`}>
                  {o.count.toLocaleString('en-US')}
                </span>
                <Check className={`w-4 h-4 shrink-0 ${active ? 'text-[#D4AF37]' : 'invisible'}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
