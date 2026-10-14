'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { getNextDebitNoteNumber, saveDebitNote } from '../Service/DebitNoteService';
import { generateDebitNotePdf } from '../Utils/DebitNotePdf';
import {
  DEFAULT_BODY,
  ISSUED_BY,
  ISSUED_TO,
  MAX_LINES,
  amountToWords,
  formatAmount,
  round2,
  uaeToday,
  type DebitNote,
} from '../Utils/DebitNoteTypes';

type FormLine = { key: number; description: string; amount: string };

interface DebitNoteFormProps {
  editNote?: DebitNote | null; // admin edit
  onSaved: (n: DebitNote, isEdit: boolean) => void;
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

const input =
  'w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F3864]/25 focus:border-[#1F3864]/40 transition-all';

function PartyBox({ title, p }: { title: string; p: typeof ISSUED_BY }) {
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
      <div className="bg-[#1F3864] px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] text-white">{title}</div>
      <div className="px-4 py-3">
        <p className="text-sm font-black text-slate-900">{p.name}</p>
        <p className="text-xs font-semibold text-slate-500 mt-1">
          <span className="font-black text-slate-400">Branch:</span> {p.branch}
        </p>
        <p className="text-xs font-semibold text-slate-500">
          <span className="font-black text-slate-400">Trade License No.:</span> {p.license}
        </p>
      </div>
    </div>
  );
}

export default function DebitNoteForm({ editNote = null, onSaved, onCancelEdit }: DebitNoteFormProps) {
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
  const [errors, setErrors] = useState<Record<number, { description?: boolean; amount?: boolean }>>({});

  // preview of the number this note will get (shared numbering, per year)
  useEffect(() => {
    if (isEdit || !date) return;
    let alive = true;
    getNextDebitNoteNumber(date)
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
    if (Object.keys(errs).length) return toast.error('Fill the highlighted fields');
    if (!body.trim()) return toast.error('The debit note text is required');

    setSaving(true);
    try {
      const saved = await saveDebitNote({
        ID: editNote?.ID,
        NOTE_DATE: date,
        BODY_TEXT: body.trim(),
        LINES: list.map((l) => ({ description: l.description.trim(), amount: parseAmount(l.amount) })),
      });
      toast.success(`${saved.ID} ${isEdit ? 'updated' : 'saved'} — AED ${formatAmount(saved.TOTAL)}`);
      try {
        await generateDebitNotePdf(saved);
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
        <div className="flex items-center gap-3 min-w-0">
          {isEdit && (
            <span className="w-11 h-11 rounded-2xl bg-[#1F3864] text-white flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5" />
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{isEdit ? `Edit ${editNote!.ID}` : 'New Debit Note'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3.5 py-2 rounded-xl bg-[#1F3864] text-sm font-black text-white shadow-sm">AED {formatAmount(total)}</span>
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

      {/* Number / Date + parties */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Debit Note No.</label>
            <div className="h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center text-sm font-black text-[#1F3864]">
              {nextNo || '—'}
              {!isEdit && <span className="ml-2 text-[11px] font-semibold text-slate-400">(given on save)</span>}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PartyBox title="Issued By" p={ISSUED_BY} />
          <PartyBox title="Issued To" p={ISSUED_TO} />
        </div>
        <div>
          <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Text (after “Dear Sirs,”)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            dir="auto"
            maxLength={1500}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1F3864]/25"
          />
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-[#1F3864] text-[11px] font-black uppercase tracking-[0.15em] text-white text-center">
                <th className="py-3.5 px-2 w-12">No.</th>
                <th className="py-3.5 px-2">Description</th>
                <th className="py-3.5 px-2 w-[190px]">Amount (AED)</th>
                <th className="py-3.5 px-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((l, i) => (
                <tr key={l.key}>
                  <td className="py-3 px-2 text-center font-black text-slate-400 align-top pt-5">{i + 1}</td>
                  <td className="py-3 px-2">
                    <textarea
                      value={l.description}
                      onChange={(e) => update(l.key, { description: e.target.value })}
                      rows={2}
                      dir="auto"
                      maxLength={500}
                      className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 resize-y focus:outline-none focus:ring-2 focus:ring-[#1F3864]/25 focus:border-[#1F3864]/40 ${errors[l.key]?.description ? '!border-red-400 bg-red-50/40' : ''}`}
                    />
                  </td>
                  <td className="py-3 px-2 align-top">
                    <input
                      value={l.amount}
                      onChange={(e) => onAmountInput(e, (v) => update(l.key, { amount: v }))}
                      onBlur={() => l.amount && update(l.key, { amount: parseAmount(l.amount) ? formatAmount(parseAmount(l.amount)) : '' })}
                      inputMode="decimal"
                      placeholder="0.00"
                      className={`${input} text-right font-black ${errors[l.key]?.amount ? '!border-red-400 bg-red-50/40' : ''}`}
                    />
                  </td>
                  <td className="py-3 px-2 align-top">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => (prev.length === 1 ? [emptyLine()] : prev.filter((x) => x.key !== l.key)))}
                      className="w-9 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Remove line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200">
                <td colSpan={2} className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => (prev.length >= MAX_LINES ? prev : [...prev, emptyLine()]))}
                      disabled={lines.length >= MAX_LINES}
                      className="h-9 px-4 rounded-xl bg-white border border-[#1F3864]/30 text-[#1F3864] text-sm font-black hover:bg-[#1F3864]/5 flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" /> Add Line
                    </button>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Total Amount Debited</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right font-black text-slate-900 whitespace-nowrap">{formatAmount(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {words && (
        <p className="text-sm text-slate-600">
          <span className="font-black text-slate-800">Amount in words: </span>
          <span className="italic">{words}</span>
        </p>
      )}
    </div>
  );
}
