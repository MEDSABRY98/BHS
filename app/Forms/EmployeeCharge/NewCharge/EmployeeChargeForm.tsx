'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Hash, Loader2, RotateCcw, Save, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { getNextEmployeeChargeNumber, saveEmployeeCharge } from '../Service/EmployeeChargeService';
import { generateEmployeeChargePdf } from '../Utils/EmployeeChargePdf';
import { ACKNOWLEDGEMENT, formatAmount, round2, uaeToday, type EmployeeCharge } from '../Utils/EmployeeChargeTypes';

interface EmployeeChargeFormProps {
  editItem?: EmployeeCharge | null; // admin edit
  onSaved: (c: EmployeeCharge, isEdit: boolean) => void;
  onCancelEdit?: () => void;
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

export default function EmployeeChargeForm({ editItem = null, onSaved, onCancelEdit }: EmployeeChargeFormProps) {
  const isEdit = !!editItem;
  const init = () => ({
    date: editItem?.CHARGE_DATE || uaeToday(),
    name: editItem?.EMPLOYEE_NAME || '',
    no: editItem?.EMPLOYEE_NO || '',
    amount: editItem ? formatAmount(editItem.AMOUNT) : '',
    description: editItem?.DESCRIPTION || '',
  });
  const [date, setDate] = useState(init().date);
  const [name, setName] = useState(init().name);
  const [no, setNo] = useState(init().no);
  const [amount, setAmount] = useState(init().amount);
  const [description, setDescription] = useState(init().description);
  const [nextNo, setNextNo] = useState(editItem?.ID || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  // preview of the number this form will get (shared numbering, per year)
  useEffect(() => {
    if (isEdit || !date) return;
    let alive = true;
    getNextEmployeeChargeNumber(date)
      .then((n) => alive && setNextNo(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [date, isEdit]);

  const value = parseAmount(amount);

  const reset = () => {
    const i = init();
    setDate(i.date);
    setName(i.name);
    setNo(i.no);
    setAmount(i.amount);
    setDescription(i.description);
    setErrors({});
  };

  const save = async () => {
    const errs: Record<string, boolean> = {};
    if (!date) errs.date = true;
    if (!name.trim()) errs.name = true;
    if (!(value > 0)) errs.amount = true;
    if (!description.trim()) errs.description = true;
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('Fill the highlighted fields');

    setSaving(true);
    try {
      const saved = await saveEmployeeCharge({
        ID: editItem?.ID,
        CHARGE_DATE: date,
        EMPLOYEE_NAME: name.trim(),
        EMPLOYEE_NO: no.trim(),
        AMOUNT: value,
        DESCRIPTION: description.trim(),
      });
      toast.success(`${saved.ID} ${isEdit ? 'updated' : 'saved'} — AED ${formatAmount(saved.AMOUNT)}`);
      try {
        await generateEmployeeChargePdf(saved);
      } catch {
        toast.warning('Saved, but the PDF could not be created — download it from Charges');
      }
      if (!isEdit) {
        setName('');
        setNo('');
        setAmount('');
        setDescription('');
        setErrors({});
      }
      onSaved(saved, isEdit);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const err = (k: string) => (errors[k] ? '!border-red-400 !bg-red-50/40' : '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{isEdit ? `Edit ${editItem!.ID}` : 'New Employee Charge'}</h1>
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

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-[#182E56]" />
        <div className="h-[2px] bg-[#C4A052]" />

        <div className="p-5 sm:p-7 space-y-6">
          {/* Number / date / currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 flex items-center gap-1.5">
                <Hash className="w-3 h-3" /> Form No.
              </p>
              <p className="mt-1.5 text-base font-black text-[#182E56]">{nextNo || '—'}</p>
              {!isEdit && <p className="text-[10px] font-semibold text-slate-400">Confirmed on save</p>}
            </div>
            <label className={`rounded-2xl bg-[#F5F7FB] border border-slate-100 px-4 py-3 block cursor-pointer focus-within:border-[#C4A052] focus-within:ring-4 focus-within:ring-[#C4A052]/15 transition-all ${err('date')}`}>
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

          {/* Employee name · number · amount (equal widths; amount in words is printed on the PDF only) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Employee Name *</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((p) => ({ ...p, name: false }));
                }}
                dir="auto"
                maxLength={200}
                placeholder="Full name"
                className={`${field} h-12 px-4 ${err('name')}`}
              />
            </div>
            <div>
              <label className={labelCls}>Employee No.</label>
              <input value={no} onChange={(e) => setNo(e.target.value)} maxLength={50} placeholder="Optional" className={`${field} h-12 px-4`} />
            </div>
            <div>
              <label className={labelCls}>Amount (AED) *</label>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(formatTyping(e.target.value));
                  setErrors((p) => ({ ...p, amount: false }));
                }}
                onBlur={() => amount && setAmount(value ? formatAmount(value) : '')}
                inputMode="decimal"
                placeholder="0.00"
                className={`${field} h-12 px-4 text-center text-lg font-black ${err('amount')}`}
              />
            </div>
          </div>

          {/* Details */}
          <div>
            <label className={labelCls}>Details *</label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((p) => ({ ...p, description: false }));
              }}
              rows={6}
              dir="auto"
              maxLength={4000}
              placeholder="What the amount is for, the related invoices / documents, and how it will be settled…"
              className={`${field} px-4 py-3 leading-relaxed resize-y ${err('description')}`}
            />
          </div>

          <p className="text-xs font-semibold text-slate-400 border-t border-slate-100 pt-4">{ACKNOWLEDGEMENT}</p>
        </div>
      </div>
    </div>
  );
}
