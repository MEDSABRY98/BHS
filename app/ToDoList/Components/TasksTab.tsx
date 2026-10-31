'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Trash2, UserRound } from 'lucide-react';
import { toast } from '@/app/Components/Notification';
import NoData from '@/app/Components/DataState/NoDataTab';
import TabLoader from '@/app/Components/Loading/TabLoader';
import TabFetchError from '@/app/Components/DataState/TabFetchError';
import { deleteTask, listTasksOfDay, setTaskDone } from '../Service/TodoService';
import { addDays, formatDay, uaeToday, type TodoContext, type TodoTask } from '../Utils/TodoTypes';

const field = 'h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#C4A052]/15 focus:border-[#C4A052]';

export default function TasksTab({ ctx, reloadKey }: { ctx: TodoContext; reloadKey: number }) {
  const { me, permissions } = ctx;
  const admin = permissions.admin;
  const today = uaeToday();
  const [date, setDate] = useState(today);
  const [tasks, setTasks] = useState<TodoTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTasks(await listTasksOfDay(date));
    } catch (e: any) {
      setError(e?.message || 'Could not load the tasks');
    }
  }, [date]);

  useEffect(() => {
    setTasks(null);
    void load();
  }, [load, reloadKey]);

  const done = useMemo(() => (tasks || []).filter((t) => t.IS_DONE).length, [tasks]);

  const toggle = async (t: TodoTask) => {
    setBusyId(t.ID);
    // the check shows at once; it goes back if the server refuses
    setTasks((prev) => (prev || []).map((x) => (x.ID === t.ID ? { ...x, IS_DONE: !t.IS_DONE } : x)));
    try {
      const saved = await setTaskDone(t.ID, !t.IS_DONE);
      setTasks((prev) => (prev || []).map((x) => (x.ID === t.ID ? saved : x)));
    } catch (e: any) {
      setTasks((prev) => (prev || []).map((x) => (x.ID === t.ID ? t : x)));
      toast.error(e?.message || 'Could not save');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (t: TodoTask) => {
    setBusyId(t.ID);
    try {
      await deleteTask(t.ID);
      setTasks((prev) => (prev || []).filter((x) => x.ID !== t.ID));
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  // loading: the loader alone (no title / date bar) in the middle of the tab
  if (error && !tasks) return <TabFetchError message={error} onRetry={() => void load()} className="min-h-[60vh]" />;
  if (!tasks) return <TabLoader className="!min-h-[70vh] flex-1" />;

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-normal text-black tracking-tighter">{date === today ? 'Today' : 'Tasks'}</h1>
          <p className="text-sm font-bold text-slate-400 mt-1">
            {formatDay(date)}
            {tasks && tasks.length > 0 ? ` · ${done} of ${tasks.length} done` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(addDays(date, -1))} className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center" title="Previous day">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={`${field} h-10 px-3`} />
          <button onClick={() => setDate(addDays(date, 1))} className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center" title="Next day">
            <ChevronRight className="w-5 h-5" />
          </button>
          {date !== today && (
            <button onClick={() => setDate(today)} className="h-10 px-4 rounded-xl bg-black text-[#C4A052] text-sm font-bold">
              Today
            </button>
          )}
        </div>
      </div>

      {error && !tasks ? (
        <TabFetchError message={error} onRetry={() => void load()} className="min-h-[30vh]" />
      ) : !tasks ? (
        <TabLoader className="!min-h-[60vh] flex-1" />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <div key={t.ID} className={`bg-white rounded-2xl border shadow-sm px-4 py-3 flex items-center gap-3 transition-colors ${t.IS_DONE ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100'}`}>
              <button
                type="button"
                onClick={() => void toggle(t)}
                disabled={busyId === t.ID}
                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${t.IS_DONE ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300 hover:border-[#C4A052]'}`}
                title={t.IS_DONE ? 'Mark as not done' : 'Mark as done'}
              >
                {t.IS_DONE && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-bold truncate ${t.IS_DONE ? 'text-slate-400 line-through' : 'text-slate-900'}`} dir="auto" title={t.TITLE}>
                  {t.TITLE}
                </p>
                {t.NOTES && (
                  <p className="text-xs font-semibold text-slate-400 truncate" dir="auto">
                    {t.NOTES}
                  </p>
                )}
              </div>
              {admin && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 shrink-0">
                  <UserRound className="w-3 h-3" /> {t.ASSIGNEE_NAME}
                </span>
              )}
              {(admin || t.CREATED_BY === me.ID) && (
                <button onClick={() => void remove(t)} disabled={busyId === t.ID} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 shrink-0" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {!tasks.length && <NoData title="NO TASKS" />}
        </div>
      )}

    </div>
  );
}
