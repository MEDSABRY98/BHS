'use client';

import { useState } from 'react';
import { Landmark, Loader2, Save, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { saveTransferBank } from '../Service/TransferService';
import type { TransferBank } from '../Utils/TransferTypes';

export const inputClass =
  'w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-300';

export function Field({ label, children, className = '', required }: { label: string; children: React.ReactNode; className?: string; required?: boolean }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

interface BankModalProps {
  bank?: TransferBank | null; // edit
  initialName?: string; // create with the typed name
  onClose: () => void;
  onSaved: (bank: TransferBank) => void;
}

export default function BankModal({ bank, initialName = '', onClose, onSaved }: BankModalProps) {
  const [name, setName] = useState(bank?.NAME || initialName);
  const [swift, setSwift] = useState(bank?.SWIFT_CODE || '');
  const [active, setActive] = useState(bank?.IS_ACTIVE !== false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return toast.error('Bank name is required');
    setSaving(true);
    try {
      const saved = await saveTransferBank({ ID: bank?.ID, NAME: name, SWIFT_CODE: swift, IS_ACTIVE: active });
      onSaved(saved);
      toast.success(bank ? 'Bank updated' : 'Bank added');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the bank');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        if (!saving) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 bg-[#0a0f1d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-black text-white">{bank ? 'Edit Bank' : 'New Bank'}</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void save();
          }}
        >
          <Field label="Bank Name" required>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={inputClass} placeholder="e.g. Abu Dhabi Commercial Bank" />
          </Field>
          <Field label="SWIFT Code">
            <input value={swift} onChange={(e) => setSwift(e.target.value.toUpperCase())} className={inputClass} placeholder="Optional" />
          </Field>
          {bank && <ActiveToggle active={active} onChange={setActive} />}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl bg-[#0a0f1d] hover:bg-black text-white text-sm font-bold flex items-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-[#D4AF37]" />}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ActiveToggle({ active, onChange }: { active: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50"
    >
      <span className="text-left">
        <span className="block text-sm font-bold text-slate-800">{active ? 'Active' : 'Inactive'}</span>
        <span className="block text-[11px] font-semibold text-slate-400">Inactive items are hidden from the request form</span>
      </span>
      <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
        <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}
