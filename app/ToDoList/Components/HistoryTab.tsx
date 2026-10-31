'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, X, XCircle } from 'lucide-react';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { listTaskHistory } from '../Service/TodoService';
import { formatDateTime, formatDay, type TodoContext, type TodoTask } from '../Utils/TodoTypes';

type StatusFilter = 'all' | 'done' | 'missed';

export default function HistoryTab({ ctx, reloadKey }: { ctx: TodoContext; reloadKey: number }) {
  const admin = ctx.permissions.admin;
  const [rows, setRows] = useState<TodoTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [user, setUser] = useState('');

  const load = async () => {
    setError(null);
    try {
      setRows(await listTaskHistory());
    } catch (e: any) {
      setError(e?.message || 'Could not load the history');
    }
  };

  useEffect(() => {
    setRows(null);
    void load();
  }, [reloadKey]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows || []).filter((t) => {
      if (from && t.TASK_DATE < from) return false;
      if (to && t.TASK_DATE > to) return false;
      if (status === 'done' && !t.IS_DONE) return false;
      if (status === 'missed' && t.IS_DONE) return false;
      if (user && t.ASSIGNEE_ID !== user) return false;
      return !q || t.TITLE.toLowerCase().includes(q) || t.NOTES.toLowerCase().includes(q) || t.ASSIGNEE_NAME.toLowerCase().includes(q);
    });
  }, [rows, search, from, to, status, user]);

  const filtered = !!(search || from || to || status !== 'all' || user);

  if (error && !rows) return <TabFetchError message={error} onRetry={() => void load()} className="min-h-[60vh]" />;
  if (!rows) return <TabLoader className="!min-h-[70vh] flex-1" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">History</h1>
        <span className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white border border-slate-100 shadow-sm text-sm font-bold text-slate-700">
          {shown.filter((t) => t.IS_DONE).length} done · {shown.filter((t) => !t.IS_DONE).length} missed
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search task, notes or person…" dir="auto" className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]" />
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="From date" />
          <span className="text-slate-300">—</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm" title="To date" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold bg-white">
          <option value="all">All</option>
          <option value="done">Done</option>
          <option value="missed">Missed</option>
        </select>
        {admin && ctx.users.length > 1 && (
          <select value={user} onChange={(e) => setUser(e.target.value)} className="h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold bg-white">
            <option value="">Everyone</option>
            {ctx.users.map((u) => (
              <option key={u.ID} value={u.ID}>
                {u.NAME}
              </option>
            ))}
          </select>
        )}
        {filtered && (
          <button
            onClick={() => {
              setSearch('');
              setFrom('');
              setTo('');
              setStatus('all');
              setUser('');
            }}
            className="h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 flex items-center gap-1.5"
          >
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black text-[11px] font-black uppercase tracking-[0.15em] text-white text-center border-b-2 border-[#C4A052]">
                <th className="py-4 px-3">Date</th>
                <th className="py-4 px-3 text-left">Task</th>
                {admin && <th className="py-4 px-3">For</th>}
                <th className="py-4 px-3">Status</th>
                <th className="py-4 px-3">Done At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {shown.map((t) => (
                <tr key={t.ID} className="text-center hover:bg-slate-50/70">
                  <td className="py-3 px-3 text-slate-500 font-semibold whitespace-nowrap">{formatDay(t.TASK_DATE)}</td>
                  <td className="py-3 px-3 text-left">
                    <p className="font-bold text-slate-800" dir="auto">{t.TITLE}</p>
                    {t.NOTES && <p className="text-xs font-semibold text-slate-400" dir="auto">{t.NOTES}</p>}
                  </td>
                  {admin && <td className="py-3 px-3 font-semibold text-slate-600">{t.ASSIGNEE_NAME}</td>}
                  <td className="py-3 px-3">
                    {t.IS_DONE ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Done
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold">
                        <XCircle className="w-3.5 h-3.5" /> Missed
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-500 font-semibold whitespace-nowrap">
                    {t.IS_DONE ? formatDateTime(t.DONE_AT) : '-'}
                    {t.IS_DONE && admin && t.DONE_BY_NAME && t.DONE_BY_NAME !== t.ASSIGNEE_NAME ? ` · ${t.DONE_BY_NAME}` : ''}
                  </td>
                </tr>
              ))}
              {!shown.length && <NoData isTable colSpan={admin ? 5 : 4} title={rows.length ? 'NO MATCHING TASKS' : 'NO HISTORY YET'} />}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
