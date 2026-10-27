'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Hash, Loader2, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { getNextCreditNoteNumber, saveCreditNote } from '../Service/CreditNoteService';
import { generateCreditNotePdf } from '../Utils/CreditNotePdf';
import {
  DEFAULT_BODY,
  ISSUED_BY,
  ISSUED_TO,
  MAX_LINES,
  amountToWords,
  formatAmount,
  round2,
  uaeToday,
  type CreditNote,
} from '../Utils/CreditNoteTypes';

type FormLine = { key: number; description: string; amount: string };
type Step = 'details' | 'parties' | 'letter' | 'lines';
const STEPS: { id: Step; title: string }[] = [
  { id: 'details', title: 'Details' },
  { id: 'parties', title: 'Parties' },
  { id: 'letter', title: 'Letter' },
  { id: 'lines', title: 'Lines' },
];

interface CreditNoteFormProps {
  editNote?: CreditNote | null; // admin edit
  onSaved: (n: CreditNote, isEdit: boolean) => void;
  onCancelEdit?: () => void;
}

let nextKey = 1;
const emptyLine = (base?: Partial<FormLine>): FormLine => ({ key: nextKey++, description: '', amount: '', ...base });
const parseAmount = (v: string) => round2(Number(String(v).replace(/,/g, '')) || 0);

