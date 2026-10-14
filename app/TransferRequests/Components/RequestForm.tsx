'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, CalendarDays, Landmark, Loader2, Printer, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import SearchSelect from './SearchSelect';
import BeneficiaryModal from './BeneficiaryModal';
import BankModal, { Field, inputClass } from './BankModal';
import CurrencySelect from './CurrencySelect';
import { saveTransferRequest } from '../Service/TransferService';
import { generateTransferPdf } from '../Utils/TransferPdf';
import {
  TRANSFER_TYPES,
  amountToWords,
  formatAmount,
  formatDate,
  formatIban,
  round2,
  todayIso,
  type TransferBank,
  type TransferBeneficiary,
  type TransferRequest,
  type TransferType,
} from '../Utils/TransferTypes';

interface RequestFormProps {
  editRequest: TransferRequest | null;
  banks: TransferBank[];
  beneficiaries: TransferBeneficiary[];
  onSaved: (request: TransferRequest, isNew: boolean) => void;
  onCancelEdit: () => void;
  onBankSaved: (bank: TransferBank) => void;
  onBeneficiarySaved: (b: TransferBeneficiary) => void;
}

export default function RequestForm({ editRequest, banks, beneficiaries, onSaved, onCancelEdit, onBankSaved, onBeneficiarySaved }: RequestFormProps) {
  const date = editRequest?.REQUEST_DATE || todayIso(); // automatic: today for a new request
  const [type, setType] = useState<TransferType | null>(editRequest?.TRANSFER_TYPE || null);
  const [bankId, setBankId] = useState<string | null>(editRequest?.BANK_ID || null);
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(editRequest?.BENEFICIARY_ID || null);
  const [amount, setAmount] = useState(editRequest ? String(editRequest.AMOUNT) : '');
  const [currency, setCurrency] = useState(editRequest?.CURRENCY || 'AED');
  const [reason, setReason] = useState(editRequest?.REASON || '');
  const [saving, setSaving] = useState(false);
  const [newBeneficiary, setNewBeneficiary] = useState<string | null>(null);
  const [newBank, setNewBank] = useState<string | null>(null);

  const bankById = useMemo(() => new Map(banks.map((b) => [b.ID, b])), [banks]);
  const beneficiary = beneficiaries.find((b) => b.ID === beneficiaryId) || null;

  const beneficiaryOptions = useMemo(
    () =>
      beneficiaries
        .filter((b) => b.IS_ACTIVE || b.ID === beneficiaryId)
        .map((b) => ({
          id: b.ID,
          label: b.NAME,
          sub: [b.BANK_ID ? bankById.get(b.BANK_ID)?.NAME : '', b.IBAN ? formatIban(b.IBAN) : b.ACCOUNT_NO].filter(Boolean).join(' · '),
        })),
    [beneficiaries, beneficiaryId, bankById],
  );
  const bankOptions = useMemo(
    () => banks.filter((b) => b.IS_ACTIVE || b.ID === bankId).map((b) => ({ id: b.ID, label: b.NAME, sub: b.SWIFT_CODE || undefined })),
    [banks, bankId],
  );

  const amountValue = round2(Number(amount.replace(/,/g, '')) || 0);
  const lockedSeries = editRequest ? (editRequest.TRANSFER_TYPE === 'INTERNAL' ? 'INTERNAL' : 'IC') : null;

  const reset = () => {
    setType(null);
    setBankId(null);
    setBeneficiaryId(null);
    setAmount('');
    setCurrency('AED');
    setReason('');
  };

  const printPdf = async (r: TransferRequest) => {
    const b = beneficiaries.find((x) => x.ID === r.BENEFICIARY_ID) || null;
    try {
      await generateTransferPdf({
        request: r,
        beneficiary: b,
        beneficiaryBank: b?.BANK_ID ? bankById.get(b.BANK_ID) || null : null,
        transferBank: r.BANK_ID ? bankById.get(r.BANK_ID) || null : null,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not create the PDF');
    }
  };

  const save = async (andPrint: boolean) => {
    if (!type) return toast.error('Choose the transfer type');
    if (type === 'INTERNAL' && !bankId) return toast.error('Choose the bank');
    if (!beneficiaryId) return toast.error('Choose the beneficiary');
    if (!(amountValue > 0)) return toast.error('Enter the amount');
    if (!reason.trim()) return toast.error('Enter the reason for the transfer');

    setSaving(true);
    try {
      const saved = await saveTransferRequest({
        ID: editRequest?.ID,
        TRANSFER_TYPE: type,
        BANK_ID: type === 'INTERNAL' ? bankId : null,
        BENEFICIARY_ID: beneficiaryId,
        AMOUNT: amountValue,
        CURRENCY: currency,
        REASON: reason,
      });
      onSaved(saved, !editRequest);
      toast.success(editRequest ? `${saved.REQUEST_NO} updated` : `${saved.REQUEST_NO} saved`);
      if (andPrint) await printPdf(saved);
      if (editRequest) onCancelEdit();
      else reset();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save the request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{editRequest ? `Edit ${editRequest.REQUEST_NO}` : 'New Transfer Request'}</h1>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="flex items-center gap-2 px-4 h-10 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700" title="Request date (automatic)">
            <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
            {formatDate(date)}
          </span>
          {editRequest && (
            <button onClick={onCancelEdit} className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2">
              <X className="w-4 h-4" /> Cancel Edit
            </button>
          )}
        </div>
      </div>

      <form
        className="space-y-6"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
          {/* Type */}
          <div>
            <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
              Transfer Type<span className="text-red-500 ml-0.5">*</span>
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TRANSFER_TYPES.map((t) => {
                const active = type === t.value;
                const locked = !!lockedSeries && (lockedSeries === 'INTERNAL') !== (t.value === 'INTERNAL');
                return (
                  <button
                    key={t.value}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setType(t.value);
                      if (t.value !== 'INTERNAL') setBankId(null);
                    }}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                      active ? 'border-[#D4AF37] bg-amber-50/60' : 'border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-[#0a0f1d] text-[#D4AF37]' : 'bg-slate-100 text-slate-400'}`}>
                      {t.value === 'INTERNAL' ? <Landmark className="w-4 h-4" /> : <ArrowLeftRight className="w-4 h-4" />}
                    </span>
                    <span>
                      <span className={`block text-sm font-black ${active ? 'text-slate-900' : 'text-slate-600'}`}>{t.label}</span>
                      <span className="block text-[11px] font-bold text-slate-400">{t.value === 'INTERNAL' ? 'Serial IN-0000' : 'Serial IC-0000'}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {type === 'INTERNAL' && (
            <Field label="Bank" required>
              <SearchSelect value={bankId} options={bankOptions} onChange={setBankId} placeholder="Choose the bank" createLabel="New bank" onCreate={(typed) => setNewBank(typed)} />
            </Field>
          )}

          <div className="space-y-3">
            <Field label="Beneficiary" required>
              <SearchSelect
                value={beneficiaryId}
                options={beneficiaryOptions}
                onChange={setBeneficiaryId}
                placeholder="Search beneficiary name or IBAN"
                createLabel="New beneficiary"
                onCreate={(typed) => setNewBeneficiary(typed)}
              />
            </Field>
            {beneficiary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Info label="Bank" value={beneficiary.BANK_ID ? bankById.get(beneficiary.BANK_ID)?.NAME || '—' : '—'} />
                <Info label="IBAN" value={beneficiary.IBAN ? formatIban(beneficiary.IBAN) : '—'} mono />
                <Info label="Account No." value={beneficiary.ACCOUNT_NO || '—'} mono />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Amount" required className="sm:col-span-2">
              <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`${inputClass} text-lg font-black`} />
            </Field>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-1.5">
                Currency<span className="text-red-500 ml-0.5">*</span>
              </span>
              <CurrencySelect value={currency} onChange={setCurrency} />
            </div>
          </div>

          <Field label="Reason for Transfer" required>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} dir="auto" className={`${inputClass} h-auto py-2.5 resize-none leading-relaxed`} />
          </Field>
        </div>

        {/* Amount summary */}
        <div className="bg-[#0a0f1d] rounded-3xl px-6 py-5 text-white shadow-lg flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
          <div className="shrink-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4AF37]">Amount</p>
            <p className="text-3xl font-black tracking-tight mt-0.5">
              <span className="text-slate-400 text-lg mr-1.5">{currency}</span>
              {formatAmount(amountValue)}
            </p>
          </div>
          <p className="flex-1 text-sm italic text-slate-300 leading-relaxed sm:border-l sm:border-white/10 sm:pl-6">
            {amountValue > 0 ? amountToWords(amountValue, currency) : 'Enter the amount to see it in words'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(true)}
            className="h-12 px-8 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} Save &amp; Print PDF
          </button>
        </div>
      </form>

      {newBeneficiary !== null && (
        <BeneficiaryModal
          initialName={newBeneficiary}
          banks={banks}
          onClose={() => setNewBeneficiary(null)}
          onSaved={(b) => {
            onBeneficiarySaved(b);
            setBeneficiaryId(b.ID);
          }}
          onBankCreated={onBankSaved}
        />
      )}
      {newBank !== null && (
        <BankModal
          initialName={newBank}
          onClose={() => setNewBank(null)}
          onSaved={(b) => {
            onBankSaved(b);
            setBankId(b.ID);
          }}
        />
      )}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className={`text-sm font-bold text-slate-800 truncate ${mono ? 'tracking-wide' : ''}`} dir="auto" title={value}>
        {value}
      </p>
    </div>
  );
}
