'use client';

// File Labels: type the file names, pick a label size, print them on A4 at their real size
// (the name is fitted to each label). Save puts the list in the archive (DATA = the draft);
// the list and the sizes also stay in this browser.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  Minus,
  Plus,
  Ruler,
  Scissors,
  Tag,
  X,
} from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import FormShell from '../Shared/FormShell';
import { uaeToday } from '../Shared/FormsUtils';
import type { FormEditorContext } from '../Shared/FormsArchiveTypes';
import { expandLabels, printFileLabels, type LabelRow, type LabelSize } from './FileLabelsPrint';

const FORM_ID = 'file-labels';
const STORAGE_KEY = 'fileLabelsDraft';
const FONTS = ['Cairo', 'Arial', 'Tahoma', 'Segoe UI'];

type Draft = { sizes: LabelSize[]; rows: LabelRow[]; cutLines: boolean; font: string; bold: boolean };

const newId = () => Math.random().toString(36).slice(2, 10);

// exactly two sizes (only their width / length can be changed)
const DEFAULT_SIZES: LabelSize[] = [
  { id: 's1', name: 'Size 1', width: 7, length: 18.5 },
  { id: 's2', name: 'Size 2', width: 5, length: 18.5 },
];

const DEFAULT_DRAFT: Draft = {
  sizes: DEFAULT_SIZES,
  rows: [{ id: newId(), text: '', sizeId: 's1', copies: 1 }],
  cutLines: true,
  font: 'Cairo',
  bold: true,
};

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Draft>;
    if (!Array.isArray(d.sizes) || !d.sizes.length || !Array.isArray(d.rows)) return null;
    // always the 2 fixed sizes; older drafts keep the measurements of their first 2 sizes
    const old = d.sizes as LabelSize[];
    const sizes = DEFAULT_SIZES.map((def, i) => ({
      ...def,
      width: Number(old[i]?.width) || def.width,
      length: Number(old[i]?.length) || def.length,
    }));
    const map = new Map(old.slice(0, 2).map((s, i) => [s.id, DEFAULT_SIZES[i].id]));
    const rows = (d.rows as LabelRow[]).map((r) => ({ ...r, sizeId: map.get(r.sizeId) || (r.sizeId === 's2' ? 's2' : 's1') }));
    return { ...DEFAULT_DRAFT, ...d, sizes, rows } as Draft;
  } catch {
    return null;
  }
}

export default function FileLabelsPage() {
  return (
    <FormShell<Draft>
      formId={FORM_ID}
      title="File Labels"
      icon={Tag}
      renderNew={(ctx) => <FileLabelsEditor ctx={ctx} />}
      saveLabel="Save & Print"
      downloadLabel="Print"
      onDownload={async (r) => {
        const d = { ...DEFAULT_DRAFT, ...r.DATA };
        printFileLabels({ sizes: d.sizes, rows: d.rows, cutLines: d.cutLines, font: d.font, bold: d.bold });
      }}
    />
  );
}

const CARD = 'bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]';
const INPUT =
  'w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15';
const LABEL = 'text-[11px] font-black text-slate-400 uppercase tracking-widest';

