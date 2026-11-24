'use client';

// Supplier Clearance: a checkpoint list (returns, quality, deliveries, settlement) answered Yes / No
// before a supplier is cleared; the responsibility goes to the Warehouse Manager and the Supply Chain Manager.
// Fill the form, download the PDF and save it to the archive.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, RotateCcw, ShieldCheck } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';
import FormShell from '../Shared/FormShell';
import { formatDate, uaeToday } from '../Shared/FormsUtils';
import type { FormEditorContext } from '../Shared/FormsArchiveTypes';
import {
  ANSWERS,
  CHECKPOINTS,
  DECISIONS,
  SUPPLIER_CLEARANCE_FORM_ID,
  type ClearanceAnswer,
  type ClearanceDecision,
  type SupplierClearance,
} from './SupplierClearanceTypes';
import { listClearanceSuppliers, type ClearanceSupplier } from './Service/SupplierClearanceService';

export default function SupplierClearancePage() {
  return (
    <FormShell<SupplierClearance>
      formId={SUPPLIER_CLEARANCE_FORM_ID}
      title="Supplier Clearance"
      icon={ShieldCheck}
      maxWidth="max-w-[1000px]"
      saveLabel="Save & PDF"
      renderNew={(ctx) => <SupplierClearanceForm ctx={ctx} />}
      onDownload={async (r) => {
        const { generateSupplierClearancePdf } = await import('./SupplierClearancePdf');
        await generateSupplierClearancePdf(r.DATA);
      }}
    />
  );
}

const field =
  'w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052] transition-all';
const labelCls = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';

const ANSWER_STYLE: Record<ClearanceAnswer, string> = {
  yes: 'bg-emerald-600 text-white border-emerald-600',
  no: 'bg-red-600 text-white border-red-600',
  na: 'bg-slate-600 text-white border-slate-600',
};

