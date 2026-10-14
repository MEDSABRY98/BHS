'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import { getPettyCashSuggestions, savePettyCash } from '../Service/PettyCashService';
import {
  MAX_LINES,
  formatAmount,
  round2,
  uaeToday,
  type PettyCash,
  type PettyCashLineInput,
} from '../Utils/PettyCashTypes';

type FormRow = {
  key: number;
  INVOICE_DATE: string;
  DESCRIPTION: string;
  BENEFICIARY: string;
  AMOUNT: string;
  IS_TAX_INVOICE: boolean;
  HAS_INVOICE: boolean;
};

type RowErrors = Partial<Record<'INVOICE_DATE' | 'DESCRIPTION' | 'BENEFICIARY' | 'AMOUNT', true>>;

interface PettyCashFormProps {
  onSaved: (p: PettyCash) => void;
}

let nextKey = 1;
const emptyRow = (base?: Partial<FormRow>): FormRow => ({
  key: nextKey++,
  INVOICE_DATE: base?.INVOICE_DATE ?? uaeToday(),
  DESCRIPTION: base?.DESCRIPTION ?? '',
  BENEFICIARY: base?.BENEFICIARY ?? '',
  AMOUNT: base?.AMOUNT ?? '',
  IS_TAX_INVOICE: base?.IS_TAX_INVOICE ?? false,
  HAS_INVOICE: base?.HAS_INVOICE ?? true,
});

const parseAmount = (v: string) => round2(Number(String(v).replace(/,/g, '')) || 0);
const isBlank = (r: FormRow) => !r.DESCRIPTION.trim() && !r.BENEFICIARY.trim() && !r.AMOUNT.trim();

const cellInput =
  'w-full h-10 px-3 rounded-lg border bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-all';

function Toggle({ checked, onChange, onLabel, offLabel, tone }: { checked: boolean; onChange: (v: boolean) => void; onLabel: string; offLabel: string; tone: 'gold' | 'green' }) {
  const on = tone === 'gold' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-700 border-emerald-300';
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-10 w-full min-w-[78px] px-2 rounded-lg border text-xs font-black transition-all ${checked ? on : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
    >
      {checked ? onLabel : offLabel}
    </button>
  );
}

