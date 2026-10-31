'use client';

// Add Tasks: the form. Choose the date, then one line per task (person + task); Add saves all the lines.

import { useRef, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import PersonSelect from './PersonSelect';
import { createTasks } from '../Service/TodoService';
import { formatDay, uaeToday, type TodoContext } from '../Utils/TodoTypes';

const field = 'h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]';

type EntryRow = { key: number; person: string; title: string };

export default function AddTab({ ctx }: { ctx: TodoContext }) {
  const { me, users, permissions } = ctx;
  const admin = permissions.admin;
  const today = uaeToday();
  const [date, setDate] = useState(today);
  const nextKey = useRef(1);
  const [entries, setEntries] = useState<EntryRow[]>([{ key: 0, person: me.ID, title: '' }]);
  const [adding, setAdding] = useState(false);

  const setEntry = (key: number, patch: Partial<EntryRow>) => setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  /** a new line under the given one, for the same person */
  const addLine = (afterKey?: number) => {
    const key = nextKey.current++;
    setEntries((prev) => {
      const at = afterKey === undefined ? prev.length - 1 : prev.findIndex((e) => e.key === afterKey);
      const person = prev[at]?.person || me.ID;
      const next = [...prev];
      next.splice(at + 1, 0, { key, person, title: '' });
      return next;
    });
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-entry="${key}"]`)?.focus(), 30);
  };
  const removeLine = (key: number) => setEntries((prev) => (prev.length > 1 ? prev.filter((e) => e.key !== key) : prev.map((e) => ({ ...e, title: '' }))));

  const filled = entries.filter((e) => e.title.trim());

  const add = async () => {
    if (!filled.length) return;
    setAdding(true);
    try {
      const results = await Promise.allSettled(filled.map((e) => createTasks({ TITLE: e.title, TASK_DATE: date, ASSIGNEE_IDS: [admin ? e.person : me.ID] })));
      const failed: EntryRow[] = [];
      let created = 0;
      results.forEach((r, i) => (r.status === 'fulfilled' ? (created += r.value.length) : failed.push(filled[i])));
      // what was added is cleared; a line that failed stays
      setEntries(failed.length ? failed : [{ key: nextKey.current++, person: entries[entries.length - 1]?.person || me.ID, title: '' }]);
      if (created) toast.success(`${created === 1 ? 'Task' : `${created} tasks`} added for ${formatDay(date)}`);
      if (failed.length) {
        const first = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
        toast.error(first?.reason?.message || `${failed.length} could not be added`);
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">Add Tasks</h1>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-1">Date</span>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${field} w-[170px]`} />
        <span className="text-sm font-bold text-slate-400 ml-1">{formatDay(date)}</span>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2">
        {entries.map((e) => (
          <div key={e.key} className="flex items-center gap-2">
            {admin && users.length > 1 && (
              <PersonSelect users={users} value={e.person} meId={me.ID} onChange={(id) => setEntry(e.key, { person: id })} className="w-[180px] sm:w-[240px] shrink-0" />
            )}
            <input
              data-entry={e.key}
              value={e.title}
              onChange={(ev) => setEntry(e.key, { title: ev.target.value })}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' && e.title.trim()) {
                  if (ev.ctrlKey || ev.metaKey) void add();
                  else addLine(e.key);
                }
              }}
              placeholder="Task…"
              dir="auto"
              className={`${field} flex-1 min-w-0`}
            />
            {entries.length > 1 && (
              <button type="button" onClick={() => removeLine(e.key)} className="w-9 h-11 shrink-0 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center" title="Remove the line">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => addLine()} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-black">
            <Plus className="w-3.5 h-3.5" /> Add a line
          </button>
          <button onClick={() => void add()} disabled={!filled.length || adding} className="h-10 px-5 rounded-xl bg-black text-[#C4A052] text-sm font-bold flex items-center gap-1.5 disabled:opacity-40">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Add{filled.length > 1 ? ` (${filled.length})` : ''}
          </button>
        </div>
      </div>

    </div>
  );
}
