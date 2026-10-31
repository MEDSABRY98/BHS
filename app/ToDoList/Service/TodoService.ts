'use server';

// To Do List
// Table (RLS on, no public access — only reachable through these actions):
//   web_TODO_TASKS   one row per task per user (a task given to 3 users = 3 rows, each one checked on its own)
// Users are kept by ID only (ASSIGNEE_ID, CREATED_BY, DONE_BY = bhs_USERS.ID); the names are read from bhs_USERS when listing.
// A user sees and checks his own tasks. The admin sees every user's tasks, gives tasks to other users and deletes any task.

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, isAdminUser, UnauthorizedError, type SessionUserRecord } from '@/lib/session';
import { TODO_SYSTEM_ID, byTitle, uaeToday, type TodoContext, type TodoPermissions, type TodoTabId, type TodoTask, type TodoUser } from '../Utils/TodoTypes';

const TASKS = 'web_TODO_TASKS';
const COLUMNS = 'ID, TITLE, NOTES, TASK_DATE, ASSIGNEE_ID, CREATED_BY, IS_DONE, DONE_AT, DONE_BY';
const ALL_TABS: TodoTabId[] = ['add', 'tasks', 'history'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function permissionsOf(user: SessionUserRecord): TodoPermissions {
  if (isAdminUser(user, TODO_SYSTEM_ID)) return { tabs: [...ALL_TABS], admin: true };
  const raw = String(user.role || '').trim();
  if (!raw) return { tabs: [...ALL_TABS], admin: false };
  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return { tabs: [...ALL_TABS], admin: false };
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(TODO_SYSTEM_ID)) return { tabs: [], admin: false };
  const list = perms[TODO_SYSTEM_ID];
  return { tabs: Array.isArray(list) ? ALL_TABS.filter((t) => list.includes(t)) : [...ALL_TABS], admin: false };
}

async function requireTab(tab: TodoTabId) {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  const perms = permissionsOf(user);
  if (!perms.tabs.includes(tab)) throw new UnauthorizedError("You don't have permission for this action.");
  return { user, perms, me: { ID: String(user.id), NAME: String(user.name || '') } as TodoUser };
}

/** user ID → name (read from bhs_USERS, so a renamed user shows his new name everywhere) */
async function userNames(ids: string[], known: TodoUser[] = []): Promise<Map<string, string>> {
  const map = new Map<string, string>(known.map((u) => [u.ID, u.NAME]));
  const missing = Array.from(new Set(ids.filter((id) => id && !map.has(id))));
  if (missing.length) {
    const { data } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME').in('ID', missing);
    (data || []).forEach((u: any) => map.set(String(u.ID), String(u.NAME || '')));
  }
  return map;
}

const toTask = (r: any, names: Map<string, string>): TodoTask => ({
  ID: String(r.ID),
  TITLE: String(r.TITLE || ''),
  NOTES: String(r.NOTES || ''),
  TASK_DATE: String(r.TASK_DATE || '').slice(0, 10),
  ASSIGNEE_ID: String(r.ASSIGNEE_ID),
  ASSIGNEE_NAME: names.get(String(r.ASSIGNEE_ID)) || '',
  CREATED_BY: String(r.CREATED_BY),
  CREATED_BY_NAME: names.get(String(r.CREATED_BY)) || '',
  IS_DONE: r.IS_DONE === true,
  DONE_AT: r.DONE_AT || null,
  DONE_BY_NAME: r.DONE_BY ? names.get(String(r.DONE_BY)) || '' : null,
});

async function toTasks(rows: any[], known: TodoUser[] = []): Promise<TodoTask[]> {
  const names = await userNames(rows.flatMap((r) => [String(r.ASSIGNEE_ID), String(r.CREATED_BY), r.DONE_BY ? String(r.DONE_BY) : '']), known);
  return rows.map((r) => toTask(r, names));
}

const tableError = (error: any) =>
  error?.code === '42P01' || /relation .* does not exist|Could not find the table/i.test(String(error?.message || ''))
    ? new Error('The tasks table is not created yet (web_TODO_TASKS). Run the SQL for it first.')
    : new Error(error?.message || 'Database error'); // a wrong column etc. shows the real message