export default function PettyCashForm({ onSaved }: PettyCashFormProps) {
  const [rows, setRows] = useState<FormRow[]>(() => [emptyRow()]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<number, RowErrors>>({});
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{ beneficiaries: string[]; descriptions: string[] }>({ beneficiaries: [], descriptions: [] });
  const focusKey = useRef<number | null>(null);
  const today = uaeToday();

  useEffect(() => {
    getPettyCashSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  // focus the description of a newly added row
  useEffect(() => {
    if (focusKey.current == null) return;
    const el = document.getElementById(`pc-desc-${focusKey.current}`) as HTMLInputElement | null;
    el?.focus();
    focusKey.current = null;
  }, [rows.length]);

  const filled = rows.filter((r) => !isBlank(r));
  const total = useMemo(() => round2(filled.reduce((s, r) => s + parseAmount(r.AMOUNT), 0)), [filled]);
  const taxTotal = useMemo(() => round2(filled.reduce((s, r) => s + (r.IS_TAX_INVOICE ? parseAmount(r.AMOUNT) : 0), 0)), [filled]);
  const noInvoice = filled.filter((r) => !r.HAS_INVOICE).length;

  const update = (key: number, patch: Partial<FormRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev, [key]: { ...prev[key] } };
      for (const k of Object.keys(patch)) delete (next[key] as any)[k];
      return next;
    });
  };

  const addRow = (base?: Partial<FormRow>) => {
    if (rows.length >= MAX_LINES) {
      toast.warning(`Maximum ${MAX_LINES} rows per save`);
      return;
    }
    const last = rows[rows.length - 1];
    const row = emptyRow(base ?? { INVOICE_DATE: last?.INVOICE_DATE });
    focusKey.current = row.key;
    setRows((prev) => [...prev, row]);
  };

  const duplicate = (r: FormRow) => addRow({ ...r, AMOUNT: '', DESCRIPTION: r.DESCRIPTION });

  const remove = (key: number) => {
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((r) => r.key !== key)));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const reset = () => {
    setRows([emptyRow()]);
    setNotes('');
    setErrors({});
  };

  const validate = (list: FormRow[]) => {
    const errs: Record<number, RowErrors> = {};
    for (const r of list) {
      const e: RowErrors = {};
      if (!r.INVOICE_DATE || r.INVOICE_DATE > today) e.INVOICE_DATE = true;
      if (!r.DESCRIPTION.trim()) e.DESCRIPTION = true;
      if (!r.BENEFICIARY.trim()) e.BENEFICIARY = true;
      if (!(parseAmount(r.AMOUNT) > 0)) e.AMOUNT = true;
      if (Object.keys(e).length) errs[r.key] = e;
    }
    return errs;
  };

  const save = async () => {
    const list = rows.filter((r) => !isBlank(r));
    if (!list.length) {
      toast.warning('Add at least one row');
      return;
    }
    const errs = validate(list);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = list.findIndex((r) => errs[r.key]);
      toast.error(`Check row ${rows.indexOf(list[first]) + 1} — fill the highlighted fields`);
      return;
    }

    const lines: PettyCashLineInput[] = list.map((r) => ({
      INVOICE_DATE: r.INVOICE_DATE,
      DESCRIPTION: r.DESCRIPTION.trim(),
      BENEFICIARY: r.BENEFICIARY.trim(),
      AMOUNT: parseAmount(r.AMOUNT),
      IS_TAX_INVOICE: r.IS_TAX_INVOICE,
      HAS_INVOICE: r.HAS_INVOICE,
    }));

    setSaving(true);
    try {
      const saved = await savePettyCash({ NOTES: notes, LINES: lines });
      toast.success(`${saved.ID} saved — ${saved.LINES_COUNT} row${saved.LINES_COUNT === 1 ? '' : 's'} · AED ${formatAmount(saved.TOTAL_AMOUNT)}`);
      reset();
      onSaved(saved);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const err = (key: number, field: keyof RowErrors) => (errors[key]?.[field] ? 'border-red-400 bg-red-50/40' : 'border-slate-200');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">New Petty Cash</h1>
        <div className="flex flex-wrap gap-2">
          <span className="px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
            <span className="text-slate-400 mr-1">Rows</span>
            {filled.length}
          </span>
          <span className="px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
            <span className="text-slate-400 mr-1">Tax Inv.</span>
            {formatAmount(taxTotal)}
          </span>
          <span className="px-3.5 py-2 rounded-xl bg-[#0a0f1d] text-sm font-black text-[#D4AF37] shadow-sm">AED {formatAmount(total)}</span>
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 flex items-center justify-center disabled:opacity-40"
            title="Clear"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || filled.length === 0}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-900/20 hover:brightness-105 flex items-center justify-center disabled:opacity-50"
            title={filled.length ? `Save ${filled.length} row${filled.length === 1 ? '' : 's'}` : 'Save'}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <datalist id="pc-beneficiaries">
        {suggestions.beneficiaries.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* Rows */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead>
              <tr className="bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.15em] text-[#D4AF37] text-center">
                <th className="py-4 px-2 w-10">#</th>
                <th className="py-4 px-2 w-[150px]">Invoice Date</th>
                <th className="py-4 px-2">Description</th>
                <th className="py-4 px-2 w-[220px]">Beneficiary</th>
                <th className="py-4 px-2 w-[130px]">Amount</th>
                <th className="py-4 px-2 w-[100px]">Tax Invoice</th>
                <th className="py-4 px-2 w-[100px]">Invoice</th>
                <th className="py-4 px-2 w-[84px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r, i) => (
                <tr key={r.key} className="hover:bg-slate-50/60">
                  <td className="py-2 px-2 text-center font-black text-slate-400">{i + 1}</td>
                  <td className="py-2 px-2">
                    <input
                      type="date"
                      value={r.INVOICE_DATE}
                      max={today}
                      onChange={(e) => update(r.key, { INVOICE_DATE: e.target.value })}
                      className={`${cellInput} ${err(r.key, 'INVOICE_DATE')}`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      id={`pc-desc-${r.key}`}
                      value={r.DESCRIPTION}
                      onChange={(e) => update(r.key, { DESCRIPTION: e.target.value })}
                      dir="auto"
                      maxLength={500}
                      className={`${cellInput} ${err(r.key, 'DESCRIPTION')}`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      value={r.BENEFICIARY}
                      onChange={(e) => update(r.key, { BENEFICIARY: e.target.value })}
                      list="pc-beneficiaries"
                      dir="auto"
                      maxLength={200}
                      placeholder="Paid to"
                      className={`${cellInput} ${err(r.key, 'BENEFICIARY')}`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      value={r.AMOUNT}
                      onChange={(e) => update(r.key, { AMOUNT: e.target.value.replace(/[^\d.,]/g, '') })}
                      onBlur={() => r.AMOUNT && update(r.key, { AMOUNT: parseAmount(r.AMOUNT) ? parseAmount(r.AMOUNT).toFixed(2) : '' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && i === rows.length - 1) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      className={`${cellInput} text-right ${err(r.key, 'AMOUNT')}`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <Toggle checked={r.IS_TAX_INVOICE} onChange={(v) => update(r.key, { IS_TAX_INVOICE: v })} onLabel="Tax ✓" offLabel="No" tone="gold" />
                  </td>
                  <td className="py-2 px-2">
                    <Toggle checked={r.HAS_INVOICE} onChange={(v) => update(r.key, { HAS_INVOICE: v })} onLabel="Yes ✓" offLabel="No" tone="green" />
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => duplicate(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50" title="Duplicate row">
                        <Copy className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => remove(r.key)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Remove row">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#FBF8EE] border-t-2 border-[#D4AF37]/40">
                <td colSpan={4} className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => addRow()}
                    disabled={rows.length >= MAX_LINES}
                    className="h-9 px-4 rounded-xl bg-white border border-amber-300 text-amber-800 text-sm font-black hover:bg-amber-50 flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" /> Add Row
                  </button>
                </td>
                <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap">{formatAmount(total)}</td>
                <td colSpan={3} className="py-3 px-3 text-xs font-bold text-slate-500 whitespace-nowrap">
                  {noInvoice > 0 ? <span className="text-red-600">{noInvoice} without invoice</span> : filled.length ? <span className="text-emerald-600">All have invoices</span> : null}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          dir="auto"
          maxLength={1000}
          className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
        />
      </div>
    </div>
  );
}
