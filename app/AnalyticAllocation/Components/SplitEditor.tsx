'use client';

import { useMemo, useState } from 'react';
import { Check, FolderPlus, Search, X } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { byAccountProject, byName, formatAmount, formatPct, isFull, mkSplitItem, resolvePcts, splitAmount, splitKey, type SplitItem } from '../Utils/AnalyticTypes';

interface SplitEditorProps {
  accounts: string[];           // active account names
  projects?: string[];          // active project names (optional on every line)
  value: SplitItem[];
  onChange: (next: SplitItem[]) => void;
  amount?: number;              // shows the amount per account when given
}

/**
 * Tick accounts; equal share unless a % is typed (fixed). Clear the % to go back to equal share.
 * A ticked account can get more lines with a project (like Odoo: the account without a project, then with it).
 */
export default function SplitEditor({ accounts, projects = [], value, onChange, amount }: SplitEditorProps) {
  const [search, setSearch] = useState('');
  const { pcts, total } = resolvePcts(value);
  const amounts = amount !== undefined ? splitAmount(amount, pcts) : [];

  const names = useMemo(() => {
    const all = new Set([...accounts, ...value.map((v) => v.ACCOUNT)]);
    const q = search.trim().toLowerCase();
    return Array.from(all).filter((n) => !q || n.toLowerCase().includes(q)).sort(byName);
  }, [accounts, value, search]);

  const set = (next: SplitItem[]) => onChange([...next].sort(byAccountProject));
  const linesOf = (name: string) => value.filter((v) => v.ACCOUNT === name);
  const toggle = (name: string) => set(linesOf(name).length ? value.filter((v) => v.ACCOUNT !== name) : [...value, mkSplitItem(name, null)]);
  const same = (a: SplitItem, b: SplitItem) => splitKey(a) === splitKey(b);

  const setPct = (item: SplitItem, raw: string) => {
    const t = raw.trim();
    const n = t === '' ? null : Math.min(100, Math.max(0, Number(t.replace(/,/g, '')) || 0));
    set(value.map((v) => (same(v, item) ? mkSplitItem(v.ACCOUNT, n, v.PROJECT) : v)));
  };
  const setProject = (item: SplitItem, project: string) => set(value.map((v) => (same(v, item) ? mkSplitItem(v.ACCOUNT, v.PCT, project) : v)));
  const removeLine = (item: SplitItem) => set(value.filter((v) => !same(v, item)));
  /** a new line of the same account with the first project not used yet */
  const freeProject = (name: string) => {
    const used = new Set(linesOf(name).map((l) => l.PROJECT || ''));
    return [...projects, ''].find((p) => !used.has(p));
  };
  const addProjectLine = (name: string) => {
    const p = freeProject(name);
    if (p !== undefined) set([...value, mkSplitItem(name, null, p)]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold">
          {value.length > 0 && (
            <button type="button" onClick={() => set(value.map((v) => mkSplitItem(v.ACCOUNT, null, v.PROJECT)))} className="h-10 w-32 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap flex items-center justify-center">
              Split Equally
            </button>
          )}
          {value.length > 0 && (
            <span className={`h-10 w-32 px-3 rounded-xl flex items-center justify-center whitespace-nowrap ${isFull(total) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {formatPct(total)}
              {isFull(total) ? ' ✓' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {names.map((name) => {
          const lines = linesOf(name);
          const on = lines.length > 0;
          const anyFixed = lines.some((l) => l.PCT !== null);
          const canAddProject = on && freeProject(name) !== undefined && (projects.length > 0 || lines.some((l) => l.PROJECT));
          return (
            <div
              key={name}
              className={`rounded-xl border px-3 py-2.5 flex flex-col gap-2 transition-colors ${
                anyFixed ? 'border-violet-300 bg-violet-50' : on ? 'border-[#C4A052] bg-[#C4A052]/10' : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <button type="button" onClick={() => toggle(name)} className="flex items-center gap-2 min-w-0 text-left">
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-black border-black' : 'bg-white border-slate-300'}`}>
                  {on && <Check className="w-3.5 h-3.5 text-[#C4A052]" />}
                </span>
                <span className="text-[13px] font-bold text-slate-800 break-words" title={name}>
                  {name}
                </span>
              </button>

              {!on && (
                <div className="flex items-center gap-1 pl-7">
                  <input disabled className="w-[76px] h-8 rounded-lg border border-slate-200 text-center text-[13px] disabled:opacity-30" aria-label={`${name} %`} />
                  <span className="text-xs text-slate-400">%</span>
                </div>
              )}

              {lines.map((line) => {
                const i = value.findIndex((v) => same(v, line));
                const fixed = line.PCT !== null;
                const usedByOthers = new Set(lines.filter((l) => !same(l, line)).map((l) => l.PROJECT || ''));
                const options = Array.from(new Set(['', ...projects, line.PROJECT || ''])).filter((p) => p === (line.PROJECT || '') || !usedByOthers.has(p));
                const showProject = projects.length > 0 || !!line.PROJECT || lines.length > 1;
                return (
                  <div key={splitKey(line)} className="pl-7 space-y-1.5">
                    {showProject && (
                      <div className="flex items-center gap-1">
                        <select
                          value={line.PROJECT || ''}
                          onChange={(e) => setProject(line, e.target.value)}
                          className="flex-1 min-w-0 h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-700"
                          aria-label={`${name} project`}
                        >
                          {options.map((p) => (
                            <option key={p} value={p}>
                              {p || 'No project'}
                            </option>
                          ))}
                        </select>
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(line)} className="w-8 h-8 shrink-0 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center" title="Remove this line">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          key={`${splitKey(line)}-${pcts[i]}-${fixed}`}
                          defaultValue={pcts[i].toFixed(2)}
                          inputMode="decimal"
                          onBlur={(e) => e.target.value !== pcts[i].toFixed(2) && setPct(line, e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                          className={`w-[76px] h-8 rounded-lg border text-center text-[13px] font-bold tabular-nums ${fixed ? 'border-violet-400 text-violet-700' : 'border-slate-200 text-slate-700'}`}
                          aria-label={`${name} %`}
                        />
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                      {amount !== undefined && <span className="text-[12px] font-semibold text-slate-500 tabular-nums">AED {formatAmount(amounts[i])}</span>}
                    </div>
                  </div>
                );
              })}

              {canAddProject && (
                <button type="button" onClick={() => addProjectLine(name)} className="ml-7 self-start inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-black">
                  <FolderPlus className="w-3.5 h-3.5" /> Add a line with a project
                </button>
              )}
            </div>
          );
        })}
        {!names.length && (
          <div className="col-span-full">
            <NoData title={accounts.length ? 'NO MATCHING ACCOUNTS' : 'NO ACCOUNTS YET'} message={accounts.length ? undefined : 'Add accounts in the Analytic Accounts tab first'} />
          </div>
        )}
      </div>
    </div>
  );
}
