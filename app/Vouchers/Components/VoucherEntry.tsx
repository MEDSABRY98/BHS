'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Hash, Loader2, Plus, Printer, RotateCcw, Save, Trash2, X } from 'lucide-react';
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
  const invoiceRef = useRef<HTMLInputElement>(null);

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
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Invoices</h3>
              <p className="text-xs font-medium text-slate-400">Type or paste invoice numbers (Enter, comma or new line). Customer and amount are optional.</p>
            </div>
            {lines.length > 0 && (
              <button type="button" onClick={() => setLines([])} className="text-xs font-bold text-slate-400 hover:text-rose-600">Clear all</button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              ref={invoiceRef}
              value={invoiceInput}
              onChange={(e) => setInvoiceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addInvoices(invoiceInput);
                }
              }}
              onPaste={(e) => {
                const text = e.clipboardData.getData('text');
                if (/[\n,;\t]/.test(text)) {
                  e.preventDefault();
                  addInvoices(text);
                }
              }}
              placeholder="e.g. SAL-10234"
              className={inputCls}
            />
            <button type="button" onClick={() => addInvoices(invoiceInput)} className="flex items-center gap-1.5 rounded-xl bg-[#0f0f0f] px-5 text-sm font-bold text-[#D4AF37] hover:bg-black">
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>

          {lines.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white" style={{ overflow: 'visible' }}>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center rounded-tl-2xl">#</th>
                    <th className="px-3 py-2.5 text-center">Invoice No.</th>
                    <th className="px-3 py-2.5 text-center">Customer</th>
                    <th className="w-40 px-3 py-2.5 text-center">Amount</th>
                    <th className="w-10 rounded-tr-2xl" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={`${l.ref}-${i}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-center text-xs font-bold text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2 text-center">
                        <input value={l.ref} onChange={(e) => updateLine(i, { ref: e.target.value })} className="w-full bg-transparent font-bold text-slate-900 outline-none text-center" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <ComboboxInput
                          value={l.party}
                          onChange={(v) => updateLine(i, { party: v })}
                          options={suggestions.customers}
                          placeholder="—"
                          className="w-full bg-transparent font-medium text-slate-700 outline-none placeholder:text-slate-300 text-center"
                          dir="auto"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" inputMode="decimal" step="0.01" min="0" value={l.amount} onChange={(e) => updateLine(i, { amount: e.target.value })} placeholder="—" className="w-full bg-transparent text-center font-bold tabular-nums text-slate-900 outline-none placeholder:text-slate-300" />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {amountFromLines && (
                  <tfoot className="bg-[#FBF8EE]">
                    <tr className="border-t border-[#E9D9A3]">
                      <td colSpan={3} className="px-3 py-2.5 text-center text-xs font-black uppercase tracking-wider text-[#A8861E] rounded-bl-2xl">Total</td>
                      <td className="px-3 py-2.5 text-center font-black tabular-nums text-slate-900">{sumLines.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="rounded-br-2xl" />
                    </tr>
                  </tfoot>
                )}
              </table>

            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className={labelCls}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What is this payment for?" className={`${inputCls} resize-y`} dir="auto" />
        </section>
      </div>
    </div>
  );
}
