'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FolderOpen, Loader2, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import SuggestInput from './SuggestInput';
import EmployeePicker from './EmployeePicker';
import {
  getAccountSuggestions,
  getMyOpenPettyCash,
  getPettyCashSuggestions,
  listPettyCashEmployees,
  savePettyCash,
  updatePettyCash,
} from '../Service/PettyCashService';
import {
  MAX_LINES,
  MAX_OPEN_LINES,
  formatAmount,
  formatDate,
  round2,
  uaeDateOf,
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
  ACCOUNT: string;
  LINE_ID?: number;
};

type RowErrors = Partial<Record<'INVOICE_DATE' | 'DESCRIPTION' | 'BENEFICIARY' | 'AMOUNT', true>>;

interface PettyCashFormProps {
  onSaved: (p: PettyCash, isEdit: boolean) => void;
  editItem?: PettyCash | null;   // edit mode: admin (any) or the employee (his open one)
  onCancelEdit?: () => void;
  admin: boolean;
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
  ACCOUNT: base?.ACCOUNT ?? '',
  LINE_ID: base?.LINE_ID,
});

const rowsFrom = (p: PettyCash): FormRow[] =>
  p.LINES.map((l) =>
    emptyRow({
      INVOICE_DATE: l.INVOICE_DATE,
      DESCRIPTION: l.DESCRIPTION,
      BENEFICIARY: l.BENEFICIARY,
      AMOUNT: formatAmount(l.AMOUNT),
      IS_TAX_INVOICE: l.IS_TAX_INVOICE,
      HAS_INVOICE: l.HAS_INVOICE,
      ACCOUNT: l.ACCOUNT || '',
      LINE_ID: l.ID,
    }),
  );

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

/** Keeps the caret after the same digit once commas are added / removed. */
function onAmountInput(e: React.ChangeEvent<HTMLInputElement>, set: (v: string) => void) {
  const el = e.target;
  const caret = el.selectionStart ?? el.value.length;
  const digitsBefore = el.value.slice(0, caret).replace(/[^\d.]/g, '').length;
  const next = formatTyping(el.value);
  set(next);
  requestAnimationFrame(() => {
    let seen = 0;
    let pos = next.length;
    for (let i = 0; i < next.length; i++) {
      if (seen === digitsBefore) {
        pos = i;
        break;
      }
      if (/[\d.]/.test(next[i])) seen++;
    }
    if (digitsBefore === 0) pos = 0;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // ignore
    }
  });
}
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