/** permissions + who I am + who can get a task */
export async function getTodoContext(): Promise<TodoContext> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError('Your session has expired. Please log in again.');
  const permissions = permissionsOf(user);
  const me: TodoUser = { ID: String(user.id), NAME: String(user.name || '') };
  let users: TodoUser[] = [me];
  if (permissions.admin) {
    const { data, error } = await getSupabaseAdmin().from('bhs_USERS').select('ID, NAME');
    if (error) throw new Error(error.message);
    users = (data || [])
      .map((u: any) => ({ ID: String(u.ID), NAME: String(u.NAME || '').trim() }))
      .filter((u) => u.NAME)
      .sort((a, b) => a.NAME.localeCompare(b.NAME, undefined, { sensitivity: 'base' }));
    if (!users.some((u) => u.ID === me.ID)) users.unshift(me);
  }
  return { permissions, me, users };
}

/** the tasks of one day, alphabetical (the admin gets every user's tasks, the others only their own) */
export async function listTasksOfDay(date: string): Promise<TodoTask[]> {
  const { perms, me } = await requireTab('tasks');
  if (!DATE_RE.test(String(date))) throw new Error('Invalid date');
  let q = getSupabaseAdmin().from(TASKS).select(COLUMNS).eq('TASK_DATE', date);
  if (!perms.admin) q = q.eq('ASSIGNEE_ID', me.ID);
  const { data, error } = await q;
  if (error) throw tableError(error);
  return (await toTasks(data || [], [me])).sort(byTitle);
}

export async function createTasks(input: { TITLE: string; NOTES?: string; TASK_DATE: string; ASSIGNEE_IDS?: string[] }): Promise<TodoTask[]> {
  const { perms, me } = await requireTab('add');
  const TITLE = String(input?.TITLE ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!TITLE) throw new Error('Write the task first');
  const TASK_DATE = String(input?.TASK_DATE || '');
  if (!DATE_RE.test(TASK_DATE)) throw new Error('Choose the date');
  const NOTES = String(input?.NOTES || '').trim().slice(0, 1000);

  const db = getSupabaseAdmin();
  // only the admin gives tasks to other users
  const wanted = perms.admin && input?.ASSIGNEE_IDS?.length ? Array.from(new Set(input.ASSIGNEE_IDS.map(String))) : [me.ID];
  const { users } = await getTodoContext();
  const picked = wanted.map((id) => users.find((u) => u.ID === id)).filter(Boolean) as TodoUser[];
  if (!picked.length) throw new Error('Choose who the task is for');

  const rows = picked.map((u) => ({
    TITLE,
    NOTES,
    TASK_DATE,
    ASSIGNEE_ID: u.ID,
    CREATED_BY: me.ID,
  }));
  const { data, error } = await db.from(TASKS).insert(rows).select(COLUMNS);
  if (error) throw tableError(error);
  return toTasks(data || [], [...users, me]);
}

export async function setTaskDone(id: string, done: boolean): Promise<TodoTask> {
  const { perms, me } = await requireTab('tasks');
  const db = getSupabaseAdmin();
  const { data: row, error: getErr } = await db.from(TASKS).select('ASSIGNEE_ID').eq('ID', id).single();
  if (getErr) throw tableError(getErr);
  if (!perms.admin && String(row.ASSIGNEE_ID) !== me.ID) throw new UnauthorizedError('This task is not yours.');
  const { data, error } = await db
    .from(TASKS)
    .update(done ? { IS_DONE: true, DONE_AT: new Date().toISOString(), DONE_BY: me.ID } : { IS_DONE: false, DONE_AT: null, DONE_BY: null })
    .eq('ID', id)
    .select(COLUMNS)
    .single();
  if (error) throw tableError(error);
  return (await toTasks([data], [me]))[0];
}

export async function deleteTask(id: string): Promise<{ success: true }> {
  const { perms, me } = await requireTab('tasks');
  const db = getSupabaseAdmin();
  const { data: row, error: getErr } = await db.from(TASKS).select('CREATED_BY').eq('ID', id).single();
  if (getErr) throw tableError(getErr);
  if (!perms.admin && String(row.CREATED_BY) !== me.ID) throw new UnauthorizedError('Only the one who wrote the task (or the admin) can delete it.');
  const { error } = await db.from(TASKS).delete().eq('ID', id);
  if (error) throw tableError(error);
  return { success: true };
}

/** History: every finished task and every task of a day that has passed (newest first, the last 2000) */
export async function listTaskHistory(): Promise<TodoTask[]> {
  const { perms, me } = await requireTab('history');
  let q = getSupabaseAdmin().from(TASKS).select(COLUMNS).or(`TASK_DATE.lt.${uaeToday()},IS_DONE.eq.true`);
  if (!perms.admin) q = q.eq('ASSIGNEE_ID', me.ID);
  const { data, error } = await q.order('TASK_DATE', { ascending: false }).order('CREATED_AT', { ascending: false }).range(0, 1999);
  if (error) throw tableError(error);
  return toTasks(data || [], [me]);
}
