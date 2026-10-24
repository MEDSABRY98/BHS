'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import { byName, formatAmount, formatPct, isFull, resolvePcts, splitAmount, type SplitItem } from '../Utils/AnalyticTypes';

interface SplitEditorProps {
  accounts: string[];           // active account names
  value: SplitItem[];
  onChange: (next: SplitItem[]) => void;
  amount?: number;              // shows the amount per account when given
}

/** Tick accounts; equal share unless a % is typed (fixed). Clear the % to go back to equal share. */
export default function SplitEditor({ accounts, value, onChange, amount }: SplitEditorProps) {
  const [search, setSearch] = useState('');
  const { pcts, total } = resolvePcts(value);
  const amounts = amount !== undefined ? splitAmount(amount, pcts) : [];

  const names = useMemo(() => {
    const all = new Set([...accounts, ...value.map((v) => v.ACCOUNT)]);
    const q = search.trim().toLowerCase();
    return Array.from(all).filter((n) => !q || n.toLowerCase().includes(q)).sort(byName);
  }, [accounts, value, search]);

  const set = (next: SplitItem[]) => onChange([...next].sort((a, b) => byName(a.ACCOUNT, b.ACCOUNT)));
  const toggle = (name: string) => {
    const on = value.some((v) => v.ACCOUNT === name);
    set(on ? value.filter((v) => v.ACCOUNT !== name) : [...value, { ACCOUNT: name, PCT: null }]);
  };
  const setPct = (name: string, raw: string) => {
    const t = raw.trim();
    const n = t === '' ? null : Math.min(100, Math.max(0, Number(t.replace(/,/g, '')) || 0));
    set(value.map((v) => (v.ACCOUNT === name ? { ...v, PCT: n } : v)));
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
            <button type="button" onClick={() => set(value.map((v) => ({ ...v, PCT: null })))} className="h-10 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
              Split Equally
            </button>
          )}
          {value.length > 0 && (
            <span className={`h-10 px-3 rounded-xl flex items-center ${isFull(total) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {formatPct(total)}
              {isFull(total) ? ' ✓' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {names.map((name) => {
          const i = value.findIndex((v) => v.ACCOUNT === name);
          const on = i >= 0;
          const fixed = on && value[i].PCT !== null;
          return (
            <div
              key={name}
              className={`rounded-xl border px-3 py-2.5 flex items-center gap-2 transition-colors ${
                fixed ? 'border-violet-300 bg-violet-50' : on ? 'border-[#C4A052] bg-[#C4A052]/10' : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
              }`}
            >
              <button type="button" onClick={() => toggle(name)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-black border-black' : 'bg-white border-slate-300'}`}>
                  {on && <Check className="w-3.5 h-3.5 text-[#C4A052]" />}
                </span>
                <span className="text-[13px] font-bold text-slate-800 truncate" title={name}>
                  {name}
                </span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <input
                  key={`${name}-${on ? pcts[i] : ''}-${fixed}`}
                  defaultValue={on ? pcts[i].toFixed(2) : ''}
                  disabled={!on}
                  inputMode="decimal"
                  onBlur={(e) => on && e.target.value !== pcts[i].toFixed(2) && setPct(name, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  className={`w-[68px] h-8 rounded-lg border text-center text-[13px] font-bold tabular-nums disabled:opacity-30 ${fixed ? 'border-violet-400 text-violet-700' : 'border-slate-200 text-slate-700'}`}
                  aria-label={`${name} %`}
                />
                <span className="text-xs text-slate-400">%</span>
              </div>
              {amount !== undefined && <span className="w-[76px] text-right text-[12px] font-semibold text-slate-500 tabular-nums shrink-0">{on ? formatAmount(amounts[i]) : ''}</span>}
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
