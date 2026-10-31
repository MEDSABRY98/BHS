'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import ConfirmDialog from './ConfirmDialog';
import { deleteAnalyticProject, saveAnalyticProject } from '../Service/AnalyticService';
import { byName, type AnalyticPerson, type AnalyticProject } from '../Utils/AnalyticTypes';

interface ProjectsPanelProps {
  projects: AnalyticProject[];
  people: AnalyticPerson[];
  onChange: (next: AnalyticProject[]) => void;
  onRenamed: () => void; // people splits changed on the server
}

/** The projects list (Accounts tab). A project is picked next to an account in a person's split or in an allocation. */
export default function ProjectsPanel({ projects, people, onChange, onRenamed }: ProjectsPanelProps) {
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [busyId, setBusyId] = useState<string | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnalyticProject | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    people.forEach((p) => new Set(p.ACCOUNTS.map((a) => a.PROJECT).filter(Boolean) as string[]).forEach((n) => m.set(n, (m.get(n) || 0) + 1)));
    return m;
  }, [people]);

  const put = (p: AnalyticProject) => onChange([...projects.filter((x) => x.ID !== p.ID), p].sort((a, b) => byName(a.NAME, b.NAME)));

  const add = async () => {
    if (!newName.trim()) return;
    setBusyId('new');
    try {
      put(await saveAnalyticProject({ NAME: newName }));
      setNewName('');
      toast.success('Project added');
    } catch (e: any) {
      toast.error(e?.message || 'Could not add the project');
    } finally {
      setBusyId(null);
    }
  };

  const save = async (p: AnalyticProject, patch: Partial<AnalyticProject>) => {
    setBusyId(p.ID);
    try {
      const saved = await saveAnalyticProject({ ID: p.ID, NAME: patch.NAME ?? p.NAME, IS_ACTIVE: patch.IS_ACTIVE ?? p.IS_ACTIVE });
      put(saved);
      if (saved.NAME !== p.NAME) onRenamed();
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
      await deleteAnalyticProject(deleteTarget.ID);
      onChange(projects.filter((x) => x.ID !== deleteTarget.ID));
      toast.success(`${deleteTarget.NAME} deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-normal text-black tracking-tighter">Projects</h2>
        <div className="flex gap-2 sm:w-[420px]">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
            placeholder="New project name"
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
                <th className="py-4 px-3">Project</th>
                <th className="py-4 px-3">Used By</th>
                <th className="py-4 px-3">Status</th>
                <th className="py-4 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projects.map((p) => (
                <tr key={p.ID} className="text-center hover:bg-slate-50/70">
                  <td className="py-3 px-3 font-bold text-slate-800">
                    {editId === p.ID ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void save(p, { NAME: editName });
                            if (e.key === 'Escape') setEditId(null);
                          }}
                          className="h-9 px-3 rounded-lg border border-[#C4A052] text-sm text-center w-64"
                        />
                        <button onClick={() => void save(p, { NAME: editName })} className="w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 flex items-center justify-center" title="Save">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditId(null)} className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 flex items-center justify-center" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      p.NAME
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-semibold">{usage.get(p.NAME) || 0} people</td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => void save(p, { IS_ACTIVE: !p.IS_ACTIVE })}
                      disabled={busyId === p.ID}
                      className={`px-3 py-1 rounded-full text-xs font-bold ${p.IS_ACTIVE ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      title="Click to change"
                    >
                      {p.IS_ACTIVE ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center justify-center gap-1">
                      {busyId === p.ID ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditId(p.ID);
                              setEditName(p.NAME);
                            }}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100"
                            title="Rename"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!projects.length && <NoData isTable colSpan={4} title="NO PROJECTS YET" />}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete ${deleteTarget?.NAME || ''}?`}
        message="Saved allocations keep their copy of this project. This can't be undone."
        busy={busyId === deleteTarget?.ID}
        onConfirm={() => void remove()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
