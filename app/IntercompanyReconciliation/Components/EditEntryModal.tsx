'use client';

import { useState } from 'react';
import { Loader2, Pencil, Plus, Save, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { createIntercompanyEntry, updateIntercompanyEntry } from '../Service/IntercompanyService';
import { entryRef, round2, type IntercompanyEntry } from '../Utils/IntercompanyTypes';

interface EditEntryModalProps {
  entry?: IntercompanyEntry | null; // empty = add a new line
  onClose: () => void;
  onSaved: (entry: IntercompanyEntry) => void;
}

const inputClass =
  'w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-300';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export default function EditEntryModal({ entry, onClose, onSaved }: EditEntryModalProps) {
  const isNew = !entry;
  const [date, setDate] = useState(entry?.ENTRY_DATE || new Date().toISOString().slice(0, 10));
  const [ain, setAin] = useState(entry?.AIN_ENTRY_NUMBER || '');
  const [dubai, setDubai] = useState(entry?.DUBAI_ENTRY_NUMBER || '');
  const [label, setLabel] = useState(entry?.LABEL || '');
  const [debit, setDebit] = useState(entry?.DEBIT ? String(entry.DEBIT) : '');
  const [credit, setCredit] = useState(entry?.CREDIT ? String(entry.CREDIT) : '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const d = round2(Number(debit.replace(/,/g, '')) || 0);
    const c = round2(Number(credit.replace(/,/g, '')) || 0);
    if (!date) return toast.error('Date is required');
    if (!ain.trim() && !dubai.trim()) return toast.error('Enter the Al Ain or the Dubai entry number');
    if (d < 0 || c < 0) return toast.error("Debit and credit can't be negative");
    if (d === 0 && c === 0) return toast.error('Enter a debit or a credit amount');

    setSaving(true);
    try {
      const line = {
        ENTRY_DATE: date,
        AIN_ENTRY_NUMBER: ain,
        DUBAI_ENTRY_NUMBER: dubai || null,
        LABEL: label || null,
        DEBIT: d,
        CREDIT: c,
      };
      const saved = entry ? await updateIntercompanyEntry(entry.ID, line) : await createIntercompanyEntry(line);
      onSaved(saved);
      toast.success(isNew ? 'Line added' : 'Line updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the line');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={saving ? undefined : onClose}>
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 bg-[#0a0f1d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              {isNew ? <Plus className="w-5 h-5 text-white" /> : <Pencil className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h3 className="text-base font-black text-white">{isNew ? 'Add Line' : 'Edit Line'}</h3>
              <p className="text-[11px] font-semibold text-slate-400">{isNew ? 'Al Ain or Dubai entry number is enough' : entry ? entryRef(entry) : ''}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Al Ain Entry No">
            <input value={ain} onChange={(e) => setAin(e.target.value)} autoFocus={isNew} placeholder="Not booked in Al Ain yet" className={inputClass} />
          </Field>
          <Field label="Dubai Entry No" className="sm:col-span-2">
            <input value={dubai} onChange={(e) => setDubai(e.target.value)} placeholder="Not booked in Dubai yet" className={inputClass} />
          </Field>
          <Field label="Label" className="sm:col-span-2">
            <textarea
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              rows={3}
              dir="auto"
              className={`${inputClass} h-auto py-2.5 resize-none leading-relaxed`}
            />
          </Field>
          <Field label="Debit">
            <input inputMode="decimal" value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="0.00" className={`${inputClass} text-emerald-700`} />
          </Field>
          <Field label="Credit">
            <input inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0.00" className={`${inputClass} text-rose-700`} />
          </Field>

          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-[#0a0f1d] hover:bg-black text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#D4AF37]" />}
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
