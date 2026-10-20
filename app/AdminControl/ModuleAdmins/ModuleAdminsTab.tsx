'use client';

// Admin Control → Module Admins
// Every module (A-Z) as a card; click a card → popup to pick a user and tick Edit / Delete. A module admin is treated like the
// admin inside that module (everyone's data, all tabs); Edit / Delete decide what he may change.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Pencil, Search, ShieldCheck, Trash2, UserPlus, X } from 'lucide-react';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { toast } from '@/app/Components/Notification';
import { SYSTEMS } from '../AdminControl/AdminControlTab';
import {
  listModuleAdmins,
  removeModuleAdmin,
  saveModuleAdmin,
  type ModuleAdminRow,
  type ModuleAdminUser,
} from '../Code/ModuleAdminsService';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

const keyOf = (r: { moduleId: string; userId: string }) => `${r.moduleId}|${r.userId}`;

export default function ModuleAdminsTab() {
  const [rows, setRows] = useState<ModuleAdminRow[] | null>(null);
  const [users, setUsers] = useState<ModuleAdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await listModuleAdmins();
      setRows(res.rows);
      setUsers(res.users);
    } catch (err: any) {
      setError(err?.message || 'Could not load the module admins');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const modules = useMemo(() => [...SYSTEMS].sort((a, b) => a.label.localeCompare(b.label)), []);
  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        (rows || []).some((r) => r.moduleId === m.id && (userName.get(r.userId) || '').toLowerCase().includes(q)),
    );
  }, [modules, search, rows, userName]);

  const setBusyKey = (key: string, on: boolean) =>
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const save = async (row: ModuleAdminRow, isNew = false) => {
    const key = keyOf(row);
    const before = rows || [];
    setRows(isNew ? [...before, row] : before.map((r) => (keyOf(r) === key ? row : r)));
    setBusyKey(key, true);
    try {
      await saveModuleAdmin(row);
      if (isNew) toast.success(`${userName.get(row.userId) || 'User'} is now admin of ${modules.find((m) => m.id === row.moduleId)?.label}`);
    } catch (err: any) {
      setRows(before);
      toast.error(err?.message || 'Could not save');
    } finally {
      setBusyKey(key, false);
    }
  };

  const remove = async (row: ModuleAdminRow) => {
    const key = keyOf(row);
    const before = rows || [];
    setRows(before.filter((r) => keyOf(r) !== key));
    setBusyKey(key, true);
    try {
      await removeModuleAdmin(row);
    } catch (err: any) {
      setRows(before);
      toast.error(err?.message || 'Could not remove');
    } finally {
      setBusyKey(key, false);
    }
  };

  if (error) return <TabFetchError message={error} onRetry={() => void load()} className="min-h-[calc(100vh-120px)]" />;
  if (!rows) return <TabLoader className="-mt-6 -mb-12 !min-h-screen" />;

  const totalAdmins = new Set(rows.map((r) => r.userId)).size;
  const adminsOf = (moduleId: string) =>
    rows
      .filter((r) => r.moduleId === moduleId)
      .sort((a, b) => (userName.get(a.userId) || '').localeCompare(userName.get(b.userId) || ''));
  const openModule = modules.find((m) => m.id === openId) || null;

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-900/20 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-3xl font-normal text-black tracking-tighter">Module Admins</h1>
              <p className="text-sm font-semibold text-slate-400">
                {totalAdmins} user{totalAdmins === 1 ? '' : 's'} · {rows.length} assignment{rows.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search module or user..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-20 text-center text-sm font-bold text-slate-400">No module matches your search</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((m) => {
            const list = adminsOf(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setOpenId(m.id)}
                className="group text-left bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5 hover:shadow-lg hover:border-violet-200 hover:-translate-y-0.5 transition-all flex flex-col gap-4 min-h-[150px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900 truncate">{m.label}</p>
                    <p className={`text-[11px] font-bold mt-0.5 ${list.length ? 'text-violet-600' : 'text-slate-400'}`}>
                      {list.length ? `${list.length} admin${list.length === 1 ? '' : 's'}` : 'Only you'}
                    </p>
                  </div>
                  <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 group-hover:bg-[#0a0f1d] group-hover:text-violet-200 flex items-center justify-center shrink-0 transition-colors">
                    <UserPlus className="w-4 h-4" />
                  </span>
                </div>
                <div className="mt-auto space-y-1.5">
                  {list.length === 0 ? (
                    <p className="text-xs font-semibold text-slate-300">Click to add an admin</p>
                  ) : (
                    <>
                      {list.slice(0, 3).map((r) => {
                        const name = userName.get(r.userId) || r.userId;
                        return (
                          <div key={keyOf(r)} className="flex items-center gap-2 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                              {initials(name)}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-700" dir="auto">
                              {name}
                            </span>
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center ${r.canEdit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`} title={r.canEdit ? 'Can edit' : 'Cannot edit'}>
                              <Pencil className="w-3 h-3" />
                            </span>
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center ${r.canDelete ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-300'}`} title={r.canDelete ? 'Can delete' : 'Cannot delete'}>
                              <Trash2 className="w-3 h-3" />
                            </span>
                          </div>
                        );
                      })}
                      {list.length > 3 && <p className="text-[11px] font-bold text-slate-400 pl-8">+{list.length - 3} more</p>}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}


      {openModule && (
        <ModuleModal
          label={openModule.label}
          list={adminsOf(openModule.id)}
          users={users}
          userName={userName}
          busy={busy}
          onClose={() => setOpenId(null)}
          onAdd={(userId, canEdit, canDelete) => void save({ moduleId: openModule.id, userId, canEdit, canDelete }, true)}
          onChange={(row) => void save(row)}
          onRemove={(row) => void remove(row)}
        />
      )}
    </div>
  );
}

/* ───────────────────────── module popup ───────────────────────── */

function Toggle({ on, tone, disabled, onClick }: { on: boolean; tone: 'edit' | 'delete'; disabled?: boolean; onClick: () => void }) {
  const Icon = tone === 'edit' ? Pencil : Trash2;
  const word = tone === 'edit' ? 'edit' : 'delete';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={on ? `Can ${word} - click to remove` : `Cannot ${word} - click to allow`}
      aria-pressed={on}
      className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors disabled:opacity-50 shrink-0 ${
        on
          ? tone === 'edit'
            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
            : 'bg-red-50 text-red-500 border-red-200'
          : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500'
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

function ModuleModal({
  label,
  list,
  users,
  userName,
  busy,
  onClose,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string;
  list: ModuleAdminRow[];
  users: ModuleAdminUser[];
  userName: Map<string, string>;
  busy: Set<string>;
  onClose: () => void;
  onAdd: (userId: string, canEdit: boolean, canDelete: boolean) => void;
  onChange: (row: ModuleAdminRow) => void;
  onRemove: (row: ModuleAdminRow) => void;
}) {
  const [pick, setPick] = useState<ModuleAdminUser | null>(null);
  const taken = new Set(list.map((r) => r.userId));
  const available = users.filter((u) => !u.isAdmin && !taken.has(u.id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const add = () => {
    if (!pick) return;
    onAdd(pick.id, true, false);
    setPick(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200/50 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-black text-slate-900 truncate">{label}</p>
              <p className="text-[11px] font-bold text-slate-400">{list.length ? `${list.length} admin${list.length === 1 ? '' : 's'}` : 'Only you'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3 bg-slate-50/60 border-b border-slate-100">
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Add admin</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <UserPicker users={available} value={pick} onPick={setPick} />
            </div>
            <button
              type="button"
              disabled={!pick}
              onClick={add}
              title="Add admin"
              className="w-11 h-11 rounded-xl bg-[#0a0f1d] text-violet-200 flex items-center justify-center shrink-0 disabled:opacity-40 hover:shadow-lg transition-all"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-2">
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm font-bold text-slate-300">No admins for this module yet</p>
          ) : (
            list.map((r) => {
              const name = userName.get(r.userId) || r.userId;
              const isBusy = busy.has(keyOf(r));
              return (
                <div key={keyOf(r)} className="flex items-center gap-2 p-2.5 rounded-2xl border border-slate-200 bg-white">
                  <span className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                    {initials(name)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800" dir="auto" title={name}>
                    {name}
                  </span>
                  <Toggle on={r.canEdit} tone="edit" disabled={isBusy} onClick={() => onChange({ ...r, canEdit: !r.canEdit })} />
                  <Toggle on={r.canDelete} tone="delete" disabled={isBusy} onClick={() => onChange({ ...r, canDelete: !r.canDelete })} />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onRemove(r)}
                    className="w-9 h-9 rounded-xl text-slate-300 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center disabled:opacity-50"
                    title="Remove admin"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── user dropdown ───────────────────────── */

function UserPicker({ users, value, onPick }: { users: ModuleAdminUser[]; value: ModuleAdminUser | null; onPick: (u: ModuleAdminUser | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
  }, [users, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full h-11 px-3 rounded-xl border bg-white flex items-center gap-2.5 text-left transition-all ${
          open ? 'border-violet-400 ring-4 ring-violet-400/15' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {value ? (
          <>
            <span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
              {initials(value.name)}
            </span>
            <span className="flex-1 min-w-0 truncate text-sm font-bold text-slate-800" dir="auto">
              {value.name}
            </span>
          </>
        ) : (
          <span className="flex-1 text-sm font-semibold text-slate-400">Select a user...</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-2 z-50 bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25)] overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false))}
                placeholder="Search user..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-100 text-sm font-semibold outline-none focus:border-violet-300"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1.5">
            {filtered.map((u) => {
              const sel = value?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onPick(u);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-left transition-colors ${
                    sel ? 'bg-violet-50 text-slate-900 font-bold' : 'text-slate-700 font-semibold hover:bg-violet-50'
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                    {initials(u.name)}
                  </span>
                  <span className="flex-1 min-w-0 truncate" dir="auto">
                    {u.name}
                  </span>
                  {sel && <Check className="w-4 h-4 text-violet-600" />}
                </button>
              );
            })}
            {filtered.length === 0 && <p className="px-3 py-5 text-center text-xs font-bold text-slate-400">No user to add</p>}
          </div>
        </div>
      )}
    </div>
  );
}