function SupplierClearanceForm({ ctx }: { ctx: FormEditorContext<SupplierClearance> }) {
  const { actionsEl } = ctx;
  const init = ctx.editing?.DATA; // a saved form opened for edit
  const savedItem = (id: string) => init?.ITEMS?.find((i) => i.ID === id);

  const [date, setDate] = useState(init?.DATE || uaeToday());
  const [supplier, setSupplier] = useState(init?.SUPPLIER_NAME || '');
  const [suppliers, setSuppliers] = useState<ClearanceSupplier[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, ClearanceAnswer | ''>>(() =>
    Object.fromEntries(CHECKPOINTS.map((c) => [c.id, savedItem(c.id)?.ANSWER || ''])),
  );
  const [remarks, setRemarks] = useState<Record<string, string>>(() => Object.fromEntries(CHECKPOINTS.map((c) => [c.id, savedItem(c.id)?.REMARK || ''])));
  const [decision, setDecision] = useState<ClearanceDecision | ''>(init?.DECISION || '');
  const [notes, setNotes] = useState(init?.NOTES || '');
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    listClearanceSuppliers()
      .then(setSuppliers)
      .catch((e: any) => {
        setSuppliers([]);
        toast.error(e?.message || 'Could not load the suppliers');
      });
  }, []);

  const clearErr = (k: string) => setErrors((p) => ({ ...p, [k]: false }));
  const err = (k: string) => (errors[k] ? '!border-red-400 !bg-red-50/40' : '');

  const sections = useMemo(() => {
    const out: { name: string; items: typeof CHECKPOINTS }[] = [];
    CHECKPOINTS.forEach((c) => {
      const last = out[out.length - 1];
      if (last && last.name === c.section) last.items.push(c);
      else out.push({ name: c.section, items: [c] });
    });
    return out;
  }, []);

  const answered = CHECKPOINTS.filter((c) => answers[c.id]).length;
  const noCount = CHECKPOINTS.filter((c) => answers[c.id] === 'no').length;

  const setAnswer = (id: string, a: ClearanceAnswer) => {
    setAnswers((p) => ({ ...p, [id]: a }));
    clearErr(id);
    clearErr(`remark-${id}`);
  };
  const markAll = (a: ClearanceAnswer) => {
    setAnswers(Object.fromEntries(CHECKPOINTS.map((c) => [c.id, a])));
    setErrors({});
  };

  const reset = () => {
    setDate(uaeToday());
    setSupplier('');
    setAnswers(Object.fromEntries(CHECKPOINTS.map((c) => [c.id, ''])));
    setRemarks(Object.fromEntries(CHECKPOINTS.map((c) => [c.id, ''])));
    setDecision('');
    setNotes('');
    setErrors({});
  };

  /** the filled form, or null (fields highlighted) */
  const read = (): SupplierClearance | null => {
    const errs: Record<string, boolean> = {};
    if (!date) errs.date = true;
    if (!supplier.trim()) errs.supplier = true;
    CHECKPOINTS.forEach((c) => {
      if (!answers[c.id]) errs[c.id] = true;
      else if (answers[c.id] === 'no' && !remarks[c.id].trim()) errs[`remark-${c.id}`] = true;
    });
    if (!decision) errs.decision = true;
    setErrors(errs);
    if (Object.keys(errs).length) {
      if (CHECKPOINTS.some((c) => errs[`remark-${c.id}`])) toast.error('Write a remark for every checkpoint answered "No"');
      else toast.error('Fill the highlighted fields');
      return null;
    }
    if (decision === 'cleared' && noCount > 0) {
      setErrors({ decision: true });
      toast.error('A checkpoint is answered "No": choose "Cleared with conditions" or "Not cleared"');
      return null;
    }
    return {
      DATE: date,
      SUPPLIER_NAME: supplier.trim(),
      ITEMS: CHECKPOINTS.map((c) => ({ ID: c.id, SECTION: c.section, TEXT: c.text, ANSWER: answers[c.id] as ClearanceAnswer, REMARK: remarks[c.id].trim() })),
      DECISION: decision as ClearanceDecision,
      NOTES: notes.trim(),
    };
  };

  // Save (shell header button)
  useEffect(() => {
    ctx.registerSave(() => {
      const f = read();
      return (
        f && {
          TITLE: `${f.SUPPLIER_NAME} · ${formatDate(f.DATE)}`,
          DOC_DATE: f.DATE,
          AMOUNT: null,
          DATA: f,
          afterSave: async () => {
            const { generateSupplierClearancePdf } = await import('./SupplierClearancePdf');
            await generateSupplierClearancePdf(f);
          },
        }
      );
    });
  });

  return (
    <div className="space-y-4">
      {actionsEl &&
        createPortal(
          <button
            type="button"
            onClick={reset}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center"
            title="Clear"
            aria-label="Clear"
          >
            <RotateCcw className="w-4 h-4" />
          </button>,
          actionsEl,
        )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#182E56]" />
        <div className="h-[2px] bg-[#C4A052]" />

        <div className="p-5 sm:p-7 space-y-6">
          {/* Date · Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className={`rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3 block cursor-pointer focus-within:border-[#C4A052] focus-within:ring-4 focus-within:ring-[#C4A052]/15 transition-all ${err('date')}`}>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> Date
              </span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-transparent text-base font-black text-slate-900 focus:outline-none" />
            </label>
            <div className="sm:col-span-2">
              <label className={labelCls}>Supplier Name *</label>
              <div className={errors.supplier ? 'rounded-xl ring-2 ring-red-300' : ''}>
                <NiceSelect
                  value={supplier}
                  onChange={(v: string) => {
                    setSupplier(v);
                    clearErr('supplier');
                  }}
                  disabled={!suppliers}
                  searchPlaceholder="Search supplier..."
                  options={[
                    ...(!suppliers ? [{ value: '', label: 'Loading suppliers...' }] : !supplier ? [{ value: '', label: 'Choose a supplier' }] : []),
                    ...(suppliers || []).map((s) => ({ value: s.name, label: s.name })),
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Checkpoints */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900">
                Checkpoints <span className="ml-1 text-xs font-bold text-slate-400">{answered} / {CHECKPOINTS.length} answered</span>
              </p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => markAll('yes')} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-bold text-emerald-700 hover:bg-emerald-50">
                  All Yes
                </button>
              </div>
            </div>

            {sections.map((s) => (
              <div key={s.name} className="rounded-2xl border border-slate-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-[#182E56] text-[#C4A052] text-[11px] font-black uppercase tracking-[0.18em]">{s.name}</div>
                <div className="divide-y divide-slate-100">
                  {s.items.map((c) => {
                    const a = answers[c.id];
                    return (
                      <div key={c.id} className={`p-4 space-y-2.5 ${errors[c.id] ? 'bg-red-50/50' : ''}`}>
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <p className="flex-1 text-sm font-semibold text-slate-800 leading-relaxed">{c.text}</p>
                          <div className="flex gap-1.5 shrink-0">
                            {ANSWERS.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => setAnswer(c.id, o.id)}
                                className={`h-9 w-16 rounded-lg border text-xs font-black transition-all ${a === o.id ? ANSWER_STYLE[o.id] : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'}`}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          value={remarks[c.id]}
                          onChange={(e) => {
                            setRemarks((p) => ({ ...p, [c.id]: e.target.value }));
                            clearErr(`remark-${c.id}`);
                          }}
                          dir="auto"
                          maxLength={300}
                          placeholder={a === 'no' ? 'Remark (required)' : 'Remark (optional)'}
                          className={`${field} h-10 px-3 text-xs ${err(`remark-${c.id}`)}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Decision */}
          <div>
            <label className={labelCls}>Decision *</label>
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-2 ${errors.decision ? 'rounded-xl ring-2 ring-red-300 p-1' : ''}`}>
              {DECISIONS.map((d) => {
                const sel = decision === d.id;
                const tone = d.id === 'cleared' ? 'bg-emerald-600 border-emerald-600' : d.id === 'conditional' ? 'bg-amber-500 border-amber-500' : 'bg-red-600 border-red-600';
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDecision(d.id);
                      clearErr('decision');
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${sel ? `${tone} text-white` : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                  >
                    <span className="block text-sm font-black">{d.label}</span>
                    <span className={`block text-[11px] font-semibold mt-0.5 ${sel ? 'text-white/85' : 'text-slate-400'}`}>{d.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              dir="auto"
              maxLength={2000}
              placeholder="Optional — anything else the Warehouse Manager and the Supply Chain Manager should know…"
              className={`${field} px-4 py-3 leading-relaxed resize-y`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
