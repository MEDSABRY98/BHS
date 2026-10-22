'use client';

// Supplier Payment (cheque or bank transfer): fill the form and download the PDF.
// Nothing is saved in the database.

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Banknote, CalendarDays, FileDown, Landmark, Loader2, RotateCcw } from 'lucide-react';
import Login from '@/app/Components/Auth/Login';
import MainLoader from '@/app/Components/Loading/MainLoader';
import TabLoader from '@/app/Components/Loading/TabLoader';
import { toast } from '@/app/Components/Notification';
import { restoreSessionUser } from '@/app/Components/Auth/sessionClient';
import { useSyncLiveUser } from '@/app/Components/Auth/AppSessionProvider';
import { useModuleTabAudit } from '@/app/AdminControl/Code/Audit/useModuleTabAudit';
import { getAllowedForms } from '../Shared/FormsAccess';
import { amountToWords, formatAmount, round2, uaeToday } from '../EmployeeCharge/Utils/EmployeeChargeTypes';
import { PAYMENT_METHODS, SUPPLIER_PAYMENT_FORM_ID, type PaymentMethod } from './SupplierPaymentTypes';
import { listPaymentSuppliers, type PaymentSupplier } from './Service/SupplierPaymentService';
import NiceSelect from '@/app/ScheduledReports/Components/NiceSelect';

export default function SupplierPaymentPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [, setCurrentUser] = useState<any>(null);
  useSyncLiveUser(setCurrentUser);
  useModuleTabAudit('Supplier Payment');
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const loadAccess = useCallback(async () => {
    try {
      setAllowed((await getAllowedForms()).includes(SUPPLIER_PAYMENT_FORM_ID));
    } catch {
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const user = await restoreSessionUser();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadAccess();
        }
      } finally {
        setIsChecking(false);
      }
    })();
  }, [loadAccess]);

  if (isChecking) return <MainLoader message="Loading Supplier Payment..." />;
  if (!isAuthenticated)
    return (
      <Login
        onLogin={async (user: any) => {
          setIsAuthenticated(true);
          setCurrentUser(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
          await loadAccess();
        }}
      />
    );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-black">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => (window.location.href = '/Forms')}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center transition-colors"
            title="All Forms"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl sm:text-3xl font-normal text-black tracking-tighter">Supplier Payment</h1>
        </div>
        {allowed === null ? (
          <TabLoader className="!min-h-[60vh]" />
        ) : !allowed ? (
          <div className="p-20 text-center font-bold text-slate-400">You don&apos;t have permission to use this form.</div>
        ) : (
          <SupplierPaymentForm />
        )}
      </div>
    </div>
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

function SupplierPaymentForm() {
  const [date, setDate] = useState(uaeToday());
  const [supplier, setSupplier] = useState('');
  const [suppliers, setSuppliers] = useState<PaymentSupplier[] | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cheque');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
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

  const download = async () => {
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
      return;
    }

    setBusy(true);
    try {
      const { generateSupplierPaymentPdf } = await import('./SupplierPaymentPdf');
      await generateSupplierPaymentPdf({
        DATE: date,
        SUPPLIER_NAME: supplier.trim(),
        PERIOD_FROM: from,
        PERIOD_TO: to,
        AMOUNT: value,
        PAYMENT_TERM: paymentTerm.trim(),
        METHOD: method,
        DUE_DATE: isCheque ? dueDate : null,
        NOTES: notes.trim(),
      });
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the PDF');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center disabled:opacity-40"
          title="Clear"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={busy}
          className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white text-sm font-black shadow-lg shadow-amber-900/20 hover:brightness-105 inline-flex items-center gap-2 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Download PDF
        </button>
      </div>

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
