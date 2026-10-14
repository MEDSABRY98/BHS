'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, History } from 'lucide-react';

interface SuggestInputProps {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  className?: string;
  placeholder?: string;
  maxLength?: number;
  emptyHint?: string;
}

/**
 * Free-text input with a styled suggestions menu (replaces the browser datalist).
 * The menu is rendered in a portal with fixed position, so table scroll containers don't clip it.
 */
export default function SuggestInput({ value, onChange, suggestions, className = '', placeholder, maxLength, emptyHint }: SuggestInputProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const q = value.trim().toLowerCase();
    const items = q ? suggestions.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q) : suggestions;
    return items.slice(0, 40);
  }, [suggestions, value]);

  const place = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const up = spaceBelow < 260 && r.top > spaceBelow;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: Math.max(r.width, 220), up });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, value]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, place]);

  useEffect(() => setActive(0), [value, open]);

  const pick = (s: string) => {
    onChange(s);
    setOpen(false);
  };

  const showMenu = open && pos && (list.length > 0 || (!!emptyHint && !value.trim()));

  return (
    <>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !list.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % list.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + list.length) % list.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            pick(list[active]);
          } else if (e.key === 'Escape' || e.key === 'Tab') {
            setOpen(false);
          }
        }}
        dir="auto"
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        className={className}
      />
      {showMenu &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', left: pos.left, width: pos.width, ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }) }}
            className="z-[200] bg-white rounded-2xl border border-slate-100 shadow-2xl shadow-slate-900/15 overflow-hidden animate-in fade-in duration-100"
          >
            {list.length === 0 ? (
              <p className="px-4 py-3 text-xs font-semibold text-slate-400 text-center">{emptyHint}</p>
            ) : (
              <>
                <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5">
                  <History className="w-3 h-3" /> Used before
                </p>
                <div className="max-h-56 overflow-y-auto p-1.5 pt-0.5">
                  {list.map((s, i) => {
                    const isActive = i === active;
                    return (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => pick(s)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${isActive ? 'bg-[#0a0f1d]' : 'hover:bg-slate-50'}`}
                      >
                        <span className={`flex-1 min-w-0 text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-700'}`} dir="auto">
                          {s}
                        </span>
                        {isActive && <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
