'use client';

// Supplier Payment (cheque or bank transfer): fill the form, download the PDF and save it to the archive.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Banknote, CalendarDays, FileDown, Landmark, Loader2, RotateCcw } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import FormShell from '../Shared/FormShell';
import { amountToWords, formatAmount, formatDate, round2, uaeToday } from '../Shared/FormsUtils';
import type { FormEditorContext } from '../Shared/FormsArchiveTypes';
import { PAYMENT_METHODS, SUPPLIER_PAYMENT_FORM_ID, type PaymentMethod, type SupplierPayment } from './SupplierPaymentTypes';
import { listPaymentSuppliers, type PaymentSupplier } from './Service/SupplierPaymentService';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';

export default function SupplierPaymentPage() {
  return (
    <FormShell<SupplierPayment>
      formId={SUPPLIER_PAYMENT_FORM_ID}
      title="Supplier Payment"
      icon={Banknote}
      maxWidth="max-w-[1000px]"
      renderNew={(ctx) => <SupplierPaymentForm ctx={ctx} />}
      onDownload={async (r) => {
        const { generateSupplierPaymentPdf } = await import('./SupplierPaymentPdf');
        await generateSupplierPaymentPdf(r.DATA);
      }}
    />
  );
}

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

const field =
  'w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052] transition-all';
const labelCls = 'block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2';

