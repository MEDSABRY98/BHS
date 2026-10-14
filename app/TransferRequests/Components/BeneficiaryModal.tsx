'use client';

import { useMemo, useState } from 'react';
import { Loader2, Save, UserPlus, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import BankModal, { ActiveToggle, Field, inputClass } from './BankModal';
import SearchSelect from './SearchSelect';
import { saveTransferBeneficiary } from '../Service/TransferService';
import { formatIban, type TransferBank, type TransferBeneficiary } from '../Utils/TransferTypes';

interface BeneficiaryModalProps {
  beneficiary?: TransferBeneficiary | null; // edit
  initialName?: string; // create with the typed name
  banks: TransferBank[];
  onClose: () => void;
  onSaved: (b: TransferBeneficiary) => void;
  onBankCreated: (bank: TransferBank) => void;
}

export default function BeneficiaryModal({ beneficiary, initialName = '', banks, onClose, onSaved, onBankCreated }: BeneficiaryModalProps) {
  const [name, setName] = useState(beneficiary?.NAME || initialName);
  const [bankId, setBankId] = useState<string | null>(beneficiary?.BANK_ID || null);
  const [iban, setIban] = useState(formatIban(beneficiary?.IBAN));
  const [accountNo, setAccountNo] = useState(beneficiary?.ACCOUNT_NO || '');
  const [notes, setNotes] = useState(beneficiary?.NOTES || '');
  const [active, setActive] = useState(beneficiary?.IS_ACTIVE !== false);
  const [saving, setSaving] = useState(false);
  const [newBank, setNewBank] = useState<string | null>(null);

  const bankOptions = useMemo(
    () => banks.filter((b) => b.IS_ACTIVE || b.ID === bankId).map((b) => ({ id: b.ID, label: b.NAME, sub: b.SWIFT_CODE || undefined })),
    [banks, bankId],
  );

  const save = async () => {
    if (!name.trim()) return toast.error('Beneficiary name is required');
    if (!iban.trim() && !accountNo.trim()) return toast.error('Enter the IBAN or the account number');
    setSaving(true);
    try {
      const saved = await saveTransferBeneficiary({
        ID: beneficiary?.ID,
        NAME: name,
        BANK_ID: bankId,
        IBAN: iban,
        ACCOUNT_NO: accountNo,
        NOTES: notes,
        IS_ACTIVE: active,
      });
      onSaved(saved);
      toast.success(beneficiary ? 'Beneficiary updated' : 'Beneficiary added');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the beneficiary');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        if (!saving) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 bg-[#0a0f1d]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-base font-black text-white">{beneficiary ? 'Edit Beneficiary' : 'New Beneficiary'}</h3>
          </div>
          <button onClick={onClose} disabled={saving} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void save();
          }}
        >
          <Field label="Beneficiary Name" required className="sm:col-span-2">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={inputClass} placeholder="Person or company name" />
          </Field>
          <Field label="Bank" className="sm:col-span-2">
            <SearchSelect
              value={bankId}
              options={bankOptions}
              onChange={setBankId}
              placeholder="Choose the bank"
              createLabel="New bank"
              onCreate={(typed) => setNewBank(typed)}
            />
          </Field>
          <Field label="IBAN" className="sm:col-span-2">
            <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} className={`${inputClass} tracking-wider`} placeholder="AE07 0331 2345 6789 0123 456" />
          </Field>
          <Field label="Account No.">
            <input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} className={inputClass} placeholder="IBAN or account no. is required" />
          </Field>
          <Field label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} dir="auto" className={inputClass} placeholder="Optional" />
          </Field>
          {beneficiary && (
            <div className="sm:col-span-2">
              <ActiveToggle active={active} onChange={setActive} />
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
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

      {newBank !== null && (
        <BankModal
          initialName={newBank}
          onClose={() => setNewBank(null)}
          onSaved={(bank) => {
            onBankCreated(bank);
            setBankId(bank.ID);
          }}
        />
      )}
    </div>
  );
}