function FileLabelsEditor({ ctx }: { ctx: FormEditorContext<Draft> }) {
  const saved = ctx.editing?.DATA; // a saved list opened for edit (the browser draft is left as it is)
  const [draft, setDraft] = useState<Draft>(saved ? { ...DEFAULT_DRAFT, ...saved } : DEFAULT_DRAFT);
  const [ready, setReady] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const lastInputRef = useRef<HTMLInputElement | null>(null);
  const focusLast = useRef(false);

  useEffect(() => {
    if (ctx.startEmpty) {
      try {
        localStorage.removeItem(STORAGE_KEY); // just saved: start a new list
      } catch {
        // storage not available
      }
    } else if (!saved) {
      const d = readDraft();
      if (d) setDraft(d);
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || saved) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // storage not available
    }
  }, [draft, ready]);

  useEffect(() => {
    if (focusLast.current) {
      focusLast.current = false;
      lastInputRef.current?.focus();
    }
  });

  const { sizes, rows, cutLines, font, bold } = draft;
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const updateRow = (id: string, patch: Partial<LabelRow>) =>
    setDraft((d) => ({ ...d, rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  const updateSize = (id: string, patch: Partial<LabelSize>) =>
    setDraft((d) => ({ ...d, sizes: d.sizes.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const addRow = () => {
    focusLast.current = true;
    setDraft((d) => ({
      ...d,
      rows: [...d.rows, { id: newId(), text: '', sizeId: d.rows[d.rows.length - 1]?.sizeId || d.sizes[0].id, copies: 1 }],
    }));
  };

  const total = useMemo(() => expandLabels({ sizes, rows }).length, [sizes, rows]);

  // Save (shell header button)
  useEffect(() => {
    ctx.registerSave(() => {
      const names = rows.map((r) => r.text.trim()).filter(Boolean);
      if (!names.length) {
        toast.error('Type a file name first');
        return null;
      }
      const first = names.slice(0, 3).join(' · ');
      return {
        TITLE: `${first}${names.length > 3 ? ` +${names.length - 3}` : ''} (${total} label${total === 1 ? '' : 's'})`,
        DOC_DATE: ctx.editing?.DOC_DATE || uaeToday(),
        AMOUNT: null,
        DATA: draft,
        afterSave: () => printFileLabels({ sizes, rows, cutLines, font, bold }),
      };
    });
  });

  const iconBtn = 'w-10 h-10 rounded-xl flex items-center justify-center transition-colors';
  const sizeOptions = sizes.map((s) => ({ value: s.id, label: s.name || 'Unnamed', hint: `${s.width} × ${s.length} cm` }));

  return (
    <div className="space-y-5">
      {ctx.actionsEl && createPortal(<>
        <button
          type="button"
          onClick={() => setShowSizes((v) => !v)}
          className={`${iconBtn} ${showSizes ? 'bg-[#0f0f0f] text-[#D4AF37]' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
          title="Label sizes"
        >
          <Ruler className="w-5 h-5" />
        </button>
      </>, ctx.actionsEl)}

      {/* ── sizes ── */}
      {showSizes && (
        <section className={`${CARD} p-5 space-y-4`}>
          <h2 className="text-base font-black text-slate-900">Label Sizes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sizes.map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                <p className="text-sm font-black text-slate-900 px-1">{s.name}</p>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField label="Width" unit="cm" value={s.width} min={1} max={28} onChange={(v) => updateSize(s.id, { width: v })} />
                  <NumberField label="Length" unit="cm" value={s.length} min={3} max={28} onChange={(v) => updateSize(s.id, { length: v })} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Toggle icon={Scissors} label="Cut lines" checked={cutLines} onChange={(v) => set({ cutLines: v })} />
            <Toggle label="Bold" checked={bold} onChange={(v) => set({ bold: v })} />
            <div className="w-44">
              <Select value={font} onChange={(v) => set({ font: v })} options={FONTS.map((f) => ({ value: f, label: f, style: { fontFamily: f } }))} />
            </div>
          </div>
        </section>
      )}

      {/* ── labels ── */}
      <section className={`${CARD} p-5 space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-center">
              <Tag className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-900">Labels</h2>
              <p className="text-xs font-bold text-slate-400">
                {total} label{total === 1 ? '' : 's'} to print
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addRow}
              className="h-10 px-4 rounded-xl bg-[#0f0f0f] text-[#D4AF37] text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 hover:bg-black shadow"
            >
              <Plus className="w-4 h-4" /> Label
            </button>
          </div>
        </div>

        <div className="hidden sm:grid grid-cols-[2.5rem_1fr_12rem_8.5rem_2.5rem] gap-2 px-1">
          <span className={`${LABEL} text-center`}>#</span>
          <span className={LABEL}>File Name</span>
          <span className={LABEL}>Size</span>
          <span className={`${LABEL} text-center`}>Copies</span>
          <span />
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={r.id}
              className="grid grid-cols-[2.5rem_1fr_2.5rem] sm:grid-cols-[2.5rem_1fr_12rem_8.5rem_2.5rem] gap-2 items-center rounded-2xl sm:rounded-none p-2 sm:p-0 border sm:border-0 border-slate-100"
            >
              <span className="text-xs font-black text-slate-300 text-center">{i + 1}</span>
              <input
                ref={i === rows.length - 1 ? lastInputRef : undefined}
                value={r.text}
                onChange={(e) => updateRow(r.id, { text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addRow();
                  }
                }}
                placeholder="File name"
                dir="auto"
                className={INPUT}
                aria-label="File name"
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    rows: d.rows.length > 1 ? d.rows.filter((x) => x.id !== r.id) : [{ ...r, text: '', copies: 1 }],
                  }))
                }
                title="Remove"
                className="sm:order-last w-10 h-10 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="col-start-2 sm:col-start-auto">
                <Select value={r.sizeId} onChange={(v) => updateRow(r.id, { sizeId: v })} options={sizeOptions} />
              </div>
              <div className="col-start-2 sm:col-start-auto">
                <Stepper value={r.copies} onChange={(v) => updateRow(r.id, { copies: v })} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ───────────────────────── small controls ───────────────────────── */

function NumberField({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <div className="relative mt-1">
        <input
          type="number"
          step="0.1"
          min={min}
          max={max}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            if (Number.isFinite(n) && n >= min && n <= max) onChange(Math.round(n * 10) / 10);
          }}
          onBlur={() => setText(String(value))}
          className={`${INPUT} pr-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{unit}</span>
      </div>
    </label>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const clamp = (n: number) => Math.min(Math.max(Math.round(n) || 1, 1), 99);
  const btn =
    'w-9 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center h-10 rounded-xl border border-slate-200 bg-white overflow-hidden w-full sm:w-auto">
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= 1} title="Less">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="number"
        min={1}
        max={99}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="flex-1 min-w-0 w-10 h-full text-center text-sm font-black text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Copies"
      />
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= 99} title="More">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <label
      className={`flex items-center gap-2.5 h-10 pl-2.5 pr-3.5 rounded-xl border cursor-pointer select-none transition-colors ${
        checked ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40 text-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden="true"
        className={`relative inline-flex w-9 h-5 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#D4AF37] peer-focus-visible:ring-offset-1 ${
          checked ? 'bg-[#0f0f0f]' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform ${checked ? 'translate-x-4 bg-[#D4AF37]' : 'bg-white'}`}
        />
      </span>
      {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      <span className="text-sm font-bold whitespace-nowrap">{label}</span>
    </label>
  );
}

type SelectOption = { value: string; label: string; hint?: string; style?: React.CSSProperties };

function Select({ value, options, onChange }: { value: string; options: SelectOption[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) || options[0];

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

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-10 flex items-center gap-2 px-3 rounded-xl border bg-white text-sm font-semibold text-left transition-all ${
          open ? 'border-[#D4AF37] ring-4 ring-[#D4AF37]/15 text-slate-900' : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <span className="flex-1 min-w-0 truncate" style={selected?.style}>
          {selected?.label}
          {selected?.hint && <span className="ml-1.5 text-xs font-bold text-slate-400">{selected.hint}</span>}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180 text-[#D4AF37]' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 mt-2 min-w-full z-50 bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] overflow-hidden">
          <div className="max-h-72 overflow-y-auto p-1.5">
            {options.map((o) => {
              const isSel = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors ${
                    isSel ? 'bg-[#D4AF37]/10 text-slate-900 font-bold' : 'text-slate-600 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <span className="flex-1 min-w-0 truncate" style={o.style}>
                    {o.label}
                    {o.hint && <span className="ml-1.5 text-xs font-bold text-slate-400">{o.hint}</span>}
                  </span>
                  {isSel && <Check className="w-4 h-4 text-[#D4AF37] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
