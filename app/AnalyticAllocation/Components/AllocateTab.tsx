'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, FileSpreadsheet, FileText, Layers, Loader2, Pencil, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import Modal from './Modal';
import SplitEditor from './SplitEditor';
import { saveAllocation } from '../Service/AnalyticService';
import { exportAllocationExcel, exportAllocationPdf } from '../Utils/AnalyticExport';
import { shortId, computeAllocation, formatAmount, formatPct, isFull, lineLabel, resolvePcts, round2, splitKey, uaeToday, type Allocation, type AllocationPerson, type AnalyticPerson } from '../Utils/AnalyticTypes';

interface AllocateTabProps {
  people: AnalyticPerson[];
  accountNames: string[];
  projectNames: string[];
  editAllocation?: Allocation | null; // admin edit from the archive
  onSaved: (a: Allocation, isEdit: boolean) => void;
  onCancelEdit?: () => void;
}

const field = 'w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]';
const typing = (raw: string) => {
  let v = raw.replace(/[^\d.]/g, '');
  const dot = v.indexOf('.');
  if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  const [int, dec] = v.split('.');
  const intFmt = (int.replace(/^0+(?=\d)/, '') || (dec !== undefined ? '0' : '')).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec !== undefined ? `${intFmt}.${dec}` : intFmt;
};

