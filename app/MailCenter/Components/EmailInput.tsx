'use client';

// Emails as chips: type and press Enter / comma, or pick a suggestion (the saved customer emails).

import { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { EMAIL_RE, splitEmails } from '../Utils/MailTypes';

interface EmailInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: { email: string; label: string }[];
  placeholder?: string;
}

export default function EmailInput({ value, onChange, suggestions = [], placeholder = 'name@company.com' }: EmailInputProps) {
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const list = splitEmails(raw).map((e) => e.toLowerCase());
    if (!list.length) return;
    onChange(Array.from(new Set([...value, ...list])));
    setText('');
  };

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return suggestions.filter((s) => !value.includes(s.email) && (s.email.includes(q) || s.label.toLowerCase().includes(q))).slice(0, 8);
  }, [text, suggestions, value]);

  return (
    <div className="relative">
      <div
        onClick={() => ref.current?.focus()}
        className={`min-h-11 w-full px-2 py-1.5 rounded-xl border bg-white flex flex-wrap items-center gap-1.5 cursor-text transition-all ${focus ? 'border-[#C4A052] ring-4 ring-[#C4A052]/15' : 'border-slate-200'}`}
      >
        {value.map((e) => (
          <span key={e} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg text-xs font-bold ${EMAIL_RE.test(e) ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-600'}`}>
            {e}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== e))} className="p-0.5 rounded hover:bg-black/10" title="Remove">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;\s]$/.test(v)) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (matches.length && !EMAIL_RE.test(text.trim())) add(matches[0].email);
              else add(text);
            }
            if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (/[,;\s]/.test(t)) {
              e.preventDefault();
              add(t);
            }
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            if (text.trim()) add(text);
          }}
          placeholder={value.length ? '' : placeholder}
          className="flex-1 min-w-[160px] h-7 px-1 text-sm bg-transparent focus:outline-none"
        />
      </div>
      {focus && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 bg-white rounded-xl border border-slate-200 shadow-xl p-1 max-h-64 overflow-y-auto">
          {matches.map((m) => (
            <button
              key={`${m.email}|${m.label}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(m.email);
              }}
              className="w-full px-3 py-2 rounded-lg text-left hover:bg-slate-50"
            >
              <span className="block text-[13px] font-bold text-slate-800">{m.email}</span>
              <span className="block text-[11px] text-slate-400 truncate" dir="auto">{m.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