function SupplierPaymentForm({ ctx }: { ctx: FormEditorContext<SupplierPayment> }) {
  const { actionsEl } = ctx;
  const init = ctx.editing?.DATA; // a saved form opened for edit
  const [date, setDate] = useState(init?.DATE || uaeToday());
  const [supplier, setSupplier] = useState(init?.SUPPLIER_NAME || '');
  const [suppliers, setSuppliers] = useState<PaymentSupplier[] | null>(null);
  const [from, setFrom] = useState(init?.PERIOD_FROM || '');
  const [to, setTo] = useState(init?.PERIOD_TO || '');
  const [amount, setAmount] = useState(init?.AMOUNT ? formatAmount(init.AMOUNT) : '');
  const [paymentTerm, setPaymentTerm] = useState(init?.PAYMENT_TERM || '');
  const [method, setMethod] = useState<PaymentMethod>(init?.METHOD || 'cheque');
  const [dueDate, setDueDate] = useState(init?.DUE_DATE || '');
  const [notes, setNotes] = useState(init?.NOTES || '');
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // suppliers dropdown (Data Base → Suppliers)
  useEffect(() => {
    listPaymentSuppliers()
      .then(setSuppliers)
      .catch((e: any) => {
        setSuppliers([]);
        toast.error(e?.message || 'Could not load the suppliers');
      });
  }, []);

  /** picking a supplier fills its payment term (can still be changed) */
  const pickSupplier = (name: string) => {
    setSupplier(name);
    clearErr('supplier');
    const s = suppliers?.find((x) => x.name === name);
    setPaymentTerm(s && s.paymentTerm > 0 ? `${s.paymentTerm} days` : '');
  };

  const value = parseAmount(amount);
  const isCheque = method === 'cheque';
  const clearErr = (k: string) => setErrors((p) => ({ ...p, [k]: false }));
  const err = (k: string) => (errors[k] ? '!border-red-400 !bg-red-50/40' : '');

  const reset = () => {
    setDate(uaeToday());
    setSupplier('');
    setFrom('');
    setTo('');
    setAmount('');
    setPaymentTerm('');
    setMethod('cheque');
    setDueDate('');
    setNotes('');
    setErrors({});
  };

  /** the filled form, or null (fields highlighted) */
  const read = (): SupplierPayment | null => {
    const errs: Record<string, boolean> = {};
    if (!date) errs.date = true;
    if (!supplier.trim()) errs.supplier = true;
    if (!from) errs.from = true;
    if (!to || (from && to < from)) errs.to = true;
    if (!(value > 0)) errs.amount = true;
    if (isCheque && !dueDate) errs.dueDate = true;
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(errs.to && from && to && to < from ? 'The period end must be on or after its start' : 'Fill the highlighted fields');
      return null;
    }
    return {
      DATE: date,
      SUPPLIER_NAME: supplier.trim(),
      PERIOD_FROM: from,
      PERIOD_TO: to,
      AMOUNT: value,
      PAYMENT_TERM: paymentTerm.trim(),
      METHOD: method,
      DUE_DATE: isCheque ? dueDate : null,
      NOTES: notes.trim(),
    };
  };

  // Save (shell header button)
  useEffect(() => {
    ctx.registerSave(() => {
      const f = read();
      return f && { TITLE: `${f.SUPPLIER_NAME} · ${formatDate(f.PERIOD_FROM)} – ${formatDate(f.PERIOD_TO)}`, DOC_DATE: f.DATE, AMOUNT: f.AMOUNT, DATA: f };
    });
  });

  const download = async () => {
    const f = read();
    if (!f) return;
    setBusy(true);
    try {
      const { generateSupplierPaymentPdf } = await import('./SupplierPaymentPdf');
      await generateSupplierPaymentPdf(f);
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {actionsEl &&
        createPortal(
          <>
            <button
              type="button"
              onClick={() => void download()}
              disabled={busy}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-900/20 hover:brightness-105 flex items-center justify-center disabled:opacity-50"
              title="Download PDF"
              aria-label="Download PDF"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center disabled:opacity-40"
              title="Clear"
              aria-label="Clear"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </>,
          actionsEl,
        )}

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#182E56]" />
        <div className="h-[2px] bg-[#C4A052]" />

        <div className="p-5 sm:p-7 space-y-6">
          {/* Date / Payment method / Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className={`rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3 block cursor-pointer focus-within:border-[#C4A052] focus-within:ring-4 focus-within:ring-[#C4A052]/15 transition-all ${err('date')}`}>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
                <CalendarDays className="w-3 h-3" /> Date
              </span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-transparent text-base font-black text-slate-900 focus:outline-none" />
            </label>
            <div className="rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Payment Method</p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const sel = method === m.id;
                  const Icon = m.id === 'cheque' ? Banknote : Landmark;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMethod(m.id);
                        clearErr('dueDate');
                      }}
                      className={`h-8 rounded-lg text-xs font-black inline-flex items-center justify-center gap-1.5 transition-all ${
                        sel ? 'bg-[#182E56] text-[#C4A052]' : 'bg-white text-slate-500 border border-slate-200 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Currency</p>
              <p className="mt-1.5 text-base font-black text-slate-900">UAE Dirham (AED)</p>
            </div>
          </div>

          {/* Supplier · Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Supplier Name *</label>
              <div className={errors.supplier ? 'rounded-xl ring-2 ring-red-300' : ''}>
                <NiceSelect
                  value={supplier}
                  onChange={pickSupplier}
                  disabled={!suppliers}
                  searchPlaceholder="Search supplier..."
                  options={[
                    ...(!suppliers ? [{ value: '', label: 'Loading suppliers...' }] : !supplier ? [{ value: '', label: 'Choose a supplier' }] : []),
                    ...(suppliers || []).map((s) => ({ value: s.name, label: s.name, hint: s.paymentTerm ? `${s.paymentTerm} days` : undefined })),
                  ]}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Amount (AED) *</label>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(formatTyping(e.target.value));
                  clearErr('amount');
                }}
                onBlur={() => amount && setAmount(value ? formatAmount(value) : '')}
                inputMode="decimal"
                placeholder="0.00"
                className={`${field} h-12 px-4 text-center text-lg font-black ${err('amount')}`}
              />
            </div>
          </div>
          {value > 0 && <p className="-mt-3 text-xs font-semibold italic text-slate-400">{amountToWords(value)}</p>}

          {/* Period · Payment term · Due date */}
          <div className={`grid grid-cols-1 gap-4 ${isCheque ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <div>
              <label className={labelCls}>Period From *</label>
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  clearErr('from');
                }}
                className={`${field} h-12 px-4 ${err('from')}`}
              />
            </div>
            <div>
              <label className={labelCls}>Period To *</label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => {
                  setTo(e.target.value);
                  clearErr('to');
                }}
                className={`${field} h-12 px-4 ${err('to')}`}
              />
            </div>
            <div>
              <label className={labelCls}>Payment Term</label>
              <input
                value={paymentTerm}
                onChange={(e) => setPaymentTerm(e.target.value)}
                dir="auto"
                maxLength={60}
                placeholder="e.g. 60 days"
                className={`${field} h-12 px-4`}
              />
            </div>
            {isCheque && (
              <div>
                <label className={labelCls}>Cheque Due Date *</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    clearErr('dueDate');
                  }}
                  className={`${field} h-12 px-4 ${err('dueDate')}`}
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              dir="auto"
              maxLength={2000}
              placeholder="Optional — invoices covered, bank details, remarks…"
              className={`${field} px-4 py-3 leading-relaxed resize-y`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