export default function AllocateTab({ people, accountNames, projectNames, editAllocation, onSaved, onCancelEdit }: AllocateTabProps) {
  const [title, setTitle] = useState(editAllocation?.TITLE || '');
  const [date, setDate] = useState(editAllocation?.ALLOC_DATE || uaeToday());
  const [notes, setNotes] = useState(editAllocation?.NOTES || '');
  // each person has his own amount; an old allocation (one total split by %) gets its amounts filled in
  const [chosen, setChosen] = useState<AllocationPerson[]>(() => {
    if (!editAllocation) return [];
    const old = computeAllocation(editAllocation.AMOUNT, editAllocation.PEOPLE);
    return editAllocation.PEOPLE.map((p, i) => ({
      ...p,
      PERSON_ID: p.PERSON_ID ?? people.find((x) => x.NAME === p.NAME)?.ID ?? null, // old allocations: link by name
      PCT: null,
      AMOUNT: p.AMOUNT ?? old.persons[i]?.AMOUNT ?? 0,
    }));
  });
  const [amountTexts, setAmountTexts] = useState<Record<string, string>>(() =>
    Object.fromEntries(chosen.map((c) => [c.NAME, c.AMOUNT ? typing(String(c.AMOUNT)) : ''])),
  );
  const [search, setSearch] = useState('');
  const [splitFor, setSplitFor] = useState<number | null>(null);
  const [splitDraft, setSplitDraft] = useState<AllocationPerson['SPLIT']>([]);
  const [busy, setBusy] = useState<'save' | 'pdf' | 'excel' | null>(null);

  const amount = round2(chosen.reduce((s, c) => s + (Number(c.AMOUNT) || 0), 0));
  const calc = useMemo(() => computeAllocation(amount, chosen), [amount, chosen]);
  // people whose analytic accounts are shown (the accounts column is an icon that opens / closes them)
  const [openAccounts, setOpenAccounts] = useState<Set<string>>(new Set());
  const toggleAccounts = (name: string) =>
    setOpenAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const byName = useMemo(() => new Map(people.map((p) => [p.NAME, p])), [people]);
  const byId = useMemo(() => new Map(people.map((p) => [p.ID, p])), [people]);
  const personOf = (c: AllocationPerson) => (c.PERSON_ID ? byId.get(c.PERSON_ID) : byName.get(c.NAME));
  const isChosen = (p: AnalyticPerson) => chosen.some((c) => (c.PERSON_ID ? c.PERSON_ID === p.ID : c.NAME === p.NAME));

  const [pending, setPending] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Active people not added yet
  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => p.IS_ACTIVE && !isChosen(p) && (!q || p.NAME.toLowerCase().includes(q) || p.NOTES.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, search, chosen]);

  const sortChosen = (list: AllocationPerson[]) => [...list].sort((a, b) => a.NAME.localeCompare(b.NAME, 'en', { sensitivity: 'base' }));
  /** Adds the ticked people (or the only match when nothing is ticked). */
  const addPending = () => {
    const names = pending.length ? pending : pickable.length === 1 ? [pickable[0].NAME] : [];
    const add = people.filter((p) => names.includes(p.NAME) && !isChosen(p)).map((p) => ({ PERSON_ID: p.ID, NAME: p.NAME, PCT: null, AMOUNT: null, SPLIT: p.ACCOUNTS }));
    if (!add.length) return;
    setChosen((prev) => sortChosen([...prev, ...add]));
    setPending([]);
    setSearch('');
    setPickerOpen(false);
  };
  const setAmount = (name: string, raw: string) => {
    const text = typing(raw);
    const n = text === '' ? null : round2(Number(text.replace(/,/g, '')) || 0);
    setAmountTexts((prev) => ({ ...prev, [name]: text }));
    setChosen((prev) => prev.map((c) => (c.NAME === name ? { ...c, AMOUNT: n } : c)));
  };

  const source = () => ({ TITLE: title.trim() || 'Analytic Allocation', ALLOC_DATE: date, AMOUNT: amount, NOTES: notes, PEOPLE: chosen });
  // a missing amount is already shown by the red input, so it is not listed in the warning box
  const shownProblems = calc.problems.filter((p) => !p.endsWith(': enter the amount'));
  const canUse = amount > 0 && chosen.length > 0 && !calc.problems.length;

  const save = async () => {
    setBusy('save');
    try {
      const saved = await saveAllocation({ ID: editAllocation?.ID, TITLE: title, ALLOC_DATE: date, AMOUNT: amount, NOTES: notes, PEOPLE: chosen });
      toast.success(editAllocation ? 'Allocation updated' : 'Allocation saved to the archive');
      onSaved(saved, !!editAllocation);
      if (!editAllocation) clear();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  const run = async (kind: 'pdf' | 'excel') => {
    setBusy(kind);
    try {
      await (kind === 'pdf' ? exportAllocationPdf(source()) : exportAllocationExcel(source()));
    } catch (e: any) {
      toast.error(e?.message || 'Could not create the file');
    } finally {
      setBusy(null);
    }
  };

  const clear = () => {
    setTitle('');
    setDate(uaeToday());
    setAmountTexts({});
    setNotes('');
    setChosen([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{editAllocation ? `Edit Allocation #${shortId(editAllocation.ID)}` : 'Allocate'}</h1>
        {editAllocation && onCancelEdit && (
          <button onClick={onCancelEdit} className="self-start h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-1.5">
            <X className="w-4 h-4" /> Cancel Edit
          </button>
        )}
      </div>

      {/* Details: date, title, notes (the amount is typed per person below) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mobile Bills – September 2026" dir="auto" className={field} />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" dir="auto" className={field} />
        </label>
      </div>

      {/* Search + Add */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1" ref={pickerRef}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setPickerOpen(false);
              if (e.key === 'Enter') addPending();
            }}
            placeholder="Search people to add…"
            dir="auto"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]"
          />
          {pickerOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-2">
              <div className="max-h-[320px] overflow-y-auto space-y-0.5">
                {pickable.map((p) => {
                  const on = pending.includes(p.NAME);
                  return (
                    <button key={p.ID} type="button" onClick={() => setPending((prev) => (on ? prev.filter((n) => n !== p.NAME) : [...prev, p.NAME]))} className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-left ${on ? 'bg-[#C4A052]/10' : 'hover:bg-slate-50'}`}>
                      <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-black border-black' : 'bg-white border-slate-300'}`}>{on && <Check className="w-3.5 h-3.5 text-[#C4A052]" />}</span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-slate-800 truncate" dir="auto">{p.NAME}</span>
                        <span className="block text-[11px] font-semibold text-slate-400 truncate">{p.ACCOUNTS.length ? p.ACCOUNTS.map((a) => a.ACCOUNT).join(' · ') : 'No accounts'}</span>
                      </span>
                    </button>
                  );
                })}
                {!pickable.length && <NoData title={people.length ? (chosen.length && !search ? 'EVERYONE IS ADDED' : 'NO MATCHING PEOPLE') : 'NO PEOPLE YET'} message={people.length ? undefined : 'Add people in the People tab first'} />}
              </div>
              {pickable.length > 1 && (
                <div className="flex justify-between gap-2 pt-2 mt-1 border-t border-slate-100 text-xs font-bold">
                  <button type="button" onClick={() => setPending(pickable.map((p) => p.NAME))} className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50">Select all ({pickable.length})</button>
                  {pending.length > 0 && <button type="button" onClick={() => setPending([])} className="px-3 py-1.5 rounded-lg text-slate-400 hover:bg-slate-50">Clear selection</button>}
                </div>
              )}
            </div>
          )}
        </div>
        <button onClick={addPending} disabled={!pending.length && pickable.length !== 1} className="h-11 px-5 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
          <Plus className="w-4 h-4" /> Add{pending.length ? ` (${pending.length})` : ''}
        </button>
      </div>

      {/* Chosen people */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                <th className="py-4 px-3 w-12">#</th>
                <th className="py-4 px-3">Person</th>
                <th className="py-4 px-3">Amount (AED)</th>
                <th className="py-4 px-3">% of Total</th>
                <th className="py-4 px-3">Analytic Accounts</th>
                <th className="py-4 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {chosen.map((c, i) => {
                const r = calc.persons[i];
                const split = resolvePcts(c.SPLIT);
                const def = personOf(c);
                const changed = def && JSON.stringify(def.ACCOUNTS) !== JSON.stringify(c.SPLIT);
                const isOpen = openAccounts.has(c.NAME);
                const splitOk = c.SPLIT.length > 0 && isFull(split.total);
                return (
                  <Fragment key={c.NAME}>
                  <tr className="text-center align-middle">
                    <td className="py-3 px-3 text-xs font-bold text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="py-3 px-3 font-bold text-slate-800" dir="auto">{c.NAME}</td>
                    <td className="py-3 px-3">
                      <input
                        value={amountTexts[c.NAME] ?? ''}
                        onChange={(e) => setAmount(c.NAME, e.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        className={`w-[130px] h-9 px-3 rounded-lg border text-center font-black tabular-nums focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052] ${c.AMOUNT ? 'border-slate-200 text-slate-900' : 'border-red-200 bg-red-50/40'}`}
                      />
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-500 tabular-nums">{c.AMOUNT ? `${(r?.PCT ?? 0).toFixed(2)}%` : '-'}</td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => toggleAccounts(c.NAME)}
                        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-bold transition-colors ${
                          !splitOk
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : changed
                              ? 'border-violet-200 bg-violet-50 text-violet-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-[#C4A052] hover:text-black'
                        }`}
                        title={isOpen ? 'Hide the analytic accounts' : 'Show the analytic accounts'}
                      >
                        <Layers className="w-4 h-4" />
                        {c.SPLIT.length ? c.SPLIT.length : '!'}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => {
                            setSplitFor(i);
                            setSplitDraft(c.SPLIT);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100"
                          title="Change accounts for this allocation"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {changed && (
                          <button onClick={() => setChosen((prev) => prev.map((x) => (x.NAME === c.NAME ? { ...x, SPLIT: def!.ACCOUNTS } : x)))} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50" title="Back to the person's default">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setChosen((prev) => prev.filter((x) => x.NAME !== c.NAME))} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Remove">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={6} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {c.SPLIT.length ? (
                            c.SPLIT.map((s, k) => (
                              <span key={splitKey(s)} className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${s.PCT !== null ? 'bg-violet-50 text-violet-700' : 'bg-[#C4A052]/10 text-slate-700'}`}>
                                {lineLabel(s.ACCOUNT, s.PROJECT)} {split.pcts[k].toFixed(2)}%
                              </span>
                            ))
                          ) : (
                            <span className="text-xs font-bold text-red-500">No accounts</span>
                          )}
                          {c.SPLIT.length > 0 && !isFull(split.total) && <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-red-600">{formatPct(split.total)}</span>}
                        </div>
                        {changed && <p className="text-[10px] font-bold text-violet-500 mt-1.5 text-center">Changed for this allocation only</p>}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {!chosen.length && <NoData isTable colSpan={6} title="NO PEOPLE ADDED" message="Search above and press Add" />}
            </tbody>
            {chosen.length > 0 && (
              <tfoot>
                <tr className="text-center font-black border-t-2 border-[#C4A052] bg-[#C4A052]/5">
                  <td className="py-3 px-3" />
                  <td className="py-3 px-3">Total</td>
                  <td className="py-3 px-3 tabular-nums">{formatAmount(amount)}</td>
                  <td className="py-3 px-3 tabular-nums">{amount > 0 ? '100.00%' : '-'}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Analysis by account */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-black text-slate-900">Analysis by Analytic Account</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void run('excel')} disabled={!canUse || !!busy} className="h-10 w-32 px-3 rounded-xl border border-slate-200 text-sm font-bold text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5 disabled:opacity-40">
              {busy === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Excel
            </button>
            <button onClick={() => void run('pdf')} disabled={!canUse || !!busy} className="h-10 w-32 px-3 rounded-xl border border-slate-200 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-40">
              {busy === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} PDF
            </button>
            {!editAllocation && (
              <button onClick={clear} disabled={!!busy} className="h-10 w-32 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                <RotateCcw className="w-4 h-4" /> Clear
              </button>
            )}
            <button onClick={() => void save()} disabled={!canUse || !title.trim() || !!busy} className="h-10 w-32 px-3 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
            </button>
          </div>
        </div>

        {shownProblems.length > 0 && chosen.length > 0 && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm font-semibold text-red-600 space-y-0.5">
            {shownProblems.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 text-center border-b border-slate-100">
                <th className="py-3 px-3">Analytic Account</th>
                <th className="py-3 px-3">Amount (AED)</th>
                <th className="py-3 px-3">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {calc.accounts.map((a) => (
                <Fragment key={splitKey(a)}>
                  <tr className="text-center bg-slate-50/70">
                    <td className="py-2.5 px-3 font-black text-slate-900">{lineLabel(a.ACCOUNT, a.PROJECT)}</td>
                    <td className="py-2.5 px-3 font-black tabular-nums">{formatAmount(a.AMOUNT)}</td>
                    <td className="py-2.5 px-3 font-black tabular-nums">{a.PCT.toFixed(2)}%</td>
                  </tr>
                  {/* the beneficiaries under the account, its % split between them */}
                  {a.PEOPLE.map((p) => (
                    <tr key={`${splitKey(a)}|${p.NAME}`} className="text-center text-[13px] text-slate-500">
                      <td className="py-2 px-3" dir="auto">
                        <span className="text-[#C4A052] mr-1.5">↳</span>
                        {p.NAME}
                      </td>
                      <td className="py-2 px-3 tabular-nums">{formatAmount(p.AMOUNT)}</td>
                      <td className="py-2 px-3 tabular-nums">{p.PCT.toFixed(2)}%</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {!calc.accounts.length && <NoData isTable colSpan={3} title="NO ALLOCATION YET" message="Choose people and enter their amounts" />}
            </tbody>
            {calc.accounts.length > 0 && (
              <tfoot>
                <tr className="text-center font-black border-t-2 border-[#C4A052] bg-[#C4A052]/5">
                  <td className="py-3 px-3">Total</td>
                  <td className="py-3 px-3 tabular-nums">{formatAmount(calc.allocated)}</td>
                  <td className="py-3 px-3 tabular-nums">100.00%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <Modal
        open={splitFor !== null}
        title={splitFor !== null ? chosen[splitFor]?.NAME : ''}
        subtitle="Changes apply to this allocation only — the person's default stays the same"
        onClose={() => setSplitFor(null)}
        footer={
          <>
            <button onClick={() => setSplitFor(null)} className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => {
                if (splitFor === null) return;
                const name = chosen[splitFor].NAME;
                setChosen((prev) => prev.map((x) => (x.NAME === name ? { ...x, SPLIT: splitDraft } : x)));
                setSplitFor(null);
              }}
              disabled={!splitDraft.length || !isFull(resolvePcts(splitDraft).total)}
              className="h-11 px-6 rounded-xl bg-black text-[#C4A052] text-sm font-bold disabled:opacity-40"
            >
              Apply
            </button>
          </>
        }
      >
        {splitFor !== null && <SplitEditor accounts={accountNames} projects={projectNames} value={splitDraft} onChange={setSplitDraft} amount={calc.persons[splitFor]?.AMOUNT} />}
      </Modal>
    </div>
  );
}
