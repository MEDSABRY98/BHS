'use client';

// Accounts tab (admin): every account written on the petty cash rows, with the number of rows and the total.
// Different spellings of the same account (Fuel / fuel / Petrol ...) are merged into one name here.
// "Similar" = same letters and digits, ignoring case, spaces and symbols.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Layers, Loader2, Pencil, Search, X } from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { listAccountsSummary, mergeAccounts, type AccountSummary } from '../Service/PettyCashService';
import { formatAmount } from '../Utils/PettyCashTypes';

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export default function PettyCashAccountsTab() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [without, setWithout] = useState({ lines: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mergeOpen, setMergeOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await listAccountsSummary();
      setAccounts(r.accounts);
      setWithout(r.withoutAccount);
      setError(null);
      setSelected((prev) => new Set(Array.from(prev).filter((n) => r.accounts.some((a) => a.name === n))));
    } catch (e: any) {
      setError(e?.message || 'Could not load the accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // rows that look like the same account
  const similarCount = useMemo(() => {
    const m = new Map<string, number>();
    accounts.forEach((a) => m.set(norm(a.name), (m.get(norm(a.name)) || 0) + 1));
    return m;
  }, [accounts]);
  const isSimilar = (a: AccountSummary) => (similarCount.get(norm(a.name)) || 0) > 1;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? accounts.filter((a) => a.name.toLowerCase().includes(q)) : accounts;
  }, [accounts, search]);

  const toggle = (name: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  const selectSimilar = (a: AccountSummary) => setSelected(new Set(accounts.filter((x) => norm(x.name) === norm(a.name)).map((x) => x.name)));

  const selectedRows = accounts.filter((a) => selected.has(a.name));
  const selectedLines = selectedRows.reduce((s, a) => s + a.lines, 0);

  const openMerge = (names: string[]) => {
    const rows = accounts.filter((a) => names.includes(a.name));
    if (rows.length === 0) return;
    setSelected(new Set(names));
    // suggest the most used spelling
    const best = [...rows].sort((a, b) => b.lines - a.lines)[0];
    setTarget(clean(best.name));
    setMergeOpen(true);
  };

  const confirmMerge = async () => {
    const to = clean(target);
    if (!to) return;
    setSaving(true);
    try {
      await mergeAccounts(Array.from(selected), to);
      toast.success(`${selectedLines} rows now use "${to}"`);
      setMergeOpen(false);
      setSelected(new Set());
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || 'Could not merge the accounts');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TabLoader className="!min-h-[70vh] flex-1" />;
  if (error && accounts.length === 0) return <TabFetchError message={error} onRetry={() => void load()} isRetrying={loading} className="min-h-[60vh]" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Accounts</h1>
        </div>
        <div className="self-start sm:self-auto flex items-center gap-2">
          <span className="px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
            <span className="text-slate-400 mr-1">{accounts.length} accounts ·</span>
            {without.lines} rows without account
          </span>
          <button
            onClick={() => openMerge(Array.from(selected))}
            disabled={selected.size < 1}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#1F3864] hover:bg-[#182E56] text-white text-sm font-bold shadow-sm disabled:opacity-40"
          >
            <Layers className="w-4 h-4" />
            Merge{selected.size ? ` (${selected.size})` : ''}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search accounts…"
            dir="auto"
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/25"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#182E56] text-white text-[11px] uppercase tracking-wider">
              <th className="w-12 py-3.5" />
              <th className="py-3.5 px-4 text-center">Account</th>
              <th className="py-3.5 px-4 text-center w-28">Rows</th>
              <th className="py-3.5 px-4 text-center w-44">Total (AED)</th>
              <th className="py-3.5 px-4 text-center w-48" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center font-bold text-slate-400">
                  {accounts.length === 0 ? 'No accounts yet. The admin writes the account on each row when editing a petty cash.' : 'No account matches your search'}
                </td>
              </tr>
            )}
            {shown.map((a) => {
              const on = selected.has(a.name);
              const similar = isSimilar(a);
              return (
                <tr key={a.name} className={on ? 'bg-[#FBF8EE]' : 'hover:bg-slate-50/60'}>
                  <td className="py-3 text-center">
                    <button
                      onClick={() => toggle(a.name)}
                      className={`w-5 h-5 rounded border inline-flex items-center justify-center ${on ? 'bg-[#1F3864] border-[#1F3864] text-white' : 'border-slate-300 bg-white'}`}
                      aria-label={`Select ${a.name}`}
                    >
                      {on && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-800" dir="auto">
                    {clean(a.name)}
                    {a.name !== clean(a.name) && <span className="ml-2 text-[10px] font-bold text-slate-400">(extra spaces)</span>}
                    {similar && <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider">Similar</span>}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-600">{a.lines}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-800">{formatAmount(a.total)}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center gap-1">
                      {similar && (
                        <button onClick={() => selectSimilar(a)} className="px-2.5 h-8 rounded-lg text-xs font-bold text-amber-700 hover:bg-amber-50">
                          Select similar
                        </button>
                      )}
                      <button onClick={() => openMerge([a.name])} title="Rename" className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mergeOpen && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setMergeOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedRows.length > 1 ? 'Merge accounts' : 'Rename account'}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedLines} rows will use the new name.
                </p>
              </div>
              <button onClick={() => setMergeOpen(false)} disabled={saving} className="p-1 text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selectedRows.map((a) => (
                <button
                  key={a.name}
                  onClick={() => setTarget(clean(a.name))}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border ${clean(a.name) === clean(target) ? 'bg-[#1F3864] text-white border-[#1F3864]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                  dir="auto"
                >
                  {clean(a.name)} · {a.lines}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Account name after the merge</label>
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                maxLength={120}
                dir="auto"
                autoFocus
                className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/25"
              />
              <p className="text-[11px] text-slate-400 mt-1">Click one of the names above, or type a new one.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setMergeOpen(false)} disabled={saving} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => void confirmMerge()}
                disabled={saving || !clean(target)}
                className="flex-1 h-11 rounded-xl bg-[#1F3864] hover:bg-[#182E56] text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
