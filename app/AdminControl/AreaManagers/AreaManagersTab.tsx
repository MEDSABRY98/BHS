'use client';

// Admin Control → Area Managers
// An area manager supervises some salespersons: he sees their data in Sales, Customers Analysis,
// Salesperson Analysis and Payment Analysis. One card per area manager; Edit picks his salespersons.
// A salesperson has ONE area manager (picking him for another manager moves him).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, MapPinned, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { listAreaManagers, saveAreaManager, type AreaLink, type AreaUser } from '../Code/AreaManagersService';

const byName = (a: AreaUser, b: AreaUser) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export default function AreaManagersTab() {
  const [links, setLinks] = useState<AreaLink[] | null>(null);
  const [users, setUsers] = useState<AreaUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ managerId: string; isNew: boolean } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [manager, setManager] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listAreaManagers();
      setLinks(res.links);
      setUsers(res.users);
    } catch (e: any) {
      setError(e?.message || 'Could not load the area managers');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const nameOf = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);
  const managerOf = useMemo(() => new Map((links || []).map((l) => [l.salespersonId, l.managerId])), [links]);
  const managers = useMemo(() => {
    const map = new Map<string, string[]>();
    (links || []).forEach((l) => map.set(l.managerId, [...(map.get(l.managerId) || []), l.salespersonId]));
    return Array.from(map.entries())
      .map(([id, reps]) => ({ id, name: nameOf.get(id) || id, reps: reps.sort((a, b) => (nameOf.get(a) || a).localeCompare(nameOf.get(b) || b)) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [links, nameOf]);

  const openEditor = (managerId: string, isNew: boolean) => {
    setEditing({ managerId, isNew });
    setManager(managerId);
    setPicked(new Set((links || []).filter((l) => l.managerId === managerId).map((l) => l.salespersonId)));
    setSearch('');
  };

  const persist = async (managerId: string, reps: string[]) => {
    setSaving(true);
    try {
      await saveAreaManager({ managerId, salespersonIds: reps });
      await load();
      toast.success(reps.length ? 'Saved' : 'Area manager removed');
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <TabFetchError message={error} onRetry={() => void load()} className="min-h-[calc(100vh-120px)]" />;
  if (!links) return <TabLoader className="-mt-6 -mb-12 !min-h-screen" />;

  const q = search.trim().toLowerCase();
  const candidates = users.filter((u) => u.id !== manager && (!q || u.name.toLowerCase().includes(q))).sort(byName);
  const freeManagers = users.filter((u) => !managers.some((m) => m.id === u.id)).sort(byName);

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-900/20 shrink-0">
            <MapPinned className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-3xl font-normal text-black tracking-tighter">Area Managers</h1>
            <p className="text-sm font-semibold text-slate-400">
              {managers.length} area manager{managers.length === 1 ? '' : 's'} · {links.length} salesperson{links.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <button
          onClick={() => openEditor('', true)}
          className="h-11 px-5 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add Area Manager
        </button>
      </div>

      {managers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-12 text-center text-slate-400 font-bold tracking-wide">NO AREA MANAGERS YET</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {managers.map((m) => (
            <div key={m.id} className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-black text-slate-900 truncate">{m.name}</p>
                  <p className="text-xs font-semibold text-slate-400">
                    {m.reps.length} salesperson{m.reps.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEditor(m.id, false)} className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void persist(m.id, [])}
                    disabled={saving}
                    className="w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center disabled:opacity-40"
                    title="Remove this area manager"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {m.reps.map((r) => (
                  <span key={r} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                    {nameOf.get(r) || r}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">{editing.isNew ? 'Add Area Manager' : 'Edit Area Manager'}</h2>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">Area Manager</span>
                {editing.isNew ? (
                  <select
                    value={manager}
                    onChange={(e) => {
                      setManager(e.target.value);
                      setPicked((p) => {
                        const next = new Set(p);
                        next.delete(e.target.value);
                        return next;
                      });
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-violet-400"
                  >
                    <option value="">Pick a user…</option>
                    {freeManagers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="h-11 px-3 rounded-xl bg-slate-50 flex items-center text-sm font-bold text-slate-800">{nameOf.get(manager) || manager}</p>
                )}
              </div>
              <div>
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                  Salespersons ({picked.size} picked)
                </span>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-semibold outline-none focus:border-violet-400"
                  />
                </div>
                <ul className="rounded-xl border border-slate-100 divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {candidates.map((u) => {
                    const other = managerOf.get(u.id);
                    const otherName = other && other !== manager ? nameOf.get(other) || other : '';
                    return (
                      <li key={u.id}>
                        <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={picked.has(u.id)}
                            onChange={() =>
                              setPicked((p) => {
                                const next = new Set(p);
                                if (next.has(u.id)) next.delete(u.id);
                                else next.add(u.id);
                                return next;
                              })
                            }
                            className="w-4 h-4 accent-black"
                          />
                          <span className="flex-1 text-sm font-semibold text-slate-800">{u.name}</span>
                          {otherName && <span className="text-[11px] font-semibold text-amber-600">now under {otherName}</span>}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 grid grid-cols-2 gap-3">
              <button onClick={() => setEditing(null)} disabled={saving} className="h-11 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => (manager ? void persist(manager, Array.from(picked)) : toast.error('Pick the area manager'))}
                disabled={saving}
                className="h-11 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
