'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { CURRENCIES } from '../Utils/TransferTypes';

/** Modern currency dropdown (same width as its button). */
export default function CurrencySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = CURRENCIES.find((c) => c.code === value) || CURRENCIES[0];

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
        className={`w-full h-11 flex items-center gap-2.5 px-3.5 rounded-xl border bg-white text-left transition-all ${
          open ? 'border-amber-300 ring-2 ring-amber-400/30' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <span className="px-2 py-0.5 rounded-md bg-[#0a0f1d] text-[#D4AF37] text-[11px] font-black tracking-wider">{current.code}</span>
        <span className="flex-1 text-sm font-bold text-slate-700 truncate">{current.name}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 mt-2 left-0 right-0 bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-900/10 p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {CURRENCIES.map((c) => {
            const active = c.code === value;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active ? 'bg-[#0a0f1d] text-white font-bold' : 'text-slate-600 font-semibold hover:bg-slate-50'
                }`}
              >
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-black tracking-wider ${active ? 'bg-white/15 text-[#D4AF37]' : 'bg-slate-100 text-slate-600'}`}
                >
                  {c.code}
                </span>
                <span className="flex-1 text-left truncate">{c.name}</span>
                <Check className={`w-4 h-4 shrink-0 ${active ? 'text-[#D4AF37]' : 'invisible'}`} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
