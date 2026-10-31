// Shared (client + server safe) types and helpers for the To Do List.

export const TODO_SYSTEM_ID = 'todo-list';

export type TodoTabId = 'add' | 'tasks' | 'history';

export interface TodoPermissions {
  tabs: TodoTabId[];
  admin: boolean; // sees every user's tasks and gives tasks to other users
}

export interface TodoUser {
  ID: string;
  NAME: string;
}

export interface TodoContext {
  permissions: TodoPermissions;
  me: TodoUser;
  users: TodoUser[]; // who can get a task (admin: everyone, others: only himself)
}

export interface TodoTask {
  ID: string;
  TITLE: string;
  NOTES: string;
  TASK_DATE: string; // yyyy-mm-dd
  ASSIGNEE_ID: string;
  ASSIGNEE_NAME: string;
  CREATED_BY: string;
  CREATED_BY_NAME: string;
  IS_DONE: boolean;
  DONE_AT: string | null;
  DONE_BY_NAME: string | null;
}

export const byTitle = (a: { TITLE: string }, b: { TITLE: string }) => a.TITLE.localeCompare(b.TITLE, undefined, { sensitivity: 'base', numeric: true });

export function uaeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function formatDay(iso: string): string {
  const [y, m, d] = String(iso || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(iso || '');
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Dubai' });
}
