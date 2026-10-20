// Server-side helper: which forms a user can open.
// Admin Control → system 'forms', its sub-tabs are the form ids (e.g. 'employee-charge').
// Admin (ROLE = Admin) always has every form.

import { isAdminUser, type SessionUserRecord } from '@/lib/session';
import { FORMS, FORMS_SYSTEM_ID } from './FormsRegistry';

export function formsOf(user: SessionUserRecord): string[] {
  const all = FORMS.map((f) => f.id);
  if (isAdminUser(user, FORMS_SYSTEM_ID)) return all;

  const raw = String(user.role || '').trim();
  if (!raw) return all;
  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return all;
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(FORMS_SYSTEM_ID)) return [];
  const list = perms[FORMS_SYSTEM_ID];
  return Array.isArray(list) ? all.filter((id) => list.includes(id)) : all;
}