/** Live thousands separators while typing: "5305.5" → "5,305.5" (max 2 decimals). */
function formatTyping(raw: string): string {
  let v = raw.replace(/[^\d.]/g, '');
  const dot = v.indexOf('.');
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const [int, dec] = v.split('.');
  const intFmt = (int.replace(/^0+(?=\d)/, '') || (dec !== undefined ? '0' : '')).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${intFmt}.${dec}` : intFmt;
}

function onAmountInput(e: React.ChangeEvent<HTMLInputElement>, set: (v: string) => void) {
  const el = e.target;
  const caret = el.selectionStart ?? el.value.length;
  const digitsBefore = el.value.slice(0, caret).replace(/[^\d.]/g, '').length;
  const next = formatTyping(el.value);
  set(next);
  requestAnimationFrame(() => {
    let seen = 0;
    let pos = next.length;
    for (let i = 0; i < next.length; i++) {
      if (seen === digitsBefore) {
        pos = i;
        break;
      }
      if (/[\d.]/.test(next[i])) seen++;
    }
    if (digitsBefore === 0) pos = 0;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // ignore
    }
  });
}

const field =
  'w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052] transition-all';

function SectionHint({ text }: { text: string }) {
  return <p className="mb-4 text-xs font-semibold text-slate-400">{text}</p>;
}

function PartyCard({ tag, p }: { tag: string; p: typeof ISSUED_BY }) {
  return (
    <div className="relative flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white pl-5 pr-4 py-4">
      <span className="absolute left-0 top-4 bottom-4 w-1 rounded-r bg-[#182E56]" />
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C4A052]">{tag}</p>
      <p className="text-sm font-black text-slate-900 mt-1.5 leading-snug">{p.name}</p>
      <div className="mt-2 space-y-0.5 text-xs">
        <p className="text-slate-400 font-semibold">
          Branch: <span className="text-slate-700 font-bold">{p.branch}</span>
        </p>
        <p className="text-slate-400 font-semibold">
          Trade License No.: <span className="text-slate-700 font-bold">{p.license}</span>
        </p>
      </div>
    </div>
  );
}

export default function CreditNoteForm({ editNote = null, onSaved, onCancelEdit }: CreditNoteFormProps) {
  const isEdit = !!editNote;
  const init = () => ({
    date: editNote?.NOTE_DATE || uaeToday(),
    body: editNote?.BODY_TEXT || DEFAULT_BODY,
    lines: editNote?.LINES.length
      ? editNote.LINES.map((l) => emptyLine({ description: l.description, amount: formatAmount(l.amount) }))
      : [emptyLine()],
  });
  const [date, setDate] = useState(init().date);
  const [body, setBody] = useState(init().body);
  const [lines, setLines] = useState<FormLine[]>(init().lines);
  const [nextNo, setNextNo] = useState<string>(editNote?.ID || '');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<Step>('details');
  const [errors, setErrors] = useState<Record<number, { description?: boolean; amount?: boolean }>>({});

  // preview of the number this note will get (shared numbering, per year)
  useEffect(() => {
    if (isEdit || !date) return;
    let alive = true;
    getNextCreditNoteNumber(date)
      .then((n) => alive && setNextNo(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [date, isEdit]);

  const total = useMemo(() => round2(lines.reduce((s, l) => s + parseAmount(l.amount), 0)), [lines]);
  const words = total > 0 ? amountToWords(total) : '';

  const update = (key: number, patch: Partial<FormLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const n = { ...prev, [key]: { ...prev[key] } };
      if ('description' in patch) delete n[key].description;
      if ('amount' in patch) delete n[key].amount;
      return n;
    });
  };

  const reset = () => {
    const i = init();
    setDate(i.date);
    setBody(i.body);
    setLines(i.lines);
    setErrors({});
  };

  const save = async () => {
    const list = lines.filter((l) => l.description.trim() || l.amount.trim());
    if (!list.length) return toast.warning('Add at least one line');
    const errs: Record<number, { description?: boolean; amount?: boolean }> = {};
    list.forEach((l) => {
      const e: { description?: boolean; amount?: boolean } = {};
      if (!l.description.trim()) e.description = true;
      if (!(parseAmount(l.amount) > 0)) e.amount = true;
      if (e.description || e.amount) errs[l.key] = e;
    });
    setErrors(errs);
    if (Object.keys(errs).length) {
      setStep('lines');
      return toast.error('Fill the highlighted fields');
    }
    if (!body.trim()) {
      setStep('letter');
      return toast.error('The credit note text is required');
    }

    setSaving(true);
    try {
      const saved = await saveCreditNote({
        ID: editNote?.ID,
        NOTE_DATE: date,
        BODY_TEXT: body.trim(),
        EXTRA_SIGNERS: [],
        LINES: list.map((l) => ({ description: l.description.trim(), amount: parseAmount(l.amount) })),
      });
      toast.success(`${saved.ID} ${isEdit ? 'updated' : 'saved'} — AED ${formatAmount(saved.TOTAL)}`);
      try {
        await generateCreditNotePdf(saved);
      } catch {
        toast.warning('Saved, but the PDF could not be created — download it from the list');
      }
      if (!isEdit) {
        setLines([emptyLine()]);
        setBody(DEFAULT_BODY);
        setErrors({});
      }
      onSaved(saved, isEdit);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{isEdit ? `Edit ${editNote!.ID}` : 'New Credit Note'}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center disabled:opacity-40"
            title={isEdit ? 'Undo changes' : 'Clear'}
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          {isEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center disabled:opacity-40"
              title="Cancel edit"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-900/20 hover:brightness-105 flex items-center justify-center disabled:opacity-50"
            title={isEdit ? 'Save changes & download PDF' : 'Save & download PDF'}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#182E56]" />
          <div className="h-[2px] bg-[#C4A052]" />

          {/* Sub tabs */}
          <div className="px-5 sm:px-7 pt-5 sm:pt-6">
            <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#F5F7FB] border border-slate-100">
              {STEPS.map((s, i) => {
                const active = step === s.id;
                const flag =
                  (s.id === 'lines' && Object.keys(errors).length > 0) || (s.id === 'letter' && !body.trim());
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={`relative h-11 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${
                      active ? 'bg-[#182E56] text-white shadow-md shadow-[#182E56]/20' : 'text-slate-500 hover:text-slate-900 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center shrink-0 ${
                        active ? 'bg-[#C4A052] text-[#182E56]' : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="truncate">{s.title}</span>
                    {s.id === 'lines' && (
                      <span className={`hidden sm:inline text-[11px] font-bold ${active ? 'text-[#C4A052]' : 'text-slate-400'}`}>{lines.length}</span>
                    )}
                    {flag && <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-red-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {/* 1. Details */}
            {step === 'details' && (
            <section>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
                    <Hash className="w-3 h-3" /> Credit Note No.
                  </p>
                  <p className="mt-1.5 text-base font-black text-[#182E56]">{nextNo || '—'}</p>
                  {!isEdit && <p className="text-[10px] font-semibold text-slate-400">Confirmed on save</p>}
                </div>
                <label className="rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3 block cursor-pointer focus-within:border-[#C4A052] focus-within:ring-4 focus-within:ring-[#C4A052]/15 transition-all">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3" /> Date
                  </span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-transparent text-base font-black text-slate-900 focus:outline-none" />
                </label>
                <div className="rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Currency</p>
                  <p className="mt-1.5 text-base font-black text-slate-900">UAE Dirham (AED)</p>
                </div>
              </div>

            </section>
            )}

            {/* 2. Parties */}
            {step === 'parties' && (
            <section>
              <SectionHint text="Fixed for every credit note" />
              <div className="flex flex-col md:flex-row items-stretch gap-3">
                <PartyCard tag="From" p={ISSUED_BY} />
                <div className="hidden md:flex items-center">
                  <span className="w-9 h-9 rounded-full bg-[#C4A052]/15 text-[#C4A052] flex items-center justify-center">
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
                <PartyCard tag="To" p={ISSUED_TO} />
              </div>
            </section>
            )}

            {/* 3. Letter */}
            {step === 'letter' && (
            <section>
              <SectionHint text="Printed after “Dear,”" />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                dir="auto"
                maxLength={1500}
                className={`${field} px-4 py-3 leading-relaxed resize-y`}
              />
            </section>
            )}

            {/* 4. Lines */}
            {step === 'lines' && (
            <section>
              <SectionHint text={`${lines.length} / ${MAX_LINES} lines`} />
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="hidden sm:grid grid-cols-[52px_minmax(0,1fr)_190px_44px] bg-[#182E56] text-[10px] font-black uppercase tracking-[0.18em] text-white">
                  <span className="py-3 text-center">No.</span>
                  <span className="py-3 text-center">Description</span>
                  <span className="py-3 text-center">Amount (AED)</span>
                  <span />
                </div>
                <div className="divide-y divide-slate-100">
                  {lines.map((l, i) => (
                    <div key={l.key} className={`grid grid-cols-[40px_minmax(0,1fr)_44px] sm:grid-cols-[52px_minmax(0,1fr)_190px_44px] gap-y-2 items-start px-2 sm:px-0 py-3 ${i % 2 ? 'bg-[#FAFBFD]' : 'bg-white'}`}>
                      <span className="pt-3 text-center text-sm font-black text-[#C4A052]">{String(i + 1).padStart(2, '0')}</span>
                      <div className="sm:px-2">
                        <textarea
                          value={l.description}
                          onChange={(e) => update(l.key, { description: e.target.value })}
                          rows={1}
                          dir="auto"
                          maxLength={500}
                          placeholder="Description"
                          className={`${field} px-3.5 py-2.5 min-h-[44px] max-h-40 field-sizing-content resize-none ${errors[l.key]?.description ? '!border-red-400 !bg-red-50/40' : ''}`}
                        />
                      </div>
                      <div className="col-start-2 sm:col-start-auto sm:px-2">
                        <input
                          value={l.amount}
                          onChange={(e) => onAmountInput(e, (v) => update(l.key, { amount: v }))}
                          onBlur={() => l.amount && update(l.key, { amount: parseAmount(l.amount) ? formatAmount(parseAmount(l.amount)) : '' })}
                          inputMode="decimal"
                          placeholder="0.00"
                          className={`${field} h-11 px-3.5 text-center font-black ${errors[l.key]?.amount ? '!border-red-400 !bg-red-50/40' : ''}`}
                        />
                      </div>
                      <div className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto flex justify-center">
                        <button
                          type="button"
                          onClick={() => setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((x) => x.key !== l.key)))}
                          className="w-9 h-11 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50"
                          title="Remove line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setLines((prev) => (prev.length >= MAX_LINES ? prev : [...prev, emptyLine()]))}
                  disabled={lines.length >= MAX_LINES}
                  className="w-full py-3 border-t border-dashed border-slate-200 text-sm font-black text-[#182E56] hover:bg-[#C4A052]/5 flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4 text-[#C4A052]" /> Add Line
                </button>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[52px_minmax(0,1fr)_190px_44px] items-center bg-[#182E56] text-white">
                  <span className="hidden sm:block" />
                  <span className="px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-[#C4A052] sm:text-right">Total Amount Credited</span>
                  <span className="px-4 sm:px-2 py-3.5 text-center text-base font-black whitespace-nowrap">{formatAmount(total)}</span>
                  <span className="hidden sm:block" />
                </div>
              </div>
              {words && (
                <p className="mt-3 text-sm text-slate-500">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#182E56] mr-2">Amount in words</span>
                  <span className="italic text-slate-700">{words}</span>
                </p>
              )}
            </section>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
