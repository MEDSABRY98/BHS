// Server-side helper: which forms a user can open.
// Admin Control → system 'forms', its sub-tabs are the form ids (e.g. 'vehicle-expenses')
// and '<form id>-archive' for the archive of that form.
// Admin (ROLE = Admin) always has every form and every archive.

import { isAdminUser, type SessionUserRecord } from '@/lib/session';
import { FORMS, FORMS_SYSTEM_ID, archiveTabId } from './FormsRegistry';

/** the 'forms' list of the user, or null = full access (no permissions set) */
function formsList(user: SessionUserRecord): unknown[] | null | false {
  const raw = String(user.role || '').trim();
  if (!raw) return null;
  let perms: Record<string, unknown>;
  try {
    perms = JSON.parse(raw);
  } catch {
    return null;
  }
  if (Array.isArray(perms.systems) && !perms.systems.includes(FORMS_SYSTEM_ID)) return false;
  const list = perms[FORMS_SYSTEM_ID];
  return Array.isArray(list) ? list : null;
}

export function formsOf(user: SessionUserRecord): string[] {
  const all = FORMS.map((f) => f.id);
  if (isAdminUser(user, FORMS_SYSTEM_ID)) return all;
  const list = formsList(user);
  if (list === false) return [];
  return list ? all.filter((id) => list.includes(id)) : all;
}

/** can the user see the saved forms (archive) of this form */
export function canSeeArchive(user: SessionUserRecord, formId: string): boolean {
  if (isAdminUser(user, FORMS_SYSTEM_ID)) return true;
  const list = formsList(user);
  if (list === false) return false;
  return list ? list.includes(archiveTabId(formId)) : true;
}