export default function PettyCashForm({ onSaved, editItem = null, onCancelEdit, admin }: PettyCashFormProps) {
  const isEdit = !!editItem;
  const showAccount = isEdit && admin; // the account column is the admin's only
  const maxRows = isEdit ? MAX_OPEN_LINES : MAX_LINES;
  const [openPc, setOpenPc] = useState<{ ID: string; LINES_COUNT: number; TOTAL_AMOUNT: number } | null | undefined>(undefined);
  const [rows, setRows] = useState<FormRow[]>(() => (editItem && editItem.LINES.length ? rowsFrom(editItem) : [emptyRow()]));
  const [notes, setNotes] = useState(editItem?.NOTES || '');
  const [accounts, setAccounts] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<number, RowErrors>>({});
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{ beneficiaries: string[]; descriptions: string[] }>({ beneficiaries: [], descriptions: [] });
  const focusKey = useRef<number | null>(null);
  const today = uaeToday();
  // admin only (new or edit): the employee it is for - any name; new: '' = himself
  const pickEmployee = admin;
  const [employeeInput, setEmployeeInput] = useState(editItem?.EMPLOYEE_NAME || '');
  const [employeeNames, setEmployeeNames] = useState<string[]>([]);
  const employeeName = pickEmployee ? employeeInput.trim() : '';
  const [lookupName, setLookupName] = useState(''); // employeeName, after the user stops typing

  useEffect(() => {
    getPettyCashSuggestions().then(setSuggestions).catch(() => {});
    if (showAccount) getAccountSuggestions().then(setAccounts).catch(() => {});
    if (pickEmployee) listPettyCashEmployees().then(setEmployeeNames).catch(() => setEmployeeNames([]));
  }, [showAccount, pickEmployee]);

  useEffect(() => {
    const t = setTimeout(() => setLookupName(employeeName), 400);
    return () => clearTimeout(t);
  }, [employeeName]);

  // the open petty cash for this employee name (or the user himself)
  useEffect(() => {
    if (isEdit) return;
    let alive = true;
    setOpenPc(undefined);
    getMyOpenPettyCash(lookupName || undefined)
      .then((pc) => alive && setOpenPc(pc))
      .catch(() => alive && setOpenPc(null));
    return () => {
      alive = false;
    };
  }, [isEdit, lookupName]);

  // focus the description of a newly added row
  useEffect(() => {
    if (focusKey.current == null) return;
    const el = document.getElementById(`pc-desc-${focusKey.current}`) as HTMLInputElement | null;
    el?.focus();
    focusKey.current = null;
  }, [rows.length]);

  const filled = rows.filter((r) => !isBlank(r));
  const total = useMemo(() => round2(filled.reduce((s, r) => s + parseAmount(r.AMOUNT), 0)), [filled]);
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
    if (rows.length >= maxRows) {
      toast.warning(`Maximum ${maxRows} rows${isEdit ? '' : ' per save'}`);
      return;
    }
    const last = rows[rows.length - 1];
    const row = emptyRow(base ?? { INVOICE_DATE: last?.INVOICE_DATE });
    focusKey.current = row.key;
    setRows((prev) => [...prev, row]);
  };

  const duplicate = (r: FormRow) => addRow({ ...r, AMOUNT: '' });

  const remove = (key: number) => {
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((r) => r.key !== key)));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const reset = () => {
    setRows(editItem && editItem.LINES.length ? rowsFrom(editItem) : [emptyRow()]);
    setNotes(editItem?.NOTES || '');
    setEmployeeInput(editItem?.EMPLOYEE_NAME || '');
    setErrors({});
  };

  const validate = (list: FormRow[]) => {
    const errs: Record<number, RowErrors> = {};
    for (const r of list) {
      const e: RowErrors = {};
      if (!r.INVOICE_DATE || (!admin && r.INVOICE_DATE > today)) e.INVOICE_DATE = true;
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
      ...(showAccount ? { ACCOUNT: r.ACCOUNT.trim() } : {}),
      ...(isEdit && r.LINE_ID ? { LINE_ID: r.LINE_ID } : {}),
    }));

    setSaving(true);
    try {
      if (editItem) {
        const saved = await updatePettyCash(editItem.ID, { NOTES: notes, LINES: lines, ...(employeeName ? { EMPLOYEE_NAME: employeeName } : {}) });
        toast.success(`${saved.ID} updated — AED ${formatAmount(saved.TOTAL_AMOUNT)}`);
        onSaved(saved, true);
        return;
      }
      const saved = await savePettyCash({ NOTES: notes, LINES: lines, ...(employeeName ? { EMPLOYEE_NAME: employeeName } : {}) });
      toast.success(`${lines.length} row${lines.length === 1 ? '' : 's'} added to ${saved.ID} — now ${saved.LINES_COUNT} rows · AED ${formatAmount(saved.TOTAL_AMOUNT)}`);
      setOpenPc({ ID: saved.ID, LINES_COUNT: saved.LINES_COUNT, TOTAL_AMOUNT: saved.TOTAL_AMOUNT });
      const keepEmployee = employeeInput; // the next rows are usually for the same employee
      reset();
      setEmployeeInput(keepEmployee);
      onSaved(saved, false);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const err = (key: number, field: keyof RowErrors) => (errors[key]?.[field] ? 'border-red-400 bg-red-50/40' : 'border-slate-200');
  const align = isEdit ? 'text-center' : ''; // edit mode: centered cells

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {editItem ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-11 h-11 rounded-2xl bg-[#0a0f1d] text-[#D4AF37] flex items-center justify-center shrink-0">
              <Pencil className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Edit {editItem.ID}</h1>
              <p className="text-sm font-semibold text-slate-400 truncate">
                {editItem.EMPLOYEE_NAME}
                {editItem.CREATED_BY && editItem.CREATED_BY !== editItem.EMPLOYEE_NAME ? ` · recorded by ${editItem.CREATED_BY}` : ''} ·{' '}
                {formatDate(uaeDateOf(editItem.CREATED_AT))}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">New Petty Cash</h1>
            {openPc !== undefined && (
              <p className="mt-1 text-sm font-semibold text-slate-400 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
                {openPc ? (
                  <span>
                    Adding to {employeeName ? <span dir="auto">{employeeName}&apos;s</span> : 'your'} open <span className="font-black text-slate-700">{openPc.ID}</span> · {openPc.LINES_COUNT} row{openPc.LINES_COUNT === 1 ? '' : 's'} · AED {formatAmount(openPc.TOTAL_AMOUNT)}
                  </span>
                ) : (
                  <span>A new open petty cash{employeeName ? <> for <span dir="auto">{employeeName}</span></> : ''} will start with these rows</span>
                )}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {pickEmployee && (
            <EmployeePicker
              value={employeeInput}
              names={employeeNames}
              onChange={setEmployeeInput}
              disabled={saving}
              placeholder={editItem ? editItem.EMPLOYEE_NAME || editItem.CREATED_BY : 'Myself'}
            />
          )}
          <span className="px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
            <span className="text-slate-400 mr-1">Rows</span>
            {filled.length}
          </span>
          <span className="px-3.5 py-2 rounded-xl bg-[#0a0f1d] text-sm font-black text-[#D4AF37] shadow-sm">AED {formatAmount(total)}</span>
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
            disabled={saving || filled.length === 0}
            className="w-10 h-10 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-lg shadow-amber-900/20 hover:brightness-105 flex items-center justify-center disabled:opacity-50"
            title={isEdit ? 'Save changes' : filled.length ? `Save ${filled.length} row${filled.length === 1 ? '' : 's'}` : 'Save'}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm ${showAccount ? 'min-w-[1200px]' : 'min-w-[980px]'}`}>
            <thead>
              <tr className="bg-[#0a0f1d] text-[11px] font-black uppercase tracking-[0.15em] text-[#D4AF37] text-center">
                <th className="py-4 px-2 w-10">#</th>
                <th className="py-4 px-2 w-[150px]">Invoice Date</th>
                <th className="py-4 px-2">Description</th>
                {showAccount && <th className="py-4 px-2 w-[220px]">Account</th>}
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
                      max={admin ? undefined : today}
                      onChange={(e) => update(r.key, { INVOICE_DATE: e.target.value })}
                      className={`${cellInput} ${align} ${err(r.key, 'INVOICE_DATE')}`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      id={`pc-desc-${r.key}`}
                      value={r.DESCRIPTION}
                      onChange={(e) => update(r.key, { DESCRIPTION: e.target.value })}
                      dir="auto"
                      maxLength={500}
                      className={`${cellInput} ${align} ${err(r.key, 'DESCRIPTION')}`}
                    />
                  </td>
                  {showAccount && (
                    <td className="py-2 px-2">
                      <SuggestInput
                        value={r.ACCOUNT}
                        onChange={(v) => update(r.key, { ACCOUNT: v })}
                        suggestions={accounts}
                        maxLength={200}
                        placeholder="Account"
                        emptyHint="Type a new account"
                        className={`${cellInput} ${align} ${r.ACCOUNT.trim() ? 'border-[#D4AF37]/60 bg-[#FBF8EE]' : 'border-dashed border-slate-300'}`}
                      />
                    </td>
                  )}
                  <td className="py-2 px-2">
                    <SuggestInput
                      value={r.BENEFICIARY}
                      onChange={(v) => update(r.key, { BENEFICIARY: v })}
                      suggestions={suggestions.beneficiaries}
                      maxLength={200}
                      placeholder="Paid to"
                      className={`${cellInput} ${align} ${err(r.key, 'BENEFICIARY')}`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      value={r.AMOUNT}
                      onChange={(e) => onAmountInput(e, (v) => update(r.key, { AMOUNT: v }))}
                      onBlur={() => r.AMOUNT && update(r.key, { AMOUNT: parseAmount(r.AMOUNT) ? formatAmount(parseAmount(r.AMOUNT)) : '' })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && i === rows.length - 1) {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                      inputMode="decimal"
                      placeholder="0.00"
                      className={`${cellInput} ${isEdit ? 'text-center' : 'text-right'} ${err(r.key, 'AMOUNT')}`}
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
                <td colSpan={showAccount ? 5 : 4} className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => addRow()}
                    disabled={rows.length >= maxRows}
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
