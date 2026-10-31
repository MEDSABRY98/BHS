'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import ConfirmDialog from './ConfirmDialog';
import ProjectsPanel from './ProjectsPanel';
import { deleteAnalyticAccount, saveAnalyticAccount } from '../Service/AnalyticService';
import { byName, type AnalyticAccount, type AnalyticPerson, type AnalyticProject } from '../Utils/AnalyticTypes';

interface AccountsTabProps {
  accounts: AnalyticAccount[];
  people: AnalyticPerson[];
  projects: AnalyticProject[];
  onProjectsChange: (next: AnalyticProject[]) => void;
  onChange: (next: AnalyticAccount[]) => void;
  onRenamed: () => void; // people splits changed on the server
}

export default function AccountsTab({ accounts, people, projects, onProjectsChange, onChange, onRenamed }: AccountsTabProps) {
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState<string | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnalyticAccount | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    people.forEach((p) => p.ACCOUNTS.forEach((a) => m.set(a.ACCOUNT, (m.get(a.ACCOUNT) || 0) + 1)));
    return m;
  }, [people]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => !q || a.NAME.toLowerCase().includes(q));
  }, [accounts, search]);

  const put = (a: AnalyticAccount) => onChange([...accounts.filter((x) => x.ID !== a.ID), a].sort((x, y) => byName(x.NAME, y.NAME)));

  const add = async () => {
    if (!newName.trim()) return;
    setBusyId('new');
    try {
      put(await saveAnalyticAccount({ NAME: newName }));
      setNewName('');
      toast.success('Account added');
    } catch (e: any) {
      toast.error(e?.message || 'Could not add the account');
    } finally {
      setBusyId(null);
    }
  };

  const save = async (a: AnalyticAccount, patch: Partial<AnalyticAccount>) => {
    setBusyId(a.ID);
    try {
      const saved = await saveAnalyticAccount({ ID: a.ID, NAME: patch.NAME ?? a.NAME, IS_ACTIVE: patch.IS_ACTIVE ?? a.IS_ACTIVE });
      put(saved);
      if (saved.NAME !== a.NAME) onRenamed();
      setEditId(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.ID);
    try {
      await deleteAnalyticAccount(deleteTarget.ID);
      onChange(accounts.filter((x) => x.ID !== deleteTarget.ID));
      toast.success(`${deleteTarget.NAME} deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Analytic Accounts</h1>
        <span className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
          {accounts.filter((a) => a.IS_ACTIVE).length} active · {accounts.length} total
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        </div>
        <div className="flex gap-2 lg:w-[420px]">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="New account name"
            className="flex-1 h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]"
          />
          <button onClick={() => void add()} disabled={!newName.trim() || busyId === 'new'} className="h-11 px-4 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-1.5 disabled:opacity-40">
            {busyId === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                <th className="py-4 px-3">Analytic Account</th>
                <th className="py-4 px-3">Used By</th>
                <th className="py-4 px-3">Status</th>
                <th className="py-4 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((a) => (
                <tr key={a.ID} className="text-center hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-bold text-slate-800">
                    {editId === a.ID ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void save(a, { NAME: editName });
                            if (e.key === 'Escape') setEditId(null);
                          }}
                          className="h-9 px-3 rounded-lg border border-[#C4A052] text-sm text-center w-64"
                        />
                        <button onClick={() => void save(a, { NAME: editName })} className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 flex items-center justify-center" title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      a.NAME
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-semibold">{usage.get(a.NAME) || 0} people</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => void save(a, { IS_ACTIVE: !a.IS_ACTIVE })}
                      disabled={busyId === a.ID}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${a.IS_ACTIVE ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      title="Click to change"
                    >
                      {a.IS_ACTIVE ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      {busyId === a.ID ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditId(a.ID);
                              setEditName(a.NAME);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100"
                            title="Rename"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(a)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length && <NoData isTable colSpan={4} title={accounts.length ? 'NO MATCHING ACCOUNTS' : 'NO ACCOUNTS YET'} />}
            </tbody>
          </table>
        </div>
      </div>

      <ProjectsPanel projects={projects} people={people} onChange={onProjectsChange} onRenamed={onRenamed} />

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.NAME || ''}?`}
        message="Saved allocations keep their copy of this account. This can't be undone."
        busy={busyId === deleteTarget?.ID}
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
