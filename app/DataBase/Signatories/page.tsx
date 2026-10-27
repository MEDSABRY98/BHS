'use client';

// Signatories DB: the people who may sign the PDFs (position + name).
// When a PDF is exported you choose from this list who signs and in which order.

import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import NoData from '@/app/Components/DataState/NoDataTab';
import { canEditSignatories, deleteSignatory, listSignatories, reorderSignatories, saveSignatory } from '@/app/Components/Signatures/SignatureService';
import type { Signatory } from '@/app/Components/Signatures/SignatureTypes';

type Draft = { ID?: string; TITLE: string; NAME: string; IS_ACTIVE: boolean };
const field = 'w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]';

export default function SignatoriesPage() {
  const [rows, setRows] = useState<Signatory[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Signatory | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [list, edit] = await Promise.all([listSignatories(), canEditSignatories()]);
      setRows(list);
      setCanEdit(edit);
    } catch (e: any) {
      setError(e?.message || 'Could not load the signatories');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const saved = await saveSignatory(draft);
      setRows((prev) => (draft.ID ? (prev || []).map((r) => (r.ID === saved.ID ? saved : r)) : [...(prev || []), saved]));
      toast.success(`${saved.TITLE} saved`);
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteSignatory(deleting.ID);
      setRows((prev) => (prev || []).filter((r) => r.ID !== deleting.ID));
      toast.success(`${deleting.TITLE} deleted`);
      setDeleting(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setBusy(false);
    }
  };

  const move = async (i: number, d: -1 | 1) => {
    if (!rows) return;
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    try {
      await reorderSignatories(next.map((r) => r.ID));
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the order');
      void load();
    }
  };

  if (error && !rows) return <TabFetchError message={error} onRetry={() => void load()} />;
  if (!rows) return <TabLoader />;

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => !q || r.TITLE.toLowerCase().includes(q) || r.NAME.toLowerCase().includes(q));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-normal text-black tracking-tighter flex items-center gap-3">
          Signatories DB <span className="text-lg font-black text-gray-600 bg-gray-100 px-4 py-1.5 rounded-full border border-gray-200">{rows.length}</span>
        </h1>
        {canEdit && (
          <button onClick={() => setDraft({ TITLE: '', NAME: '', IS_ACTIVE: true })} className="ml-auto h-11 px-4 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" /> Add
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search position or name…" dir="auto" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                <th className="py-4 px-3 w-12">#</th>
                <th className="py-4 px-3">Position</th>
                <th className="py-4 px-3">Name</th>
                <th className="py-4 px-3">Status</th>
                {canEdit && <th className="py-4 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {shown.map((r) => {
                const i = rows.indexOf(r);
                return (
                  <tr key={r.ID} className={`text-center ${r.IS_ACTIVE ? '' : 'opacity-50'}`}>
                    <td className="py-3 px-3 text-xs font-bold text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="py-3 px-3 font-black text-slate-900" dir="auto">{r.TITLE}</td>
                    <td className="py-3 px-3 text-slate-600" dir="auto">{r.NAME || '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${r.IS_ACTIVE ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.IS_ACTIVE ? 'Active' : 'Inactive'}</span>
                    </td>
                    {canEdit && (
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => void move(i, -1)} disabled={!!q || i === 0} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 disabled:opacity-30" title="Up">
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button onClick={() => void move(i, 1)} disabled={!!q || i === rows.length - 1} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 disabled:opacity-30" title="Down">
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDraft({ ID: r.ID, TITLE: r.TITLE, NAME: r.NAME, IS_ACTIVE: r.IS_ACTIVE })} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleting(r)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {!shown.length && <NoData isTable colSpan={canEdit ? 5 : 4} title={rows.length ? 'NO MATCHING SIGNATORIES' : 'NO SIGNATORIES YET'} message={rows.length ? undefined : 'Add the people who sign the PDFs'} />}
            </tbody>
          </table>
        </div>
      </div>

      {draft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !busy && setDraft(null)}>
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">{draft.ID ? 'Edit Signatory' : 'New Signatory'}</h3>
              <button onClick={() => setDraft(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <label className="block space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Position *</span>
                <input value={draft.TITLE} onChange={(e) => setDraft({ ...draft, TITLE: e.target.value })} dir="auto" placeholder="e.g. Accounts Department / CEO" className={field} />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Name</span>
                <input value={draft.NAME} onChange={(e) => setDraft({ ...draft, NAME: e.target.value })} dir="auto" placeholder="Optional — empty leaves a blank to write" className={field} />
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={draft.IS_ACTIVE} onChange={(e) => setDraft({ ...draft, IS_ACTIVE: e.target.checked })} className="w-4 h-4 accent-black" /> Active (shown in the list)
              </label>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setDraft(null)} disabled={busy} className="h-11 w-28 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => void save()} disabled={busy || !draft.TITLE.trim()} className="h-11 w-28 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !busy && setDeleting(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-slate-900">Delete {deleting.TITLE}?</h3>
            <p className="text-sm text-slate-500">PDFs already made are not changed. To keep him for later, make him inactive instead.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleting(null)} disabled={busy} className="h-11 w-28 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => void remove()} disabled={busy} className="h-11 w-28 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
