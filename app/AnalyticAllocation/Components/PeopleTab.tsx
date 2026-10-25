'use client';

import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import Modal from './Modal';
import SplitEditor from './SplitEditor';
import ConfirmDialog from './ConfirmDialog';
import { deleteAnalyticPerson, saveAnalyticPerson } from '../Service/AnalyticService';
import { byName, formatPct, isFull, resolvePcts, type AnalyticPerson, type SplitItem } from '../Utils/AnalyticTypes';

interface PeopleTabProps {
  people: AnalyticPerson[];
  accountNames: string[]; // active
  onChange: (next: AnalyticPerson[]) => void;
}

type Draft = { ID?: number; NAME: string; NOTES: string; ACCOUNTS: SplitItem[]; IS_ACTIVE: boolean };
const EMPTY: Draft = { NAME: '', NOTES: '', ACCOUNTS: [], IS_ACTIVE: true };

export default function PeopleTab({ people, accountNames, onChange }: PeopleTabProps) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => !q || p.NAME.toLowerCase().includes(q) || p.NOTES.toLowerCase().includes(q) || p.ACCOUNTS.some((a) => a.ACCOUNT.toLowerCase().includes(q)));
  }, [people, search]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await saveAnalyticPerson(draft);
      onChange([...people.filter((p) => p.ID !== saved.ID), saved].sort((a, b) => byName(a.NAME, b.NAME)));
      toast.success(`${saved.NAME} saved`);
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft?.ID) return;
    setSaving(true);
    try {
      await deleteAnalyticPerson(draft.ID);
      onChange(people.filter((p) => p.ID !== draft.ID));
      toast.success(`${draft.NAME} deleted`);
      setConfirmDelete(false);
      setDraft(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setSaving(false);
    }
  };

  const draftTotal = draft ? resolvePcts(draft.ACCOUNTS).total : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">People</h1>
        <button onClick={() => setDraft({ ...EMPTY })} className="self-start sm:self-auto h-11 px-4 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-1.5 shadow-sm">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, notes or account…" dir="auto" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((p) => {
          // the card shows only the status; the accounts are seen when the person is opened
          const { total } = resolvePcts(p.ACCOUNTS);
          const ok = p.ACCOUNTS.length > 0 && isFull(total);
          return (
            <button
              key={p.ID}
              onClick={() => setDraft({ ID: p.ID, NAME: p.NAME, NOTES: p.NOTES, ACCOUNTS: p.ACCOUNTS, IS_ACTIVE: p.IS_ACTIVE })}
              className={`text-left bg-white rounded-3xl border shadow-sm p-5 hover:shadow-md hover:border-[#C4A052] transition-all ${p.IS_ACTIVE ? 'border-slate-100' : 'border-dashed border-slate-200 opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-black text-[#C4A052] flex items-center justify-center shrink-0">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate" dir="auto">{p.NAME}</p>
                    {p.NOTES && <p className="text-xs font-semibold text-slate-400 truncate" dir="auto">{p.NOTES}</p>}
                  </div>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${!p.ACCOUNTS.length ? 'bg-slate-100 text-slate-500' : ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                  {!p.ACCOUNTS.length ? 'No accounts' : ok ? '100% ✓' : formatPct(total)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      {!rows.length && <NoData title={people.length ? 'NO MATCHING PEOPLE' : 'NO PEOPLE YET'} message={people.length ? undefined : 'Add the first person with the Add button'} />}

      <Modal
        open={!!draft}
        title={draft?.ID ? draft.NAME || 'Person' : 'New Person'}
        subtitle="Default analytic accounts used when this person is chosen in an allocation"
        onClose={() => !saving && setDraft(null)}
        footer={
          draft && (
            <>
              {draft.ID && (
                <button onClick={() => setConfirmDelete(true)} disabled={saving} className="mr-auto h-11 px-4 rounded-xl text-red-600 hover:bg-red-50 text-sm font-bold flex items-center gap-1.5">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
              <button onClick={() => setDraft(null)} disabled={saving} className="h-11 px-5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => void save()}
                disabled={saving || !draft.NAME.trim() || (draft.ACCOUNTS.length > 0 && !isFull(draftTotal))}
                className="h-11 px-6 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-2 disabled:opacity-40"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </>
          )
        }
      >
        {draft && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Name</span>
                <input value={draft.NAME} onChange={(e) => setDraft({ ...draft, NAME: e.target.value })} dir="auto" className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Notes</span>
                <input value={draft.NOTES} onChange={(e) => setDraft({ ...draft, NOTES: e.target.value })} dir="auto" placeholder="Job, vehicle, mobile…" className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Status</span>
                <button type="button" onClick={() => setDraft({ ...draft, IS_ACTIVE: !draft.IS_ACTIVE })} className={`w-full h-11 px-4 rounded-xl text-sm font-bold ${draft.IS_ACTIVE ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {draft.IS_ACTIVE ? 'Active' : 'Inactive'}
                </button>
              </label>
            </div>
            <SplitEditor accounts={accountNames} value={draft.ACCOUNTS} onChange={(ACCOUNTS) => setDraft({ ...draft, ACCOUNTS })} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${draft?.NAME || ''}?`}
        message="Saved allocations keep their copy of this person. This can't be undone."
        busy={saving}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
