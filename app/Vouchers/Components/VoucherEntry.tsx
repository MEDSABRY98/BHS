'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Hash, Loader2, Plus, Printer, RotateCcw, Save, Trash2, X, Edit } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import {
  getNextVoucherNumber,
  getVoucherSignature,
  getVoucherSuggestions,
  saveVoucher,
} from '../Service/cash_voucher_service';
import {
  PAYMENT_METHODS,
  VOUCHER_LABELS,
  amountToWords,
  formatAED,
  linesTotal,
  round2,
  splitInvoiceInput,
  type CashVoucher,
  type VoucherLine,
  type VoucherType,
} from '../Utils/voucherTypes';
import { generateVoucherPdf } from '../Utils/VoucherPdf';

function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  className,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  dir?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        dir={dir}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl">
          {filtered.map((opt) => (
            <li
              key={opt}
              onMouseDown={(e) => {
                e.preventDefault();
                setSearch(opt);
                onChange(opt);
                setOpen(false);
              }}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-[#FBF8EE] hover:text-[#D4AF37]"
              dir="auto"
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Permissions = { in: { create: boolean }; out: { create: boolean } };

type Props = {
  permissions: Permissions;
  currentUserName: string;
  editVoucher?: CashVoucher | null;
  onDone?: () => void;
};

type LineRow = { ref: string; party: string; amount: string };

const today = () => new Date().toISOString().slice(0, 10);
const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-semibold text-slate-900 outline-none transition focus:border-[#D4AF37] focus:ring-4 focus:ring-[#D4AF37]/15 placeholder:text-slate-300 placeholder:font-medium';
const labelCls = 'mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500';

export default function VoucherEntry({ permissions, currentUserName, editVoucher, onDone }: Props) {
  const firstAllowed: VoucherType = permissions.in.create ? 'IN' : 'OUT';
  const [type, setType] = useState<VoucherType>(editVoucher?.TYPE || firstAllowed);
  const [voucherNo, setVoucherNo] = useState(editVoucher?.ID || '');
  const [date, setDate] = useState(editVoucher?.DATE?.slice(0, 10) || today());
  const [party, setParty] = useState(editVoucher?.PARTY || '');
  const [via, setVia] = useState(editVoucher?.VIA || '');
  const [method, setMethod] = useState(editVoucher?.PAYMENT_METHOD || 'Cash');
  const [reference, setReference] = useState(editVoucher?.REFERENCE || '');
  const [amount, setAmount] = useState(editVoucher ? String(editVoucher.AMOUNT) : '');
  const [description, setDescription] = useState(editVoucher?.DESCRIPTION || '');
  const [lines, setLines] = useState<LineRow[]>(
    (editVoucher?.LINES || []).map((l) => ({ ref: l.ref, party: l.party || '', amount: l.amount ? String(l.amount) : '' }))
  );
  const [invoiceInput, setInvoiceInput] = useState('');
  const [saving, setSaving] = useState<false | 'save' | 'print'>(false);
  const [suggestions, setSuggestions] = useState<{ parties: string[]; via: string[]; customers: string[] }>({ parties: [], via: [], customers: [] });
  
  const [isLineModalOpen, setIsLineModalOpen] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [lineForm, setLineForm] = useState<LineRow>({ ref: '', party: '', amount: '' });

  const openLineModal = (index: number | null) => {
    if (index !== null) {
      setEditingLineIndex(index);
      setLineForm(lines[index]);
    } else {
      setEditingLineIndex(null);
      setLineForm({ ref: '', party: '', amount: '' });
    }
    setIsLineModalOpen(true);
  };

  const saveLineModal = () => {
    if (!lineForm.ref.trim()) {
      toast.error('Invoice No. is required');
      return;
    }
    if (editingLineIndex !== null) {
      updateLine(editingLineIndex, lineForm);
    } else {
      setLines(prev => [...prev, lineForm]);
    }
    setIsLineModalOpen(false);
  };

  const isEditing = !!editVoucher;
  const L = VOUCHER_LABELS[type];
  const accent = type === 'IN' ? 'text-emerald-600' : 'text-rose-600';

  const sumLines = linesTotal(lines.map((l) => ({ ref: l.ref, amount: l.amount === '' ? null : Number(l.amount) })));
  const amountFromLines = lines.some((l) => l.amount !== '' && Number(l.amount) > 0);
  const effectiveAmount = amountFromLines ? sumLines : round2(Number(amount) || 0);
  const words = effectiveAmount > 0 ? amountToWords(effectiveAmount) : '';

  useEffect(() => {
    getVoucherSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    if (isEditing) return;
    setVoucherNo('');
    getNextVoucherNumber(type)
      .then(setVoucherNo)
      .catch((e) => toast.error(e?.message || 'Could not load the next voucher number'));
  }, [type, isEditing]);

  const addInvoices = (text: string) => {
    const refs = splitInvoiceInput(text);
    if (!refs.length) return;
    setLines((prev) => {
      const have = new Set(prev.map((l) => l.ref.toUpperCase()));
      const added = refs.filter((r) => !have.has(r.toUpperCase())).map((r) => ({ ref: r, party: '', amount: '' }));
      return [...prev, ...added];
    });
    setInvoiceInput('');
  };

  const updateLine = (i: number, patch: Partial<LineRow>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const reset = (nextType: VoucherType = type) => {
    setParty('');
    setVia('');
    setMethod('Cash');
    setReference('');
    setAmount('');
    setDescription('');
    setLines([]);
    setInvoiceInput('');
    setDate(today());
    if (nextType !== type) setType(nextType);
    else getNextVoucherNumber(nextType).then(setVoucherNo).catch(() => {});
  };

  const handleSave = async (andPrint: boolean) => {
    if (invoiceInput.trim()) addInvoices(invoiceInput);
    if (!party.trim()) return toast.error(`${L.party} is required`);
    if (!(effectiveAmount > 0)) return toast.error('Enter an amount greater than zero');

    setSaving(andPrint ? 'print' : 'save');
    try {
      const saved = await saveVoucher({
        ID: isEditing ? editVoucher!.ID : undefined,
        TYPE: type,
        DATE: date,
        PARTY: party,
        VIA: via || null,
        AMOUNT: effectiveAmount,
        PAYMENT_METHOD: method,
        REFERENCE: method === 'Cash' ? null : reference || null,
        DESCRIPTION: description || null,
        LINES: [...lines, ...splitInvoiceInput(invoiceInput).map((r) => ({ ref: r, party: '', amount: '' }))].map(
          (l): VoucherLine => ({ ref: l.ref, party: l.party || undefined, amount: l.amount === '' ? null : Number(l.amount) })
        ),
      });
      toast.success(`${saved.ID} saved`);

      if (andPrint) {
        const signature = await getVoucherSignature(saved.ID).catch(() => null);
        await generateVoucherPdf(saved, { signature, printedBy: currentUserName });
      }

      if (isEditing) onDone?.();
      else reset();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save the voucher');
    } finally {
      setSaving(false);
    }
  };

  const typeButton = (t: VoucherType) => {
    const allowed = t === 'IN' ? permissions.in.create : permissions.out.create;
    const active = type === t;
    const Icon = t === 'IN' ? ArrowDownLeft : ArrowUpRight;
    return (
      <button
        type="button"
        disabled={!allowed || isEditing}
        onClick={() => setType(t)}
        className={`flex flex-1 items-center gap-3 rounded-2xl border px-5 py-4 text-left transition ${
          active ? 'border-[#0f0f0f] bg-[#0f0f0f] text-white shadow-lg' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        } ${!active ? 'disabled:cursor-not-allowed disabled:opacity-40' : 'disabled:cursor-default'}`}
      >
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-[#D4AF37] text-black' : t === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-base font-black tracking-tight">{t === 'IN' ? 'Cash In · استلام' : 'Cash Out · تسليم'}</span>
          <span className={`block text-xs font-semibold ${active ? 'text-[#D4AF37]' : 'text-slate-400'}`}>{VOUCHER_LABELS[t].title}</span>
        </span>
      </button>
    );
  };

  const partyOptions = useMemo(() => Array.from(new Set([...suggestions.parties, ...suggestions.customers])), [suggestions]);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            {isEditing ? `Edit ${editVoucher!.ID}` : 'New Voucher'}
          </h1>
          <div className="mt-2 h-1 w-16 rounded-full bg-[#D4AF37]" />
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <button type="button" disabled={!!saving} onClick={onDone} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-500 hover:text-rose-600 transition">
              <X className="h-4 w-4" /> Cancel
            </button>
          ) : (
            <button type="button" disabled={!!saving} onClick={() => reset()} title="Clear form" className="flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-500 hover:text-slate-900 transition">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button type="button" disabled={!!saving} onClick={() => handleSave(true)} title="Save & Print" className="flex items-center justify-center rounded-xl bg-[#0f0f0f] p-2.5 text-[#D4AF37] shadow hover:bg-black disabled:opacity-50 transition">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── Form ─────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          {typeButton('IN')}
          {typeButton('OUT')}
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 mb-5">
            <div>
              <label className={labelCls}>Voucher No.</label>
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                <Hash className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-[15px] font-black tracking-wide text-slate-900">{voucherNo || '…'}</span>
                {!isEditing && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-slate-400">auto</span>}
              </div>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} pl-11`} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div>
              <label className={labelCls}>{L.party} *</label>
              <ComboboxInput
                value={party}
                onChange={setParty}
                options={partyOptions}
                placeholder={type === 'IN' ? 'Customer / person who paid' : 'Person or party receiving the cash'}
                className={inputCls}
                dir="auto"
              />
            </div>
            <div>
              <label className={labelCls}>{L.via} <span className="normal-case tracking-normal text-slate-300">(optional)</span></label>
              <ComboboxInput
                value={via}
                onChange={setVia}
                options={suggestions.via}
                placeholder={type === 'IN' ? 'e.g. salesman who brought it' : 'e.g. driver / employee'}
                className={inputCls}
                dir="auto"
              />
            </div>
            <div>
              <label className={labelCls}>Amount (AED) *</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amountFromLines ? String(sumLines) : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={amountFromLines}
                placeholder="0.00"
                className={`${inputCls} font-bold tabular-nums disabled:bg-[#FBF8EE] disabled:text-slate-900`}
              />
              {amountFromLines && <p className="mt-1 text-[11px] font-semibold text-[#A8861E]">Calculated from invoice amounts</p>}
              {effectiveAmount > 0 && <p className="mt-1.5 text-[11px] font-bold italic leading-tight text-emerald-600">{words}</p>}
            </div>
          </div>

          <div className="mt-6">
            <label className={labelCls}>Payment Method</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${method === m ? 'border-[#0f0f0f] bg-[#0f0f0f] text-[#D4AF37]' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                >
                  {m}
                </button>
              ))}
              {method !== 'Cash' && (
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={method === 'Cheque' ? 'Cheque no.' : 'Transfer reference'} className={`${inputCls} max-w-xs py-2`} />
              )}
            </div>
          </div>
        </section>

        {/* Invoices */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Invoices</h3>
            </div>
            <div className="flex gap-2 items-center">
              {lines.length > 0 && (
                <button type="button" onClick={() => setLines([])} className="text-xs font-bold text-slate-400 hover:text-rose-600">Clear all</button>
              )}
              <button type="button" onClick={() => openLineModal(null)} className="flex items-center gap-1.5 rounded-xl bg-[#0f0f0f] px-5 py-2.5 text-sm font-bold text-[#D4AF37] hover:bg-black transition">
                <Plus className="h-4 w-4" /> Add Invoice
              </button>
            </div>
          </div>

          {lines.length > 0 && (
            <div className="mt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {lines.map((l, i) => (
                  <div key={`${l.ref}-${i}`} className="group relative flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#D4AF37] hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">#{i + 1}</span>
                        <h4 className="text-[15px] font-bold text-slate-900">{l.ref}</h4>
                      </div>
                      <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => openLineModal(i)} className="rounded-lg p-1.5 text-slate-400 hover:bg-[#FBF8EE] hover:text-[#D4AF37]">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {l.party && (
                      <div className="truncate text-sm font-semibold text-slate-600">
                        {l.party}
                      </div>
                    )}
                    {l.amount && (
                      <div className="mt-1 text-[15px] font-black tabular-nums text-slate-900">
                        {formatAED(Number(l.amount))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {amountFromLines && (
                <div className="mt-6 flex items-center justify-between rounded-2xl bg-[#FBF8EE] p-4 border border-[#E9D9A3]">
                  <span className="text-sm font-black uppercase tracking-wider text-[#A8861E]">Total Invoices</span>
                  <span className="text-xl font-black tabular-nums text-slate-900">
                    {formatAED(sumLines)}
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this payment for?" className={`${inputCls} resize-y`} dir="auto" />
        </section>
      </div>

      {isLineModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-visible rounded-[2rem] bg-white p-8 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                {editingLineIndex !== null ? 'Edit Invoice' : 'Add Invoice'}
              </h2>
              <button onClick={() => setIsLineModalOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Invoice No. *</label>
                <input
                  autoFocus
                  value={lineForm.ref}
                  onChange={(e) => setLineForm(p => ({ ...p, ref: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveLineModal();
                  }}
                  placeholder="e.g. SAL-10234"
                  className={inputCls}
                />
              </div>
              
              <div className="relative z-50">
                <label className={labelCls}>Customer (Optional)</label>
                <ComboboxInput
                  value={lineForm.party}
                  onChange={(v) => setLineForm(p => ({ ...p, party: v }))}
                  options={suggestions.customers}
                  placeholder="Select or type..."
                  className={inputCls}
                  dir="auto"
                />
              </div>

              <div>
                <label className={labelCls}>Amount (Optional)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={lineForm.amount}
                  onChange={(e) => setLineForm(p => ({ ...p, amount: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveLineModal();
                  }}
                  placeholder="0.00"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsLineModalOpen(false)}
                className="rounded-xl px-5 py-3 text-[15px] font-bold text-slate-500 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveLineModal}
                className="rounded-xl bg-[#0f0f0f] px-6 py-3 text-[15px] font-bold text-[#D4AF37] shadow-lg hover:bg-black transition"
              >
                {editingLineIndex !== null ? 'Save Changes' : 'Add Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
